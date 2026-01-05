import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateLinkPayload {
  url: string;
  tags: string[];
}

interface DubLink {
  id: string;
  shortLink: string;
  url: string;
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
