-- Drop restrictive policies and recreate as permissive
-- This fixes the issue where RESTRICTIVE policies conflict with each other

-- Channels table
DROP POLICY IF EXISTS "Admins manage all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Approved users create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Approved users delete own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Approved users update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Approved users view own campaigns" ON public.campaigns;

DROP POLICY IF EXISTS "Admins manage all channels" ON public.channels;
DROP POLICY IF EXISTS "Approved users create channels" ON public.channels;
DROP POLICY IF EXISTS "Approved users delete own channels" ON public.channels;
DROP POLICY IF EXISTS "Approved users update own channels" ON public.channels;
DROP POLICY IF EXISTS "Approved users view own channels" ON public.channels;

DROP POLICY IF EXISTS "Admins manage all links" ON public.generated_links;
DROP POLICY IF EXISTS "Approved users create links" ON public.generated_links;
DROP POLICY IF EXISTS "Approved users delete own links" ON public.generated_links;
DROP POLICY IF EXISTS "Approved users update own links" ON public.generated_links;
DROP POLICY IF EXISTS "Approved users view own links" ON public.generated_links;

-- Recreate campaigns policies as PERMISSIVE
CREATE POLICY "Admins manage all campaigns" ON public.campaigns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users view own campaigns" ON public.campaigns FOR SELECT
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create campaigns" ON public.campaigns FOR INSERT
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own campaigns" ON public.campaigns FOR UPDATE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid())
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own campaigns" ON public.campaigns FOR DELETE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

-- Recreate channels policies as PERMISSIVE
CREATE POLICY "Admins manage all channels" ON public.channels FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users view own channels" ON public.channels FOR SELECT
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create channels" ON public.channels FOR INSERT
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own channels" ON public.channels FOR UPDATE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid())
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own channels" ON public.channels FOR DELETE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

-- Recreate generated_links policies as PERMISSIVE
CREATE POLICY "Admins manage all links" ON public.generated_links FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users view own links" ON public.generated_links FOR SELECT
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users create links" ON public.generated_links FOR INSERT
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users update own links" ON public.generated_links FOR UPDATE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid())
WITH CHECK (is_user_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Approved users delete own links" ON public.generated_links FOR DELETE
USING (is_user_approved(auth.uid()) AND user_id = auth.uid());