
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  member_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_members (
  community_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View memberships" ON public.community_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Join community" ON public.community_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave community" ON public.community_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Public communities visible to all" ON public.communities
  FOR SELECT TO authenticated USING (
    is_public = true OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid())
  );
CREATE POLICY "Create communities" ON public.communities
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator updates community" ON public.communities
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Creator deletes community" ON public.communities
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_community()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_members(community_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_new_community AFTER INSERT ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_community();

CREATE OR REPLACE FUNCTION public.update_community_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_community_count AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.update_community_count();
