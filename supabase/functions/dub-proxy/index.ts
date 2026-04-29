/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow =
    ALLOWED_ORIGINS.length === 0
      ? '*'
      : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const FETCH_TIMEOUT_MS = 30_000;

const VALID_ACTIONS = ['create-link', 'get-links', 'get-analytics', 'get-bulk-analytics'] as const;

function isValidAction(action: unknown): action is typeof VALID_ACTIONS[number] {
  return typeof action === 'string' && VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number]);
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidTags(tags: unknown): tags is string[] {
  return Array.isArray(tags) && tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 100);
}

function isValidLinkId(linkId: unknown): boolean {
  return typeof linkId === 'string' && linkId.length > 0 && linkId.length <= 100;
}

function isValidLinkIds(linkIds: unknown): linkIds is string[] {
  return (
    Array.isArray(linkIds) &&
    linkIds.length > 0 &&
    linkIds.length <= 1000 &&
    linkIds.every((id) => isValidLinkId(id))
  );
}

function isValidDateString(date: unknown): boolean {
  if (typeof date !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!dateRegex.test(date)) return false;
  const parsed = Date.parse(date);
  return !Number.isNaN(parsed);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');

  try {
    const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY!,
      },
    }, 10_000);

    if (!response.ok) return null;
    const user = await response.json();
    if (!user?.id) return null;
    return { userId: user.id };
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

