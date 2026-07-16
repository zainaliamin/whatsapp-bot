-- Run once on existing installations before deploying the per-user bulk interval feature.
ALTER TABLE bulk_queue_status
  ADD COLUMN send_interval_minutes INT UNSIGNED NOT NULL DEFAULT 1 AFTER next_send_time;
