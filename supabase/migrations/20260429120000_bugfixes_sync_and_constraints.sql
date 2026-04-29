-- ============================================================================
-- Bugfix migration: monotonic click sync, per-user channel uniqueness,
-- last_synced_at tracking, and supporting indexes.
-- ============================================================================

-- 1) Add last_synced_at to generated_links so sync can skip recently-synced rows
ALTER TABLE public.generated_links
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_generated_links_last_synced_at
  ON public.generated_links(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_generated_links_dub_link_id
  ON public.generated_links(dub_link_id) WHERE dub_link_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_links_user_id
  ON public.generated_links(user_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_user_id ON public.channels(user_id);

-- 2) Replace the global UNIQUE on channels.name with per-user uniqueness.
--    The original constraint blocked multiple users from creating channels
--    with the same name (e.g. "Facebook").
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.channels'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(name)%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.channels DROP CONSTRAINT %I', con_name);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_channels_user_name
  ON public.channels(user_id, name)
  WHERE user_id IS NOT NULL;

-- 3) Monotonic click update RPC: only increases clicks, always updates last_synced_at.
CREATE OR REPLACE FUNCTION public.sync_link_clicks(_link_id uuid, _new_clicks integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _new_clicks IS NULL OR _new_clicks < 0 THEN
    RETURN;
  END IF;

  UPDATE public.generated_links
  SET
    clicks = GREATEST(COALESCE(clicks, 0), _new_clicks),
    last_synced_at = now()
  WHERE id = _link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_link_clicks(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_link_clicks(uuid, integer) TO service_role;

-- 4) Auto-recover stuck sync status: if status='running' but last_attempt_at
--    is older than 5 minutes, treat as failed. Implemented via a view-friendly
--    helper function so the application or a cron can normalize it.
CREATE OR REPLACE FUNCTION public.reset_stale_sync_status()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.analytics_sync_status
  SET
    status = 'failed',
    message = 'הסנכרון נתקע - אופס אוטומטית',
    updated_at = now()
  WHERE id = true
    AND status = 'running'
    AND last_attempt_at IS NOT NULL
    AND last_attempt_at < now() - interval '5 minutes';
$$;

REVOKE ALL ON FUNCTION public.reset_stale_sync_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_stale_sync_status() TO authenticated, service_role;

-- 5) Enforce one role per user so useSetUserRole upsert is atomic.
--    First, deduplicate any pre-existing rows that have multiple roles for
--    the same user (keep admin if any, otherwise the most recent).
WITH ranked AS (
  SELECT id,
         user_id,
         role,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY (role = 'admin') DESC, created_at DESC
         ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_id
  ON public.user_roles(user_id);
