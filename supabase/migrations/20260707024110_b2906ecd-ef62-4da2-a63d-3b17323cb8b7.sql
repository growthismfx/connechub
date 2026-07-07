CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message = CASE
        WHEN NEW.deleted_for_everyone THEN 'This message was deleted'
        WHEN NEW.message_type = 'image' THEN '📷 Photo'
        WHEN NEW.message_type = 'video' THEN '🎬 Video'
        WHEN NEW.message_type = 'audio' THEN '🎙 Voice message'
        WHEN NEW.message_type = 'file'  THEN '📎 File'
        WHEN NEW.message_type = 'call'  THEN COALESCE(NEW.content, 'Call')
        WHEN COALESCE(NEW.content,'') <> '' THEN NEW.content
        ELSE 'New message'
      END,
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;