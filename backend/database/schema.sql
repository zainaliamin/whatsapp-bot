CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  message_expiry_date DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  status ENUM('CREATED', 'QR_READY', 'CONNECTED', 'READY', 'DISCONNECTED') NOT NULL DEFAULT 'CREATED',
  session_path VARCHAR(255) NULL,
  session_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  recipient_number VARCHAR(30) NOT NULL,
  message_type ENUM('TEXT', 'IMAGE') NOT NULL,
  content JSON NOT NULL,
  source_application VARCHAR(120) NOT NULL,
  message_status ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_messages_user_created (user_id, created_at),
  INDEX idx_messages_status (message_status)
);

CREATE TABLE IF NOT EXISTS whatsapp_number_checks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  whatsapp_jid VARCHAR(80) NULL,
  is_on_whatsapp TINYINT(1) NOT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uniq_number_checks_user_phone (user_id, phone_number),
  INDEX idx_number_checks_expires_at (expires_at),
  CONSTRAINT fk_number_checks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
