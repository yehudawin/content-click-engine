/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// =============================================================================
// export-links-since
// -----------------------------------------------------------------------------
// Bearer-auth'd snapshot endpoint that the sibling broadcast-hub project
// (or any allowed consumer) calls to mirror our generated_links + supporting
// channels/campaigns into its own analytics view.
//
// Auth: Authorization: Bearer <EXPORT_BEARER>  (shared secret stored in
//        Supabase function secrets on BOTH projects).
//
// Request:  GET /export-links-since?since=<ISO>&limit=<n>
//   - since (optional): only include links whose watermark
//     (GREATEST(created_at, COALESCE(last_synced_at, created_at))) is strictly
//     greater than this timestamp. Omit for full export.
//   - limit (optional, default 1000, max 5000): page size for links.
//
// Response 200:
//   {
//     links:      [{ id, short_link, destination_url, ad_copy, clicks,
//                    dub_link_id, created_at, last_synced_at,
//                    channel_id, campaign_id, user_id }],
//     channels:   [{ id, name, description, color, user_id, created_at }],
//     campaigns:  [{ id, name, description, user_id, created_at, updated_at }],
//     count:      <number of links returned>,
//     next_since: <ISO|null>  // pass back as `since` on next call;
//                              // null when fewer than `limit` rows returned.
//     server_time: <ISO>      // for cosmetic UI display
//   }
//
// channels/campaigns are tiny (tens of rows total) so we always return the
// full set rather than incremental; broadcast-hub upserts them every call.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPORT_BEARER = Deno.env.get('EXPORT_BEARER');

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

// Constant-time-ish bearer comparison. Rejects when the secret is unset so we
// fail closed rather than authorising every caller.
function authorize(req: Request): { ok: true } | { ok: false; reason: string; status: number } {
  if (!EXPORT_BEARER) {
    return { ok: false, reason: 'EXPORT_BEARER not configured on server', status: 503 };
  }
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return { ok: false, reason: 'Missing Bearer token', status: 401 };
  const provided = match[1].trim();
  if (provided.length !== EXPORT_BEARER.length) {
    return { ok: false, reason: 'Invalid token', status: 401 };
  }
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ EXPORT_BEARER.charCodeAt(i);
  }
  if (diff !== 0) return { ok: false, reason: 'Invalid token', status: 401 };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = authorize(req);
  if (!auth.ok) return json({ error: auth.reason }, auth.status);

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const limitParam = url.searchParams.get('limit');

  // Parse `since`. Accept ISO 8601; reject anything we can't turn into a Date.
  let sinceIso: string | null = null;
  if (sinceParam) {
    const t = Date.parse(sinceParam);
    if (Number.isNaN(t)) return json({ error: 'Invalid `since` timestamp' }, 400);
    sinceIso = new Date(t).toISOString();
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(limitParam) || DEFAULT_LIMIT),
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = new Date().toISOString();

  try {
    // -------- links ----------------------------------------------------------
    // Watermark = GREATEST(created_at, COALESCE(last_synced_at, created_at)).
    // Postgrest can't compute that in a filter directly, so we OR two conditions
    // and dedupe by primary key client-side (cheap at limit ≤ 5000).
    let linksQuery = supabase
      .from('generated_links')
      .select(
        'id, short_link, destination_url, ad_copy, clicks, dub_link_id, ' +
          'created_at, last_synced_at, channel_id, campaign_id, user_id',
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (sinceIso) {
      // Either the row was created after `since`, or its clicks were re-synced
      // after `since`. Use Postgrest's `or` filter.
      linksQuery = linksQuery.or(
        `created_at.gt.${sinceIso},last_synced_at.gt.${sinceIso}`,
      );
    }

    const { data: links, error: linksError } = await linksQuery;
    if (linksError) throw linksError;

    const linksList = links ?? [];

    // Determine next_since: max(GREATEST(created_at, last_synced_at)) in this page.
    // If we returned fewer rows than `limit`, the caller has caught up; set null
    // so they can decide to keep `since` unchanged for the next pass.
    let maxWatermark: string | null = null;
    for (const row of linksList) {
      const a = row.created_at;
      const b = row.last_synced_at ?? row.created_at;
      const w = a > b ? a : b;
      if (!maxWatermark || w > maxWatermark) maxWatermark = w;
    }
    const nextSince = linksList.length >= limit ? maxWatermark : null;

    // -------- channels (tiny: always full export) ---------------------------
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, name, description, color, user_id, created_at');
    if (channelsError) throw channelsError;

    // -------- campaigns (tiny: always full export) --------------------------
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, description, user_id, created_at, updated_at');
    if (campaignsError) throw campaignsError;

    return json({
      links: linksList,
      channels: channels ?? [],
      campaigns: campaigns ?? [],
      count: linksList.length,
      next_since: nextSince,
      server_time: startedAt,
    });
  } catch (err) {
    console.error('[export-links-since] error', err);
    return json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      500,
    );
  }
});
