const userService = require("../services/userService");
const reportService = require("../services/reportService");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUserByAdmin(req.body);
  return sendSuccess(res, "User created", user, 201);
});

const listUsers = asyncHandler(async (_req, res) => {
  const users = await userService.listUsers();
  return sendSuccess(res, "Users fetched", users);
});

const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(Number(req.params.userId));
  return sendSuccess(res, "User deleted", null);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(Number(req.params.userId), req.body);
  return sendSuccess(res, "User updated", user);
});

const getReport = asyncHandler(async (_req, res) => {
  const report = await reportService.getAdminReport();
  return sendSuccess(res, "Admin report fetched", report);
});

module.exports = {
  createUser,
  listUsers,
  deleteUser,
  updateUser,
  getReport
};
