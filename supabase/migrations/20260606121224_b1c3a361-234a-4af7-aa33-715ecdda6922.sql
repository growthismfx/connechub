CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message = CASE
        WHEN NEW.is_encrypted THEN '🔒 Encrypted message'
        ELSE COALESCE(NEW.content, '[media]')
      END,
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;