-- Allow message recipients (conversation participants) to update delivery and read receipts
DROP POLICY IF EXISTS "Update own messages" ON public.messages;

CREATE POLICY "Sender updates own messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Participants update delivery and read"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id <> auth.uid() AND is_participant(conversation_id, auth.uid()))
WITH CHECK (sender_id <> auth.uid() AND is_participant(conversation_id, auth.uid()));