const clientService = require("../services/clientService");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const createClient = asyncHandler(async (req, res) => {
  const data = await clientService.createClient(req.user.id);
  return sendSuccess(res, "Client creation started. Scan QR via socket events.", data, 201);
});

const getStatus = asyncHandler(async (req, res) => {
  const data = await clientService.getClientStatus(req.user.id);
  return sendSuccess(res, "Client status fetched", data);
});

const logoutClient = asyncHandler(async (req, res) => {
  await clientService.logoutClient(req.user.id);
  return sendSuccess(res, "Client logged out", null);
});

const deleteClient = asyncHandler(async (req, res) => {
  await clientService.deleteClient(req.user.id);
  return sendSuccess(res, "Client deleted", null);
});

module.exports = {
  createClient,
  getStatus,
  logoutClient,
  deleteClient
};
