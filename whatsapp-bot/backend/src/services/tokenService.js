const apiTokenRepository = require("../repositories/apiTokenRepository");
const { generateApiToken } = require("../utils/token");

async function createOrRotateUserToken(userId) {
  const token = generateApiToken();
  await apiTokenRepository.upsertToken(userId, token);
  return token;
}

async function getOrCreateUserToken(userId) {
  const existing = await apiTokenRepository.findByUserId(userId);
  if (existing?.token) {
    return existing.token;
  }

  return createOrRotateUserToken(userId);
}

async function getTokenByUserId(userId) {
  return apiTokenRepository.findByUserId(userId);
}

async function getUserByApiToken(token) {
  return apiTokenRepository.findByToken(token);
}

async function revokeUserToken(userId) {
  return apiTokenRepository.deleteByUserId(userId);
}

module.exports = {
  createOrRotateUserToken,
  getOrCreateUserToken,
  getTokenByUserId,
  getUserByApiToken,
  revokeUserToken
};
