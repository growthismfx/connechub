-- Re-grant the DM helper to authenticated users (it's invoked from the client to create self-chat)
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, uuid) TO authenticated;