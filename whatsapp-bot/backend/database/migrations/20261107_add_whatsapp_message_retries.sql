-- Apply before deploying the retry-enabled backend. Existing message logs are unchanged.
CREATE TABLE IF NOT EXISTS whatsapp_message_retries (
  user_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  session_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  whatsapp_message_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  remote_jid VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  message_log_id BIGINT NOT NULL,
  message_payload MEDIUMBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, client_id, session_id, whatsapp_message_id),
  INDEX idx_whatsapp_retries_expiry (expires_at),
  CONSTRAINT fk_whatsapp_retries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_whatsapp_retries_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_whatsapp_retries_message FOREIGN KEY (message_log_id) REFERENCES messages(id) ON DELETE CASCADE
);
