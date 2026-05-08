-- Allow 'call' as a message type and add call metadata column
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS call_id uuid;

-- Helper to insert a call summary into the 1:1 conversation between two users
CREATE OR REPLACE FUNCTION public.find_or_create_dm(_a uuid, _b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  IF _a = _b THEN
    -- self chat
    SELECT c.id INTO conv_id
    FROM public.conversations c
    JOIN public.conversation_participants p ON p.conversation_id = c.id
    WHERE c.is_group = false AND c.created_by = _a
    GROUP BY c.id
    HAVING COUNT(p.user_id) = 1 AND BOOL_AND(p.user_id = _a)
    LIMIT 1;

    IF conv_id IS NULL THEN
      INSERT INTO public.conversations (created_by, is_group, name)
      VALUES (_a, false, 'Message yourself')
      RETURNING id INTO conv_id;
      INSERT INTO public.conversation_participants (conversation_id, user_id, role)
      VALUES (conv_id, _a, 'member');
    END IF;
    RETURN conv_id;
  END IF;

  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = _a
  JOIN public.conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = _b
  WHERE c.is_group = false
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (created_by, is_group)
    VALUES (_a, false)
    RETURNING id INTO conv_id;
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (conv_id, _a, 'member'), (conv_id, _b, 'member');
  END IF;

  RETURN conv_id;
END;
$$;

-- Trigger: when a call ends/is missed/rejected, insert a system message into the DM
CREATE OR REPLACE FUNCTION public.log_call_into_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  body text;
BEGIN
  IF NEW.status NOT IN ('ended','missed','rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  conv_id := public.find_or_create_dm(NEW.caller_id, NEW.callee_id);

  body := CASE
    WHEN NEW.status = 'missed' THEN 'Missed ' || NEW.call_type || ' call'
    WHEN NEW.status = 'rejected' THEN 'Declined ' || NEW.call_type || ' call'
    WHEN NEW.duration_seconds > 0 THEN
      NEW.call_type || ' call · ' ||
      to_char((NEW.duration_seconds || ' seconds')::interval, 'HH24:MI:SS')
    ELSE NEW.call_type || ' call'
  END;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, call_id)
  VALUES (conv_id, NEW.caller_id, body, 'call', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_call_into_chat ON public.calls;
CREATE TRIGGER trg_log_call_into_chat
  AFTER UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.log_call_into_chat();