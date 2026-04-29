import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface GeneratedLink {
  id: string;
  channel_id: string;
  campaign_id: string | null;
  short_link: string;
  destination_url: string;
  ad_copy: string;
  dub_link_id: string | null;
  clicks: number;
  user_id: string;
  created_at: string;
  channels?: {
    name: string;
    color: string;
  };
  campaigns?: {
    name: string;
  };
}

export interface LinksFilter {
  channelId?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useGeneratedLinks(filter?: LinksFilter) {
  return useQuery({
    queryKey: ["generated-links", filter],
    queryFn: async () => {
      let query = supabase
        .from("generated_links")
        .select(`
          *,
          channels (
            name,
            color
          ),
          campaigns (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (filter?.channelId) {
        query = query.eq("channel_id", filter.channelId);
      }
      if (filter?.campaignId) {
        query = query.eq("campaign_id", filter.campaignId);
      }
      if (filter?.dateFrom) {
        // Anchor at start of day in UTC to avoid drifting across timezones.
        query = query.gte("created_at", `${filter.dateFrom}T00:00:00.000Z`);
      }
      if (filter?.dateTo) {
        // Inclusive end-of-day in UTC.
        query = query.lte("created_at", `${filter.dateTo}T23:59:59.999Z`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as GeneratedLink[];
    },
  });
}

export function useCreateGeneratedLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (link: {
      channel_id: string;
      campaign_id?: string;
      short_link: string;
      destination_url: string;
      ad_copy: string;
      dub_link_id?: string;
    }) => {
      if (!user) throw new Error("יש להתחבר כדי ליצור קישור");
      
      const { data, error } = await supabase
        .from("generated_links")
        .insert({
          ...link,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-links"] });
    },
  });
}

export function useUpdateLinkClicks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clicks }: { id: string; clicks: number }) => {
      // Use the monotonic RPC so concurrent syncs cannot roll clicks backward.
      // Falls back to a guarded UPDATE if the RPC is unavailable.
      const { error: rpcError } = await supabase.rpc("sync_link_clicks", {
        _link_id: id,
        _new_clicks: clicks,
      });

      if (rpcError) {
        const { error } = await supabase
          .from("generated_links")
          .update({ clicks, last_synced_at: new Date().toISOString() })
          .eq("id", id)
          .lt("clicks", clicks);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-links"] });
    },
  });
}
