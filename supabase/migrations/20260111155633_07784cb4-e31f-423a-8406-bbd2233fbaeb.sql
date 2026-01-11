
-- Add user_id column to campaigns table
ALTER TABLE public.campaigns ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to channels table
ALTER TABLE public.channels ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to generated_links table
ALTER TABLE public.generated_links ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies on campaigns
DROP POLICY IF EXISTS "Allow public delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public update campaigns" ON public.campaigns;

-- Drop old permissive policies on channels
DROP POLICY IF EXISTS "Allow public delete channels" ON public.channels;
DROP POLICY IF EXISTS "Allow public insert channels" ON public.channels;
DROP POLICY IF EXISTS "Allow public read channels" ON public.channels;
DROP POLICY IF EXISTS "Allow public update channels" ON public.channels;

-- Drop old permissive policies on generated_links
DROP POLICY IF EXISTS "Allow public delete generated_links" ON public.generated_links;
DROP POLICY IF EXISTS "Allow public insert generated_links" ON public.generated_links;
DROP POLICY IF EXISTS "Allow public read generated_links" ON public.generated_links;
DROP POLICY IF EXISTS "Allow public update generated_links" ON public.generated_links;

-- Create new secure policies for campaigns
CREATE POLICY "Approved users view own campaigns" ON public.campaigns 
  FOR SELECT USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create campaigns" ON public.campaigns 
  FOR INSERT WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own campaigns" ON public.campaigns 
  FOR UPDATE USING (is_user_approved(auth.uid()) AND user_id = auth.uid()) 
  WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own campaigns" ON public.campaigns 
  FOR DELETE USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins manage all campaigns" ON public.campaigns 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create new secure policies for channels
CREATE POLICY "Approved users view own channels" ON public.channels 
  FOR SELECT USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create channels" ON public.channels 
  FOR INSERT WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own channels" ON public.channels 
  FOR UPDATE USING (is_user_approved(auth.uid()) AND user_id = auth.uid()) 
  WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own channels" ON public.channels 
  FOR DELETE USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins manage all channels" ON public.channels 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create new secure policies for generated_links
CREATE POLICY "Approved users view own links" ON public.generated_links 
  FOR SELECT USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create links" ON public.generated_links 
  FOR INSERT WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own links" ON public.generated_links 
  FOR UPDATE USING (is_user_approved(auth.uid()) AND user_id = auth.uid()) 
  WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own links" ON public.generated_links 
  FOR DELETE USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins manage all links" ON public.generated_links 
  FOR ALL USING (has_role(auth.uid(), 'admin'));
