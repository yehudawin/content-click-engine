import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Authentication failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    const { action, payload } = await req.json();
    
    // Validate action
    if (!isValidAction(action)) {
      console.error('Invalid action:', action);
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dub proxy action: ${action}`, payload);

    if (!DUB_API_KEY || !DUB_WORKSPACE_ID) {
      console.error('Missing Dub.co credentials');
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

        console.log('Creating link:', { url, tags });
        
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
        console.log('Fetching links');
        response = await fetch(`${baseUrl}/links?workspaceId=${DUB_WORKSPACE_ID}`, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'get-analytics': {
        const { linkId } = payload || {};
        
        if (!isValidLinkId(linkId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid link ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Fetching analytics for link:', linkId);
        response = await fetch(`${baseUrl}/analytics?workspaceId=${DUB_WORKSPACE_ID}&linkId=${encodeURIComponent(linkId)}&event=clicks`, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'get-bulk-analytics': {
        const { linkIds } = payload || {};
        
        if (!isValidLinkIds(linkIds)) {
          return new Response(
            JSON.stringify({ error: 'Invalid link IDs' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Fetching bulk analytics for links:', linkIds);
        
        // Fetch analytics for each link
        const analyticsResults: Record<string, number> = {};
        
        for (const linkId of linkIds) {
          try {
            const analyticsResponse = await fetch(
              `${baseUrl}/analytics?workspaceId=${DUB_WORKSPACE_ID}&linkId=${encodeURIComponent(linkId)}&event=clicks`,
              { method: 'GET', headers }
            );
            
            if (analyticsResponse.ok) {
              const analyticsData = await analyticsResponse.json();
              // Dub.co returns clicks count directly or in an object
              analyticsResults[linkId] = typeof analyticsData === 'number' 
                ? analyticsData 
                : (analyticsData.clicks || analyticsData.count || 0);
            }
          } catch (err) {
            console.error(`Error fetching analytics for ${linkId}:`, err);
            analyticsResults[linkId] = 0;
          }
        }
        
        return new Response(
          JSON.stringify(analyticsResults),
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
    console.log('Dub API response:', JSON.stringify(data).slice(0, 500));

    if (!response.ok) {
      console.error('Dub API error:', data);
      return new Response(
        JSON.stringify({ error: 'Dub API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in dub-proxy function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
