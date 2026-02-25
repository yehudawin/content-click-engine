CREATE POLICY "Only admins can insert sync status"
ON public.analytics_sync_status
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update sync status"
ON public.analytics_sync_status
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete sync status"
ON public.analytics_sync_status
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));