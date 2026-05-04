
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = COALESCE(NEW.content, '[media]'), last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_participant(UUID, UUID) FROM PUBLIC, anon;

-- Tighten participants insert: only the creator of the conversation, or a user adding themselves
DROP POLICY "Add participants" ON public.conversation_participants;
CREATE POLICY "Add participants"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );

-- Make chat-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

DROP POLICY "Public can view media" ON storage.objects;
DROP POLICY "Authenticated users can upload media" ON storage.objects;

CREATE POLICY "Authenticated can view chat media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated can upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
