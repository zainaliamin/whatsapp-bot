const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "whatsapp_saas",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || ""
  },
  jwtSecret: process.env.JWT_SECRET || "change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@123"
};

module.exports = { env };
