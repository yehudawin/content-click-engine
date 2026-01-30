import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateLinkPayload {
  url: string;
  tags: string[];
}

interface DubLink {
  id: string;
  shortLink: string;
  url: string;
  clicks?: number;
}

interface DubAnalytics {
  clicks: number;
}

export function useCreateDubLink() {
  return useMutation({
    mutationFn: async (payload: CreateLinkPayload): Promise<DubLink> => {
      const { data, error } = await supabase.functions.invoke("dub-proxy", {
        body: {
          action: "create-link",
          payload,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
  });
}

export function useGetDubLinks() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dub-proxy", {
        body: {
          action: "get-links",
          payload: {},
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as DubLink[];
    },
  });
}

interface SyncAnalyticsParams {
  linkIds: string[];
  startDate?: string;
  endDate?: string;
}

interface BulkAnalyticsResponse {
  data: Record<string, number>;
  errors?: Record<string, string>;
  meta: {
    requestId: string;
    timestamp: string;
    totalLinks: number;
    successCount: number;
    errorCount: number;
    dateRange: { start: string; end: string } | 'all-time';
  };
}

export function useSyncAnalytics() {
  return useMutation({
    mutationFn: async (params: SyncAnalyticsParams): Promise<BulkAnalyticsResponse> => {
      const { linkIds, startDate, endDate } = params;
      
      console.log(`[Sync] Starting sync for ${linkIds.length} links`, { startDate, endDate });
      
      const { data, error } = await supabase.functions.invoke("dub-proxy", {
        body: {
          action: "get-bulk-analytics",
          payload: { linkIds, startDate, endDate },
        },
      });

      if (error) {
        console.error('[Sync] Edge function error:', error);
        throw error;
      }
      if (data.error) {
        console.error('[Sync] API error:', data.error);
        throw new Error(data.error);
      }
      
      console.log(`[Sync] Complete:`, data.meta);
      
      return data as BulkAnalyticsResponse;
    },
  });
}
