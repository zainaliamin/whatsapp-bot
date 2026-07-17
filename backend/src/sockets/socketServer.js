const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/token");
const { logger } = require("../config/logger");

let io;

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Socket auth token is required"));
      }

      const payload = verifyAccessToken(token);
      socket.user = payload;
      return next();
    } catch (_err) {
      return next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const room = `user:${socket.user.id}`;
    socket.join(room);
    logger.info({ userId: socket.user.id }, "Socket connected");

    socket.emit("socket:connected", { success: true, message: "Socket connected" });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.user.id }, "Socket disconnected");
    });
  });

  return io;
}

function emitToUser(userId, eventName, payload) {
  if (!io) {
    return;
  }
  io.to(`user:${userId}`).emit(eventName, payload);
}

function getIO() {
  return io;
}

module.exports = {
  initSocketServer,
  emitToUser,
  getIO
};
