-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own subs" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own subs" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own subs" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger: on new message, call edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url TEXT := 'https://nsykpmnjbpjolhlpoaks.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('type', 'message', 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_message ON public.messages;
CREATE TRIGGER trg_notify_push_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_message();

-- Trigger: on new call, call edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url TEXT := 'https://nsykpmnjbpjolhlpoaks.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('type', 'call', 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_call ON public.calls;
CREATE TRIGGER trg_notify_push_call
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_call();