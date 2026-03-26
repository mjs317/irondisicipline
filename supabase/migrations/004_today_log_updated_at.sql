-- Optional: enables conflict resolution with local-device draft backup (compare to server write time).
ALTER TABLE today_log
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
