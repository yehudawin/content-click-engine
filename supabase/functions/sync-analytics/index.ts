/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function buildCorsHeaders(_req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FETCH_TIMEOUT_MS = 30_000;
const STALE_SYNC_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_FRESH_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour - skip recently synced links

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLinkClicks(
  linkId: string,
  headers: Record<string, string>,
  workspaceId: string,
): Promise<{ linkId: string; clicks: number; error?: string }> {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = `https://api.dub.co/analytics?workspaceId=${encodeURIComponent(workspaceId)}&linkId=${encodeURIComponent(linkId)}&event=clicks&interval=all`;
      const response = await fetchWithTimeout(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? Math.max(parseInt(retryAfter, 10) * 1000, 1000)
            : 3000 * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime + jitter));
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          return { linkId, clicks: -1, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` };
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      const data = await response.json();
      const clicks = typeof data === 'number' ? data : data.clicks ?? data.count ?? 0;
      return { linkId, clicks: Number(clicks) || 0 };
    } catch (err) {
      if (attempt === maxRetries) {
        return { linkId, clicks: -1, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }
  }

  return { linkId, clicks: -1, error: 'Max retries exceeded' };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Sync-analytics started`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = () => new Date().toISOString();

  try {
    if (!DUB_API_KEY || !DUB_WORKSPACE_ID) {
      throw new Error('Dub.co credentials not configured');
    }

    // Stale-sync detection: if previous sync is "running" but >5min old, override it
    const { data: existingStatus } = await supabase
      .from('analytics_sync_status')
      .select('status, last_attempt_at')
      .eq('id', true)
      .maybeSingle();

    if (existingStatus?.status === 'running' && existingStatus?.last_attempt_at) {
      const ageMs = Date.now() - new Date(existingStatus.last_attempt_at).getTime();
      if (ageMs < STALE_SYNC_THRESHOLD_MS) {
        console.log(`[${requestId}] Another sync is in progress (age=${ageMs}ms), skipping`);
        return new Response(
          JSON.stringify({ skipped: true, reason: 'another sync is in progress' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.warn(`[${requestId}] Detected stale 'running' sync (age=${ageMs}ms), overriding`);
    }

    // Mark sync as running
    await supabase.from('analytics_sync_status').upsert({
      id: true,
      status: 'running',
      last_attempt_at: nowIso(),
      message: 'מסנכרן נתונים...',
      updated_at: nowIso(),
    });

    // Fetch links eligible for sync: have dub_link_id AND
    //   either last_synced_at is null OR last_synced_at < (now - 1 hour)
    const cutoff = new Date(Date.now() - SYNC_FRESH_THRESHOLD_MS).toISOString();

    const { data: links, error: linksError } = await supabase
      .from('generated_links')
      .select('id, dub_link_id, clicks, last_synced_at')
      .not('dub_link_id', 'is', null)
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`);

    if (linksError) throw linksError;

    if (!links || links.length === 0) {
      await supabase.from('analytics_sync_status').upsert({
        id: true,
        status: 'completed',
        last_success_at: nowIso(),
        success_count: 0,
        error_count: 0,
        synced_links: 0,
        message: 'אין לינקים לסנכרון',
        updated_at: nowIso(),
      });
      return new Response(JSON.stringify({ message: 'No links to sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Syncing ${links.length} links`);

    const dubHeaders = {
      Authorization: `Bearer ${DUB_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const batchSize = 2;
    const batchDelayMs = 2000;
    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(links.length / batchSize);
      console.log(`[${requestId}] Batch ${batchNum}/${totalBatches}`);

      const results = await Promise.all(
        batch.map((link) => fetchLinkClicks(link.dub_link_id!, dubHeaders, DUB_WORKSPACE_ID!)),
      );

      for (const result of results) {
        if (result.error) {
          errorCount++;
          continue;
        }
        successCount++;

        const link = batch.find((l) => l.dub_link_id === result.linkId);
        if (!link || result.clicks < 0) continue;

        // Use sync_link_clicks RPC for monotonic update + last_synced_at
        // Falls back to direct update if RPC unavailable
        const { error: rpcError } = await supabase.rpc('sync_link_clicks', {
          _link_id: link.id,
          _new_clicks: result.clicks,
        });

        if (rpcError) {
          // Fallback: monotonic update via filter
          const { error: updateError } = await supabase
            .from('generated_links')
            .update({ clicks: result.clicks, last_synced_at: nowIso() })
            .eq('id', link.id)
            .lt('clicks', result.clicks);

          if (!updateError && result.clicks !== link.clicks) updatedCount++;
          // Always touch last_synced_at even if clicks didn't move
          await supabase
            .from('generated_links')
            .update({ last_synced_at: nowIso() })
            .eq('id', link.id);
        } else if (result.clicks !== link.clicks) {
          updatedCount++;
        }
      }

      // Persist progress incrementally so a crash leaves a recoverable trail
      await supabase.from('analytics_sync_status').upsert({
        id: true,
        status: 'running',
        last_attempt_at: nowIso(),
        success_count: successCount,
        error_count: errorCount,
        synced_links: i + batch.length,
        message: `מסנכרן... ${i + batch.length}/${links.length}`,
        updated_at: nowIso(),
      });

      if (i + batchSize < links.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    const finalNow = nowIso();
    await supabase.from('analytics_sync_status').upsert({
      id: true,
      status: 'completed',
      last_success_at: finalNow,
      success_count: successCount,
      error_count: errorCount,
      synced_links: links.length,
      message:
        errorCount > 0
          ? `סונכרנו ${successCount} לינקים, ${errorCount} נכשלו`
          : `סנכרון הושלם בהצלחה - ${successCount} לינקים`,
      updated_at: finalNow,
    });

    console.log(`[${requestId}] Done: ${successCount} success, ${errorCount} errors, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({ success: true, successCount, errorCount, updatedCount, totalLinks: links.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error(`[${requestId}] Fatal error:`, error);
    try {
      await supabase.from('analytics_sync_status').upsert({
        id: true,
        status: 'failed',
        message: `שגיאה: ${error instanceof Error ? error.message : 'Unknown'}`,
        updated_at: nowIso(),
      });
    } catch (_) {
      /* ignore */
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
