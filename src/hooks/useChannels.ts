import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChannelSchema } from "@/lib/validation";

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Channel[];
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: { name: string; description?: string; color?: string }) => {
      // Validate input before sending to database
      const result = ChannelSchema.safeParse(channel);
      if (!result.success) {
        throw new Error(result.error.errors[0]?.message || "קלט לא תקין");
      }

      const { data, error } = await supabase
        .from("channels")
        .insert({
          name: result.data.name,
          description: result.data.description ?? null,
          color: result.data.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
