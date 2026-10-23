const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const { env } = require("../config/env");
const { logger } = require("../config/logger");
const { ROLES } = require("../utils/constants");

async function ensureDefaultAdmin() {
  const existing = await userRepository.findByEmail(env.adminEmail);
  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash(env.adminPassword, 10);
  await userRepository.createUser({
    name: "System Admin",
    email: env.adminEmail,
    password: hashedPassword,
    role: ROLES.ADMIN,
    messageExpiryDate: null
  });

  logger.info({ email: env.adminEmail }, "Default admin account created");
}

module.exports = {
  ensureDefaultAdmin
};
