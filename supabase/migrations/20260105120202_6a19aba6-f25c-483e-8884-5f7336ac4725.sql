-- Create channels table for storing target distribution channels
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_links table for logging all generated links
CREATE TABLE public.generated_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  short_link TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  ad_copy TEXT NOT NULL,
  dub_link_id TEXT,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS for public access (single-user app)
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_links ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow public read channels" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Allow public insert channels" ON public.channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update channels" ON public.channels FOR UPDATE USING (true);
CREATE POLICY "Allow public delete channels" ON public.channels FOR DELETE USING (true);

CREATE POLICY "Allow public read generated_links" ON public.generated_links FOR SELECT USING (true);
CREATE POLICY "Allow public insert generated_links" ON public.generated_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update generated_links" ON public.generated_links FOR UPDATE USING (true);
CREATE POLICY "Allow public delete generated_links" ON public.generated_links FOR DELETE USING (true);

-- Insert default channels
INSERT INTO public.channels (name, description, color) VALUES
  ('Hapargod', 'Main distribution channel', '#6366f1'),
  ('News Feed', 'News aggregator channel', '#10b981'),
  ('Telegram', 'Telegram marketing channel', '#3b82f6'),
  ('Facebook', 'Facebook ads channel', '#8b5cf6'),
  ('Twitter', 'Twitter/X channel', '#f59e0b');