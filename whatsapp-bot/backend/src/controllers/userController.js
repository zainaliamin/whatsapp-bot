const userService = require("../services/userService");
const tokenService = require("../services/tokenService");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);
  return sendSuccess(res, "Profile fetched", profile);
});

const getMyApiToken = asyncHandler(async (req, res) => {
  const token = await tokenService.getTokenByUserId(req.user.id);
  return sendSuccess(res, "API token fetched", token);
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
  }
  const user = await userService.updateSelfProfile(req.user.id, { name: name.trim() });
  return sendSuccess(res, "Profile updated", user);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Both currentPassword and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
  }
  await userService.changePassword(req.user.id, { currentPassword, newPassword });
  return sendSuccess(res, "Password changed successfully", null);
});

module.exports = {
  getProfile,
  getMyApiToken,
  updateProfile,
  changePassword
};
