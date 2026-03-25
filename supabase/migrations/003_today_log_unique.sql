-- Required for today_log upsert with onConflict: user_id,log_date
-- Run in Supabase SQL editor if save shows:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"

CREATE UNIQUE INDEX IF NOT EXISTS today_log_user_id_log_date_key
  ON today_log (user_id, log_date);
