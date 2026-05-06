CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://nsykpmnjbpjolhlpoaks.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('type', 'message', 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_push_on_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://nsykpmnjbpjolhlpoaks.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('type', 'call', 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_message ON public.messages;
CREATE TRIGGER trg_notify_push_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_message();

DROP TRIGGER IF EXISTS trg_notify_push_call ON public.calls;
CREATE TRIGGER trg_notify_push_call
AFTER INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_call();

REVOKE EXECUTE ON FUNCTION public.notify_push_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_call() FROM PUBLIC, anon, authenticated;