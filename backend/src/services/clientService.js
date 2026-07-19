const path = require("path");
const clientRepository = require("../repositories/clientRepository");
const tokenService = require("./tokenService");
const { clientManager } = require("../baileys/clientManager");
const { ApiError } = require("../utils/ApiError");
const { CLIENT_STATUS } = require("../utils/constants");

async function createClient(userId) {
  const sessionPath = path.join(process.cwd(), "sessions", `user-${userId}`);
  const existing = await clientRepository.findByUserId(userId);
  if (existing) {
    if (![CLIENT_STATUS.CREATED, CLIENT_STATUS.QR_READY, CLIENT_STATUS.DISCONNECTED, CLIENT_STATUS.LOGOUT].includes(existing.status)) {
      throw new ApiError(409, "User already has an active WhatsApp client.");
    }

    clientManager.resetSessionFiles(userId, sessionPath);
    await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.CREATED);
    await clientManager.initClient(userId, existing.id, sessionPath, {
      allowPairing: true,
      force: true,
      resetAutoReconnectFailures: true
    });

    return {
      id: existing.id,
      userId,
      status: CLIENT_STATUS.CREATED
    };
  }

  const created = await clientRepository.createClient({
    userId,
    status: CLIENT_STATUS.CREATED,
    sessionPath
  });

  await clientManager.initClient(userId, created.id, sessionPath, {
    allowPairing: true,
    resetAutoReconnectFailures: true
  });

  return {
    id: created.id,
    userId,
    status: CLIENT_STATUS.CREATED
  };
}

async function getClientStatus(userId) {
  const client = await clientRepository.findByUserId(userId);
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return client;
}

async function logoutClient(userId) {
  const client = await clientRepository.findByUserId(userId);
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  await clientManager.logoutClient(userId);
  await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.DISCONNECTED);
  await tokenService.revokeUserToken(userId);

  return { success: true };
}

async function deleteClient(userId) {
  const client = await clientRepository.findByUserId(userId);
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  await clientManager.removeClient(userId);
  await clientRepository.deleteByUserId(userId);
  await tokenService.revokeUserToken(userId);

  return { success: true };
}

module.exports = {
  createClient,
  getClientStatus,
  logoutClient,
  deleteClient
};
