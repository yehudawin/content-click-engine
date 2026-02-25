/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function fetchLinkClicks(
  linkId: string,
  headers: Record<string, string>,
  workspaceId: string
): Promise<{ linkId: string; clicks: number; error?: string }> {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = `https://api.dub.co/analytics?workspaceId=${workspaceId}&linkId=${encodeURIComponent(linkId)}&event=clicks&interval=all`;
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? Math.max(parseInt(retryAfter, 10) * 1000, 1000)
            : 3000 * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          console.log(`[${linkId}] Rate limited, waiting ${waitTime + jitter}ms (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime + jitter));
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          return { linkId, clicks: -1, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` };
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      const data = await response.json();
      const clicks = typeof data === 'number' ? data : (data.clicks || data.count || 0);
      return { linkId, clicks };
    } catch (err) {
      if (attempt === maxRetries) {
        return { linkId, clicks: -1, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }
  }

  return { linkId, clicks: -1, error: 'Max retries exceeded' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Sync-analytics started`);

  try {
    if (!DUB_API_KEY || !DUB_WORKSPACE_ID) {
      throw new Error('Dub.co credentials not configured');
    }

    // Use service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update sync status to running
    await supabase.from('analytics_sync_status').upsert({
      id: true,
      status: 'running',
      last_attempt_at: new Date().toISOString(),
      message: 'מסנכרן נתונים...',
      updated_at: new Date().toISOString(),
    });

    // Fetch all links with dub_link_id
    const { data: links, error: linksError } = await supabase
      .from('generated_links')
      .select('id, dub_link_id, clicks')
      .not('dub_link_id', 'is', null);

    if (linksError) throw linksError;

    if (!links || links.length === 0) {
      await supabase.from('analytics_sync_status').upsert({
        id: true,
        status: 'completed',
        last_success_at: new Date().toISOString(),
        success_count: 0,
        error_count: 0,
        synced_links: 0,
        message: 'אין לינקים לסנכרון',
        updated_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ message: 'No links to sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Syncing ${links.length} links`);

    const dubHeaders = {
      'Authorization': `Bearer ${DUB_API_KEY}`,
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
        batch.map(link => fetchLinkClicks(link.dub_link_id!, dubHeaders, DUB_WORKSPACE_ID!))
      );

      for (const result of results) {
        if (result.error) {
          errorCount++;
          continue;
        }
        successCount++;

        // Find the matching link and update if clicks changed
        const link = batch.find(l => l.dub_link_id === result.linkId);
        if (link && result.clicks >= 0 && result.clicks !== link.clicks) {
          const { error: updateError } = await supabase
            .from('generated_links')
            .update({ clicks: result.clicks })
            .eq('id', link.id);

          if (!updateError) updatedCount++;
        }
      }

      if (i + batchSize < links.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    const now = new Date().toISOString();
    await supabase.from('analytics_sync_status').upsert({
      id: true,
      status: 'completed',
      last_success_at: now,
      success_count: successCount,
      error_count: errorCount,
      synced_links: links.length,
      message: errorCount > 0
        ? `סונכרנו ${successCount} לינקים, ${errorCount} נכשלו`
        : `סנכרון הושלם בהצלחה - ${successCount} לינקים`,
      updated_at: now,
    });

    console.log(`[${requestId}] Done: ${successCount} success, ${errorCount} errors, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        errorCount,
        updatedCount,
        totalLinks: links.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${requestId}] Fatal error:`, error);

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('analytics_sync_status').upsert({
        id: true,
        status: 'failed',
        message: `שגיאה: ${error instanceof Error ? error.message : 'Unknown'}`,
        updated_at: new Date().toISOString(),
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
