const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const { ApiError } = require("../utils/ApiError");
const { ROLES } = require("../utils/constants");

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    messageExpiryDate: user.message_expiry_date,
    createdAt: user.created_at
  };
}

async function createUserByAdmin({ name, email, password, role = ROLES.USER, messageExpiryDate = null }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await userRepository.createUser({
    name,
    email,
    password: hashedPassword,
    role,
    messageExpiryDate
  });

  return user;
}

async function listUsers() {
  return userRepository.listUsers();
}

async function deleteUser(userId) {
  const deleted = await userRepository.deleteUser(userId);
  if (!deleted) {
    throw new ApiError(404, "User not found");
  }
}

async function updateUser(userId, updates) {
  const user = await userRepository.updateUser(userId, updates);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    messageExpiryDate: user.message_expiry_date,
    createdAt: user.created_at
  };
}

async function updateSelfProfile(userId, { name }) {
  const user = await userRepository.updateUser(userId, { name });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await userRepository.updateUser(userId, { password: hashed });
}

module.exports = {
  getProfile,
  createUserByAdmin,
  listUsers,
  deleteUser,
  updateUser,
  updateSelfProfile,
  changePassword
};
