
-- Avatars bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Per-user chat preferences
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- Allow updating these per-user fields (currently UPDATE is not allowed)
CREATE POLICY "Users update own participation"
ON public.conversation_participants FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Starred messages
CREATE TABLE IF NOT EXISTS public.starred_messages (
  user_id uuid NOT NULL,
  message_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own stars" ON public.starred_messages
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Star messages" ON public.starred_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Unstar messages" ON public.starred_messages
  FOR DELETE USING (user_id = auth.uid());

-- Per-chat lock (PIN hashed client side; we just store the hash + salt)
CREATE TABLE IF NOT EXISTS public.chat_locks (
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
ALTER TABLE public.chat_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own chat locks" ON public.chat_locks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Helper: are two users blocked either way?
CREATE OR REPLACE FUNCTION public.are_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

-- Status view counter helper
CREATE OR REPLACE FUNCTION public.get_status_views(_status_id uuid)
RETURNS TABLE (viewer_id uuid, viewed_at timestamptz, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sv.viewer_id, sv.viewed_at, p.name, p.avatar_url
  FROM public.status_views sv
  JOIN public.profiles p ON p.id = sv.viewer_id
  WHERE sv.status_id = _status_id
    AND EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = _status_id AND s.user_id = auth.uid())
  ORDER BY sv.viewed_at DESC;
$$;
