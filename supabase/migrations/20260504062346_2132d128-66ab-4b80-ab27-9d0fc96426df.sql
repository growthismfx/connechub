
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS ended_at timestamptz;

DROP POLICY IF EXISTS "Update own calls" ON public.calls;
CREATE POLICY "Update own calls" ON public.calls
FOR UPDATE TO authenticated
USING (caller_id = auth.uid() OR callee_id = auth.uid());

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.calls; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
