
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS connected_via TEXT NOT NULL DEFAULT 'username';

CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  background TEXT DEFAULT 'var(--gradient-cta)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View active statuses" ON public.statuses FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "Create own status" ON public.statuses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own status" ON public.statuses FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.status_views (
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mark self as viewer" ON public.status_views FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());
CREATE POLICY "Owner or viewer can read" ON public.status_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()));

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'voice',
  status TEXT NOT NULL DEFAULT 'missed',
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own calls" ON public.calls FOR SELECT TO authenticated USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "Insert calls" ON public.calls FOR INSERT TO authenticated WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE INDEX idx_statuses_user ON public.statuses(user_id);
CREATE INDEX idx_statuses_expires ON public.statuses(expires_at);
CREATE INDEX idx_calls_users ON public.calls(caller_id, callee_id);
