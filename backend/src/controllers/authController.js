const authService = require("../services/authService");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return sendSuccess(res, "User registered successfully", user, 201);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(
    res,
    "Login successful",
    {
      accessToken: result.accessToken,
      userId: result.user.id,
      role: result.user.role,
      user: result.user
    },
    200
  );
});

module.exports = {
  register,
  login
};
