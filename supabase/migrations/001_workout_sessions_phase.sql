-- Run in Supabase SQL editor (or supabase db push) before relying on
-- workout_sessions upsert with onConflict: user_id,session_date,day_idx,phase

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'hypertrophy';

-- Drop legacy unique constraint if present (name may vary — check Table Editor → constraints)
ALTER TABLE workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_user_id_session_date_day_idx_key;

CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_user_date_day_phase
  ON workout_sessions (user_id, session_date, day_idx, phase);
