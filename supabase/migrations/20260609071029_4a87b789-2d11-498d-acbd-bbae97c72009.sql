
-- ============ STORIES upgrades ============
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS story_type text NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocked_user_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_replies boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reactions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_sharing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS music_url text,
  ADD COLUMN IF NOT EXISTS music_title text,
  ADD COLUMN IF NOT EXISTS music_artist text,
  ADD COLUMN IF NOT EXISTS music_thumbnail text,
  ADD COLUMN IF NOT EXISTS poll_question text,
  ADD COLUMN IF NOT EXISTS poll_options jsonb,
  ADD COLUMN IF NOT EXISTS question_prompt text,
  ADD COLUMN IF NOT EXISTS quiz_options jsonb,
  ADD COLUMN IF NOT EXISTS quiz_correct_index int,
  ADD COLUMN IF NOT EXISTS countdown_end timestamptz,
  ADD COLUMN IF NOT EXISTS countdown_title text,
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS mentions uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_title text,
  ADD COLUMN IF NOT EXISTS repost_of uuid,
  ADD COLUMN IF NOT EXISTS layers jsonb,
  ADD COLUMN IF NOT EXISTS is_highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_id uuid;

CREATE TABLE IF NOT EXISTS public.close_friends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
GRANT SELECT, INSERT, DELETE ON public.close_friends TO authenticated;
GRANT ALL ON public.close_friends TO service_role;
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own close friends" ON public.close_friends FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Helper: can the current user view this story?
CREATE OR REPLACE FUNCTION public.can_view_story(_status public.statuses)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status.user_id = auth.uid() THEN RETURN true; END IF;
  IF auth.uid() = ANY(COALESCE(_status.blocked_user_ids,'{}')) THEN RETURN false; END IF;
  IF _status.privacy = 'everyone' THEN RETURN true; END IF;
  IF _status.privacy = 'selected' OR _status.privacy = 'custom' THEN
    RETURN auth.uid() = ANY(COALESCE(_status.allowed_user_ids,'{}'));
  END IF;
  IF _status.privacy = 'close' THEN
    RETURN EXISTS (SELECT 1 FROM public.close_friends WHERE user_id = _status.user_id AND friend_id = auth.uid());
  END IF;
  IF _status.privacy = 'contacts' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.conversation_participants p1
      JOIN public.conversation_participants p2 ON p1.conversation_id = p2.conversation_id
      WHERE p1.user_id = _status.user_id AND p2.user_id = auth.uid() AND p1.user_id <> p2.user_id
    );
  END IF;
  RETURN false;
END $$;

DROP POLICY IF EXISTS "Statuses are viewable by everyone" ON public.statuses;
DROP POLICY IF EXISTS "statuses_select" ON public.statuses;
CREATE POLICY "statuses_select_visible" ON public.statuses FOR SELECT TO authenticated
  USING (public.can_view_story(statuses.*));

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "react own" ON public.story_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner sees reactions" ON public.story_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.story_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.story_replies TO authenticated;
GRANT ALL ON public.story_replies TO service_role;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reply own" ON public.story_replies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reply visible to owner or self" ON public.story_replies FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.story_poll_votes (
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_poll_votes TO authenticated;
GRANT ALL ON public.story_poll_votes TO service_role;
ALTER TABLE public.story_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vote own" ON public.story_poll_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner sees votes" ON public.story_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.story_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_highlights TO authenticated;
GRANT ALL ON public.story_highlights TO service_role;
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlights public read" ON public.story_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "highlights own write" ON public.story_highlights FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "highlights own update" ON public.story_highlights FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "highlights own delete" ON public.story_highlights FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ NOTES (Instagram-style) ============
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  emoji text,
  music_url text,
  music_title text,
  audience text NOT NULL DEFAULT 'contacts',
  mentions uuid[] DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes visible" ON public.notes FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (audience = 'everyone' AND expires_at > now())
  OR (audience = 'contacts' AND expires_at > now() AND EXISTS (
      SELECT 1 FROM public.conversation_participants p1
      JOIN public.conversation_participants p2 ON p1.conversation_id = p2.conversation_id
      WHERE p1.user_id = notes.user_id AND p2.user_id = auth.uid() AND p1.user_id <> p2.user_id))
  OR (audience = 'close' AND expires_at > now() AND EXISTS (
      SELECT 1 FROM public.close_friends WHERE user_id = notes.user_id AND friend_id = auth.uid()))
);
CREATE POLICY "notes own write" ON public.notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notes own update" ON public.notes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notes own delete" ON public.notes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.note_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.note_reactions TO authenticated;
GRANT ALL ON public.note_reactions TO service_role;
ALTER TABLE public.note_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note react own" ON public.note_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "note owner sees reactions" ON public.note_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid()));

-- ============ MESSAGING upgrades ============
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_from_id uuid,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS sent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_silent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_destruct_seconds int,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg react participant" ON public.message_reactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid()))
);
CREATE POLICY "msg react own write" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_participant(m.conversation_id, auth.uid()))
);
CREATE POLICY "msg react own delete" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_pins (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, message_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_pins TO authenticated;
GRANT ALL ON public.message_pins TO service_role;
ALTER TABLE public.message_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pin participants" ON public.message_pins FOR ALL TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_participant(conversation_id, auth.uid()) AND pinned_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.chat_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_folders TO authenticated;
GRANT ALL ON public.chat_folders TO service_role;
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folders" ON public.chat_folders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.chat_folder_items (
  folder_id uuid NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, conversation_id)
);
GRANT SELECT, INSERT, DELETE ON public.chat_folder_items TO authenticated;
GRANT ALL ON public.chat_folder_items TO service_role;
ALTER TABLE public.chat_folder_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folder items" ON public.chat_folder_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_folders f WHERE f.id = folder_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_folders f WHERE f.id = folder_id AND f.user_id = auth.uid()));

-- ============ PROFILE additions ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS profile_music_url text,
  ADD COLUMN IF NOT EXISTS profile_music_title text,
  ADD COLUMN IF NOT EXISTS profile_theme text,
  ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS achievements jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wallpaper_url text;

-- ============ THEMES ============
CREATE TABLE IF NOT EXISTS public.user_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  tokens jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_themes TO authenticated;
GRANT ALL ON public.user_themes TO service_role;
ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes own or public" ON public.user_themes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);
CREATE POLICY "themes own write" ON public.user_themes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "themes own update" ON public.user_themes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "themes own delete" ON public.user_themes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ SECURITY ============
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name text,
  user_agent text,
  platform text,
  ip text,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices" ON public.user_devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  recovery_codes text[] DEFAULT '{}',
  passcode_hash text,
  passcode_enabled boolean NOT NULL DEFAULT false,
  biometric_credentials jsonb DEFAULT '[]'::jsonb,
  login_alerts_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_security TO authenticated;
GRANT ALL ON public.user_security TO service_role;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security" ON public.user_security FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.login_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  device text,
  ip text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_alerts TO authenticated;
GRANT ALL ON public.login_alerts TO service_role;
ALTER TABLE public.login_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.login_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own alerts write" ON public.login_alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_poll_votes;
