ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS music_start_seconds numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS mute_original boolean DEFAULT false;