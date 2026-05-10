DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='statuses') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='status_views') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.status_views';
  END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.statuses REPLICA IDENTITY FULL;