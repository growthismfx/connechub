
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  username TEXT UNIQUE,
  assigned_number TEXT UNIQUE,
  country_code TEXT DEFAULT '+1',
  avatar_url TEXT,
  status TEXT DEFAULT 'Hey there! I am using the app.',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup with assigned number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_number TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_number := LPAD(floor(random() * 10000000000)::TEXT, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE assigned_number = new_number) OR attempts > 10;
    attempts := attempts + 1;
  END LOOP;

  INSERT INTO public.profiles (id, name, avatar_url, assigned_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url',
    new_number
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT false,
  name TEXT,
  created_by UUID REFERENCES auth.users(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Helper function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_participant(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conv AND user_id = _user);
$$;

CREATE POLICY "View own conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_participant(id, auth.uid()));

CREATE POLICY "Create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Update own conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_participant(id, auth.uid()));

CREATE POLICY "View own participation"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_participant(conversation_id, auth.uid()));

CREATE POLICY "Add participants"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (true);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  media_url TEXT,
  message_type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'sent',
  reply_to UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages in own conversations"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()));

CREATE POLICY "Send messages in own conversations"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));

CREATE POLICY "Update own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- Update conversation last_message on new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = COALESCE(NEW.content, '[media]'), last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Public can view media"
  ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'chat-media');
