CREATE TABLE IF NOT EXISTS public.analytics_sync_status (
  id boolean PRIMARY KEY DEFAULT true,
  status text NOT NULL DEFAULT 'idle',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  synced_links integer NOT NULL DEFAULT 0,
  message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_sync_status_singleton CHECK (id = true)
);

ALTER TABLE public.analytics_sync_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_sync_status'
      AND policyname = 'Authenticated users can view sync status'
  ) THEN
    CREATE POLICY "Authenticated users can view sync status"
    ON public.analytics_sync_status
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END
$$;

INSERT INTO public.analytics_sync_status (id, status, message)
VALUES (true, 'idle', 'טרם בוצע סנכרון אוטומטי')
ON CONFLICT (id) DO NOTHING;