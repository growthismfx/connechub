CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view posts" ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id
        AND (c.is_public = true OR c.created_by = auth.uid()
             OR EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Members create posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_posts.community_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Author updates post" ON public.community_posts
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Author or admin deletes post" ON public.community_posts
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.created_by = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;