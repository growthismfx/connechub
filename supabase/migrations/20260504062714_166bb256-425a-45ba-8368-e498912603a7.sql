
CREATE TABLE IF NOT EXISTS public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  kind text NOT NULL, -- 'offer' | 'answer' | 'ice'
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_signals_call ON public.call_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_to ON public.call_signals(to_user);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Send signals as self" ON public.call_signals
FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid());

CREATE POLICY "Read signals addressed to me" ON public.call_signals
FOR SELECT TO authenticated USING (to_user = auth.uid() OR from_user = auth.uid());

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
