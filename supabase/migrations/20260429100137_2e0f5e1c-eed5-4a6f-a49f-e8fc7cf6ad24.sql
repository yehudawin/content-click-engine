UPDATE public.analytics_sync_status
SET status = 'idle', message = 'אופס ידני לפני בדיקה', updated_at = now()
WHERE id = true;