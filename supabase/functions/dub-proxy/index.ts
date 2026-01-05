import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUB_API_KEY = Deno.env.get('DUB_API_KEY');
const DUB_WORKSPACE_ID = Deno.env.get('DUB_WORKSPACE_ID');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
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
        const { url, tags } = payload;
        console.log('Creating link:', { url, tags });
        
        response = await fetch(`${baseUrl}/links?workspaceId=${DUB_WORKSPACE_ID}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url,
            tags,
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
        const { linkId } = payload;
        console.log('Fetching analytics for link:', linkId);
        response = await fetch(`${baseUrl}/analytics?workspaceId=${DUB_WORKSPACE_ID}&linkId=${linkId}&event=clicks`, {
          method: 'GET',
          headers,
        });
        break;
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
        JSON.stringify({ error: data.error || 'Dub API error', details: data }),
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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