async function fetchLinkAnalytics(
  linkId: string,
  headers: Record<string, string>,
  baseUrl: string,
  workspaceId: string,
  startDate?: string,
  endDate?: string,
): Promise<{ linkId: string; clicks: number; error?: string }> {
  const maxRetries = 5;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let url = `${baseUrl}/analytics?workspaceId=${encodeURIComponent(workspaceId)}&linkId=${encodeURIComponent(linkId)}&event=clicks`;
      if (startDate && endDate) {
        url += `&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      } else {
        url += `&interval=all`;
      }

      const response = await fetchWithTimeout(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText.slice(0, 100)}`;

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? Math.max(parseInt(retryAfter, 10) * 1000, 1000)
            : 3000 * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          console.log(`[${linkId}] Rate limited, waiting ${waitTime + jitter}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, waitTime + jitter));
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      const data = await response.json();
      const clicks = typeof data === 'number' ? data : data.clicks ?? data.count ?? 0;
      return { linkId, clicks: Number(clicks) || 0 };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[${linkId}] Attempt ${attempt + 1} error: ${lastError}`);
    }
  }

  return { linkId, clicks: -1, error: lastError ?? 'Unknown error' };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Request started at ${new Date().toISOString()}`);

  try {
    const authResult = await verifyAuth(req);
    if (!authResult) {
      console.error(`[${requestId}] Authentication failed`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Authenticated user: ${authResult.userId}`);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, payload } = body as { action?: unknown; payload?: Record<string, unknown> };

    if (!isValidAction(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!DUB_API_KEY || !DUB_WORKSPACE_ID) {
      console.error(`[${requestId}] Missing Dub.co credentials`);
      return new Response(JSON.stringify({ error: 'Dub.co credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = 'https://api.dub.co';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${DUB_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let response: Response | undefined;

    switch (action) {
      case 'create-link': {
        const { url, tags } = (payload ?? {}) as { url?: unknown; tags?: unknown };
        if (!isValidUrl(url)) {
          return new Response(JSON.stringify({ error: 'Invalid URL provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (tags !== undefined && !isValidTags(tags)) {
          return new Response(JSON.stringify({ error: 'Invalid tags provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        response = await fetchWithTimeout(`${baseUrl}/links?workspaceId=${encodeURIComponent(DUB_WORKSPACE_ID)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url, tags: tags ?? [] }),
        });
        break;
      }

      case 'get-links': {
        response = await fetchWithTimeout(`${baseUrl}/links?workspaceId=${encodeURIComponent(DUB_WORKSPACE_ID)}`, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'get-analytics': {
        const { linkId, startDate, endDate } = (payload ?? {}) as {
          linkId?: unknown;
          startDate?: unknown;
          endDate?: unknown;
        };
        if (!isValidLinkId(linkId)) {
          return new Response(JSON.stringify({ error: 'Invalid link ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (startDate && !isValidDateString(startDate)) {
          return new Response(JSON.stringify({ error: 'Invalid start date format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (endDate && !isValidDateString(endDate)) {
          return new Response(JSON.stringify({ error: 'Invalid end date format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (
          typeof startDate === 'string' &&
          typeof endDate === 'string' &&
          Date.parse(startDate) > Date.parse(endDate)
        ) {
          return new Response(JSON.stringify({ error: 'startDate must be <= endDate' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let url = `${baseUrl}/analytics?workspaceId=${encodeURIComponent(DUB_WORKSPACE_ID)}&linkId=${encodeURIComponent(linkId as string)}&event=clicks`;
        if (startDate && endDate) {
          url += `&start=${encodeURIComponent(startDate as string)}&end=${encodeURIComponent(endDate as string)}`;
        } else {
          url += `&interval=all`;
        }

        response = await fetchWithTimeout(url, { method: 'GET', headers });
        break;
      }

      case 'get-bulk-analytics': {
        const { linkIds, startDate, endDate } = (payload ?? {}) as {
          linkIds?: unknown;
          startDate?: unknown;
          endDate?: unknown;
        };

        if (!isValidLinkIds(linkIds)) {
          return new Response(JSON.stringify({ error: 'Invalid link IDs' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (startDate && !isValidDateString(startDate)) {
          return new Response(JSON.stringify({ error: 'Invalid start date format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (endDate && !isValidDateString(endDate)) {
          return new Response(JSON.stringify({ error: 'Invalid end date format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (
          typeof startDate === 'string' &&
          typeof endDate === 'string' &&
          Date.parse(startDate) > Date.parse(endDate)
        ) {
          return new Response(JSON.stringify({ error: 'startDate must be <= endDate' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const batchSize = 2;
        const batchDelayMs = 2000;
        const results: Record<string, number> = {};
        const errors: Record<string, string> = {};

        for (let i = 0; i < linkIds.length; i += batchSize) {
          const batch = linkIds.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(linkIds.length / batchSize);

          console.log(`[${requestId}] Processing batch ${batchNumber}/${totalBatches}`);

          const batchResults = await Promise.all(
            batch.map((linkId) =>
              fetchLinkAnalytics(
                linkId,
                headers,
                baseUrl,
                DUB_WORKSPACE_ID!,
                typeof startDate === 'string' ? startDate : undefined,
                typeof endDate === 'string' ? endDate : undefined,
              ),
            ),
          );

          for (const result of batchResults) {
            if (result.error) errors[result.linkId] = result.error;
            else results[result.linkId] = result.clicks;
          }

          if (i + batchSize < linkIds.length) {
            await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
          }
        }

        const successCount = Object.keys(results).length;
        const errorCount = Object.keys(errors).length;
        console.log(`[${requestId}] Bulk analytics complete: ${successCount} success, ${errorCount} errors`);

        return new Response(
          JSON.stringify({
            data: results,
            errors: errorCount > 0 ? errors : undefined,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
              totalLinks: linkIds.length,
              successCount,
              errorCount,
              dateRange:
                typeof startDate === 'string' && typeof endDate === 'string'
                  ? { start: startDate, end: endDate }
                  : 'all-time',
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: 'No response generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[${requestId}] Dub API error:`, data);
      return new Response(JSON.stringify({ error: 'Dub API error', details: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate critical fields for create-link to prevent silent NULLs downstream
    if (action === 'create-link' && (!data?.id || !data?.shortLink)) {
      console.error(`[${requestId}] create-link returned malformed response:`, data);
      return new Response(
        JSON.stringify({ error: 'Dub API returned malformed response (missing id or shortLink)' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Error in dub-proxy function:`, errorMessage);
    return new Response(JSON.stringify({ error: 'Internal server error', requestId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
