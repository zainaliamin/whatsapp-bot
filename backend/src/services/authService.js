const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const { signAccessToken } = require("../utils/token");
const { ApiError } = require("../utils/ApiError");
const { ROLES } = require("../utils/constants");

async function register({ name, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await userRepository.createUser({
    name,
    email,
    password: hashedPassword,
    role: ROLES.USER
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

module.exports = {
  register,
  login
};
