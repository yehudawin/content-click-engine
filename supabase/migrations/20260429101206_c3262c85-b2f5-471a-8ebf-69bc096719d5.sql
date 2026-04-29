UPDATE public.analytics_sync_status
SET status = 'failed', message = 'הופסק עקב מגבלת זמן - ימשיך בהפעלה הבאה', updated_at = now()
WHERE id = true AND status = 'running';