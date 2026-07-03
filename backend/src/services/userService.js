const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const { clientManager } = require("../baileys/clientManager");
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

async function deleteUser(userId, actorUserId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (Number(userId) === Number(actorUserId)) {
    throw new ApiError(400, "You cannot delete your own admin account");
  }

  if (user.role === ROLES.ADMIN) {
    const adminCount = await userRepository.countAdmins();
    if (adminCount <= 1) {
      throw new ApiError(400, "Cannot delete the last admin account");
    }
  }

  await clientManager.removeClient(userId);

  const deleted = await userRepository.deleteUser(userId);
  if (!deleted) {
    throw new ApiError(404, "User not found");
  }
}

async function updateUser(userId, updates, actorUserId = null) {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw new ApiError(404, "User not found");
  }

  if (
    updates.role !== undefined &&
    existing.role === ROLES.ADMIN &&
    updates.role !== ROLES.ADMIN
  ) {
    if (Number(userId) === Number(actorUserId)) {
      throw new ApiError(400, "You cannot remove your own admin role");
    }

    const adminCount = await userRepository.countAdmins();
    if (adminCount <= 1) {
      throw new ApiError(400, "Cannot remove the last admin account");
    }
  }

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

async function resetUserPasswordByAdmin(userId, { newPassword }) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await userRepository.updateUser(userId, { password: hashed });
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
  resetUserPasswordByAdmin,
  updateSelfProfile,
  changePassword
};
