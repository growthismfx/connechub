
DROP POLICY IF EXISTS "View own conversations" ON public.conversations;
CREATE POLICY "View own conversations" ON public.conversations
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_participant(id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_user, to_user)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own requests" ON public.friend_requests FOR SELECT TO authenticated USING (from_user = auth.uid() OR to_user = auth.uid());
CREATE POLICY "Send requests" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid());
CREATE POLICY "Recipient updates request" ON public.friend_requests FOR UPDATE TO authenticated USING (to_user = auth.uid());
CREATE POLICY "Either party deletes" ON public.friend_requests FOR DELETE TO authenticated USING (from_user = auth.uid() OR to_user = auth.uid());

ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

CREATE POLICY "Admins remove participants" ON public.conversation_participants
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid() AND cp.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Add participants" ON public.conversation_participants;
CREATE POLICY "Add participants" ON public.conversation_participants
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid() AND cp.role = 'admin'
  )
);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "Manage own blocks" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "Remove own blocks" ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_last_seen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_profile_photo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
