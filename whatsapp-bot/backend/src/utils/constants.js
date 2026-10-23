const ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user"
});

const CLIENT_STATUS = Object.freeze({
  CREATED: "CREATED",
  QR_READY: "QR_READY",
  CONNECTED: "CONNECTED",
  READY: "READY",
  LOGOUT: "LOGOUT",
  DISCONNECTED: "DISCONNECTED"
});

const MESSAGE_STATUS = Object.freeze({
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED"
});

const MESSAGE_TYPE = Object.freeze({
  TEXT: "TEXT",
  IMAGE: "IMAGE"
});

module.exports = {
  ROLES,
  CLIENT_STATUS,
  MESSAGE_STATUS,
  MESSAGE_TYPE
};
