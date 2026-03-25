-- Coach context saved with each session and updated on today_log for AI prompts.
-- Run in Supabase SQL editor if columns don't exist yet.

ALTER TABLE today_log
  ADD COLUMN IF NOT EXISTS coach_context jsonb DEFAULT '{}'::jsonb;

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS coach_context jsonb DEFAULT '{}'::jsonb;
