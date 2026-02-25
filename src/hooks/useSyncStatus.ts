import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SyncStatus {
  id: boolean;
  status: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  success_count: number;
  error_count: number;
  synced_links: number;
  message: string | null;
  updated_at: string;
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_sync_status")
        .select("*")
        .eq("id", true)
        .maybeSingle();

      if (error) throw error;
      return data as SyncStatus | null;
    },
    refetchInterval: 60_000, // Refresh every minute
  });
}
