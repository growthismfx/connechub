ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS encrypted_keys jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS iv text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false;