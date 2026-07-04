
-- SERVERS
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  banner_url text,
  is_public boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- SERVER MEMBERS
CREATE TABLE public.server_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(server_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_members TO authenticated;
GRANT ALL ON public.server_members TO service_role;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- helper: is member
CREATE OR REPLACE FUNCTION public.is_server_member(_server uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.server_members WHERE server_id=_server AND user_id=_user);
$$;

CREATE OR REPLACE FUNCTION public.is_server_owner(_server uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.servers WHERE id=_server AND owner_id=_user);
$$;

-- SERVER ROLES
CREATE TABLE public.server_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#99AAB5',
  position int NOT NULL DEFAULT 0,
  permissions bigint NOT NULL DEFAULT 0,
  hoist boolean NOT NULL DEFAULT false,
  mentionable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_roles TO authenticated;
GRANT ALL ON public.server_roles TO service_role;
ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.server_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  UNIQUE(server_id, user_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_role_assignments TO authenticated;
GRANT ALL ON public.server_role_assignments TO service_role;
ALTER TABLE public.server_role_assignments ENABLE ROW LEVEL SECURITY;

-- SERVER CHANNELS
CREATE TABLE public.server_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic text,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','voice','announcement')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_channels TO authenticated;
GRANT ALL ON public.server_channels TO service_role;
ALTER TABLE public.server_channels ENABLE ROW LEVEL SECURITY;

-- CHANNEL MESSAGES
CREATE TABLE public.channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.server_channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  reply_to uuid REFERENCES public.channel_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_messages TO authenticated;
GRANT ALL ON public.channel_messages TO service_role;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_channel_messages_channel_created ON public.channel_messages(channel_id, created_at DESC);

-- VOICE PARTICIPANTS
CREATE TABLE public.voice_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.server_channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted boolean NOT NULL DEFAULT false,
  deafened boolean NOT NULL DEFAULT false,
  video_on boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_participants TO authenticated;
GRANT ALL ON public.voice_participants TO service_role;
ALTER TABLE public.voice_participants ENABLE ROW LEVEL SECURITY;

-- SERVER EMOJIS
CREATE TABLE public.server_emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_emojis TO authenticated;
GRANT ALL ON public.server_emojis TO service_role;
ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

-- POLICIES: servers
CREATE POLICY "View public or joined servers" ON public.servers FOR SELECT TO authenticated
  USING (is_public OR public.is_server_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "Create server" ON public.servers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner update server" ON public.servers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner delete server" ON public.servers FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- POLICIES: server_members
CREATE POLICY "Members view members" ON public.server_members FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Join server (self)" ON public.server_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own membership" ON public.server_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or owner-kick" ON public.server_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_server_owner(server_id, auth.uid()));

-- POLICIES: server_roles
CREATE POLICY "Members view roles" ON public.server_roles FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Owner manage roles" ON public.server_roles FOR ALL TO authenticated
  USING (public.is_server_owner(server_id, auth.uid())) WITH CHECK (public.is_server_owner(server_id, auth.uid()));

-- POLICIES: role assignments
CREATE POLICY "Members view assignments" ON public.server_role_assignments FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Owner manage assignments" ON public.server_role_assignments FOR ALL TO authenticated
  USING (public.is_server_owner(server_id, auth.uid())) WITH CHECK (public.is_server_owner(server_id, auth.uid()));

-- POLICIES: channels
CREATE POLICY "Members view channels" ON public.server_channels FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Owner manage channels" ON public.server_channels FOR ALL TO authenticated
  USING (public.is_server_owner(server_id, auth.uid())) WITH CHECK (public.is_server_owner(server_id, auth.uid()));

-- POLICIES: channel messages
CREATE POLICY "Members view messages" ON public.channel_messages FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Members post messages" ON public.channel_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Author update own" ON public.channel_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Author or owner delete" ON public.channel_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_server_owner(server_id, auth.uid()));

-- POLICIES: voice
CREATE POLICY "Members view voice" ON public.voice_participants FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Join voice self" ON public.voice_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Update own voice" ON public.voice_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave voice self" ON public.voice_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- POLICIES: emojis
CREATE POLICY "Members view emojis" ON public.server_emojis FOR SELECT TO authenticated
  USING (public.is_server_member(server_id, auth.uid()));
CREATE POLICY "Owner manage emojis" ON public.server_emojis FOR ALL TO authenticated
  USING (public.is_server_owner(server_id, auth.uid())) WITH CHECK (public.is_server_owner(server_id, auth.uid()));

-- Bootstrap: owner becomes member + default channel/role
CREATE OR REPLACE FUNCTION public.bootstrap_new_server()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch_id uuid;
BEGIN
  INSERT INTO public.server_members(server_id, user_id) VALUES (NEW.id, NEW.owner_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.server_roles(server_id, name, color, position, permissions)
    VALUES (NEW.id, '@everyone', '#99AAB5', 0, 0);
  INSERT INTO public.server_channels(server_id, name, type, position) VALUES
    (NEW.id, 'general', 'text', 0),
    (NEW.id, 'voice', 'voice', 1);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bootstrap_server AFTER INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_new_server();

-- Update member_count
CREATE OR REPLACE FUNCTION public.update_server_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE public.servers SET member_count = member_count + 1 WHERE id = NEW.server_id;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.servers SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.server_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_server_member_count AFTER INSERT OR DELETE ON public.server_members
  FOR EACH ROW EXECUTE FUNCTION public.update_server_member_count();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
