import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedLink {
  id: string;
  channel_id: string;
  short_link: string;
  destination_url: string;
  ad_copy: string;
  dub_link_id: string | null;
  clicks: number;
  created_at: string;
  channels?: {
    name: string;
    color: string;
  };
}

export function useGeneratedLinks() {
  return useQuery({
    queryKey: ["generated-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_links")
        .select(`
          *,
          channels (
            name,
            color
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GeneratedLink[];
    },
  });
}

export function useCreateGeneratedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (link: {
      channel_id: string;
      short_link: string;
      destination_url: string;
      ad_copy: string;
      dub_link_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("generated_links")
        .insert(link)
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
