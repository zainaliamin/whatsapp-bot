-- Allow the bulk worker to temporarily lock one queue row while it sends.
ALTER TABLE bulk_message_queue
  MODIFY status ENUM('PENDING', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING';
