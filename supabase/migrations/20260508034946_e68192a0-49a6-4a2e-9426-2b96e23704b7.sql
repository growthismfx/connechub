CREATE OR REPLACE FUNCTION public.notify_push_on_missed_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://nsykpmnjbpjolhlpoaks.supabase.co/functions/v1/send-push';
BEGIN
  IF NEW.status = 'missed' AND COALESCE(OLD.status,'') <> 'missed' THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('type', 'missed_call', 'record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_push_on_missed_call() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_push_missed_call ON public.calls;
CREATE TRIGGER trg_notify_push_missed_call
  AFTER UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_missed_call();