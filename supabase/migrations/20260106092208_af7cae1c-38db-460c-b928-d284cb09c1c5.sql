-- Create campaigns table (advertising projects)
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Public access policies for campaigns
CREATE POLICY "Allow public read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update campaigns" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete campaigns" ON public.campaigns FOR DELETE USING (true);

-- Add campaign_id to generated_links
ALTER TABLE public.generated_links 
ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_generated_links_campaign_id ON public.generated_links(campaign_id);
CREATE INDEX idx_generated_links_created_at ON public.generated_links(created_at);

-- Create trigger for updated_at on campaigns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();