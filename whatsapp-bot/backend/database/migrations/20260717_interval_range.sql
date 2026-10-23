-- Rename the existing send_interval_minutes column to send_interval_min_minutes
ALTER TABLE bulk_queue_status
  CHANGE send_interval_minutes send_interval_min_minutes INT UNSIGNED NOT NULL DEFAULT 2;

-- Add the new send_interval_max_minutes column
ALTER TABLE bulk_queue_status
  ADD COLUMN send_interval_max_minutes INT UNSIGNED NOT NULL DEFAULT 5 AFTER send_interval_min_minutes;
