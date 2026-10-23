-- Add LOGOUT to the clients.status ENUM so it matches the backend CLIENT_STATUS constants.
ALTER TABLE clients
  MODIFY COLUMN status ENUM('CREATED', 'QR_READY', 'CONNECTED', 'READY', 'LOGOUT', 'DISCONNECTED') NOT NULL DEFAULT 'CREATED';
