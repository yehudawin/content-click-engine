/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Input validation schemas
const VALID_ACTIONS = ['create-link', 'get-links', 'get-analytics', 'get-bulk-analytics'] as const;

function isValidAction(action: unknown): action is typeof VALID_ACTIONS[number] {
  return typeof action === 'string' && VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number]);
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidTags(tags: unknown): tags is string[] {
  return Array.isArray(tags) && tags.every(tag => typeof tag === 'string' && tag.length <= 100);
}

function isValidLinkId(linkId: unknown): boolean {
  return typeof linkId === 'string' && linkId.length > 0 && linkId.length <= 100;
}

function isValidLinkIds(linkIds: unknown): boolean {
  return Array.isArray(linkIds) && linkIds.length <= 100 && linkIds.every(id => isValidLinkId(id));
}

function isValidDateString(date: unknown): boolean {
  if (typeof date !== 'string') return false;
  // ISO date format: YYYY-MM-DD or full ISO timestamp
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  return dateRegex.test(date);
}

async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    // Verify the token by calling Supabase auth API
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY!,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return { userId: user.id };
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

// Fetch analytics for a single link with retry
async function fetchLinkAnalytics(
  linkId: string, 
  headers: Record<string, string>,
  baseUrl: string,
  workspaceId: string,
  startDate?: string,
  endDate?: string
): Promise<{ linkId: string; clicks: number; error?: string }> {
  const maxRetries = 2;
  let lastError: string | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build URL with optional date parameters
      let url = `${baseUrl}/analytics?workspaceId=${workspaceId}&linkId=${encodeURIComponent(linkId)}&event=clicks`;
      
      if (startDate && endDate) {
        // Use start/end for specific date range
        url += `&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      } else {
        // Default to all-time data
        url += `&interval=all`;
      }

      const response = await fetch(url, { method: 'GET', headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText.slice(0, 100)}`;
        console.error(`[${linkId}] Attempt ${attempt + 1} failed: ${lastError}`);
        
        // If rate limited, wait before retry
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        // Don't retry on 4xx errors (except 429)
        if (response.status >= 400 && response.status < 500) {
          break;
        }
        continue;
      }
      
      const data = await response.json();
      // Dub.co returns clicks count directly or in an object
      const clicks = typeof data === 'number' 
        ? data 
        : (data.clicks || data.count || 0);
      
      console.log(`[${linkId}] Success: ${clicks} clicks`);
      return { linkId, clicks };
      
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[${linkId}] Attempt ${attempt + 1} error: ${lastError}`);
    }
  }
  
  // Return error info instead of silent 0
  return { linkId, clicks: -1, error: lastError || 'Unknown error' };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const requestTime = new Date().toISOString();
  console.log(`[${requestId}] Request started at ${requestTime}`);

  try {
    // Authentication check
    const authResult = await verifyAuth(req);
    if (!authResult) {
      console.error(`[${requestId}] Authentication failed`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Authenticated user: ${authResult.userId}`);

    const { action, payload } = await req.json();
    
    // Validate action
    if (!isValidAction(action)) {
      console.error(`[${requestId}] Invalid action: ${action}`);
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Action: ${action}`, JSON.stringify(payload).slice(0, 200));

    if (!DUB_API_KEY || !DUB_WORKSPACE_ID) {
      console.error(`[${requestId}] Missing Dub.co credentials`);
      return new Response(
        JSON.stringify({ error: 'Dub.co credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = `https://api.dub.co`;
    const headers = {
      'Authorization': `Bearer ${DUB_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let response;

    switch (action) {
      case 'create-link': {
        const { url, tags } = payload || {};
        
        // Validate URL
        if (!isValidUrl(url)) {
          return new Response(
            JSON.stringify({ error: 'Invalid URL provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Validate tags
        if (tags !== undefined && !isValidTags(tags)) {
          return new Response(
            JSON.stringify({ error: 'Invalid tags provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] Creating link:`, { url, tags });
        
        response = await fetch(`${baseUrl}/links?workspaceId=${DUB_WORKSPACE_ID}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url,
            tags: tags || [],
          }),
        });
        break;
      }

      case 'get-links': {
        console.log(`[${requestId}] Fetching links`);
        response = await fetch(`${baseUrl}/links?workspaceId=${DUB_WORKSPACE_ID}`, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'get-analytics': {
        const { linkId, startDate, endDate } = payload || {};
        
        if (!isValidLinkId(linkId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid link ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate optional date parameters
        if (startDate && !isValidDateString(startDate)) {
          return new Response(
            JSON.stringify({ error: 'Invalid start date format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (endDate && !isValidDateString(endDate)) {
          return new Response(
            JSON.stringify({ error: 'Invalid end date format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] Fetching analytics for link: ${linkId}, range: ${startDate || 'all'} to ${endDate || 'all'}`);
        
        let url = `${baseUrl}/analytics?workspaceId=${DUB_WORKSPACE_ID}&linkId=${encodeURIComponent(linkId)}&event=clicks`;
        if (startDate && endDate) {
          url += `&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        } else {
          url += `&interval=all`;
        }
        
        response = await fetch(url, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'get-bulk-analytics': {
        const { linkIds, startDate, endDate } = payload || {};
        
        if (!isValidLinkIds(linkIds)) {
          return new Response(
            JSON.stringify({ error: 'Invalid link IDs' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate optional date parameters
        if (startDate && !isValidDateString(startDate)) {
          return new Response(
            JSON.stringify({ error: 'Invalid start date format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (endDate && !isValidDateString(endDate)) {
          return new Response(
            JSON.stringify({ error: 'Invalid end date format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[${requestId}] Fetching bulk analytics for ${linkIds.length} links, range: ${startDate || 'all-time'} to ${endDate || 'now'}`);
        
        // Fetch analytics in parallel with batching (max 10 concurrent)
        const batchSize = 10;
        const results: Record<string, number> = {};
        const errors: Record<string, string> = {};
        
        for (let i = 0; i < linkIds.length; i += batchSize) {
          const batch = linkIds.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((linkId: string) => 
              fetchLinkAnalytics(linkId, headers, baseUrl, DUB_WORKSPACE_ID!, startDate, endDate)
            )
          );
          
          for (const result of batchResults) {
            if (result.error) {
              errors[result.linkId] = result.error;
              // Keep existing value (don't overwrite with -1)
            } else {
              results[result.linkId] = result.clicks;
            }
          }
        }
        
        const successCount = Object.keys(results).length;
        const errorCount = Object.keys(errors).length;
        console.log(`[${requestId}] Bulk analytics complete: ${successCount} success, ${errorCount} errors`);
        
        if (errorCount > 0) {
          console.warn(`[${requestId}] Errors:`, JSON.stringify(errors).slice(0, 500));
        }
        
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
              dateRange: startDate && endDate ? { start: startDate, end: endDate } : 'all-time'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const data = await response.json();
    console.log(`[${requestId}] Dub API response:`, JSON.stringify(data).slice(0, 500));

    if (!response.ok) {
      console.error(`[${requestId}] Dub API error:`, data);
      return new Response(
        JSON.stringify({ error: 'Dub API error', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Error in dub-proxy function:`, errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
