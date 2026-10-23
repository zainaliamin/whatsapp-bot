const { ApiError } = require("../utils/ApiError");
const tokenService = require("../services/tokenService");

async function requireApiToken(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, "API token is required", {
      code: "API_TOKEN_REQUIRED"
    }));
  }

  const apiUser = await tokenService.getUserByApiToken(token);
  if (!apiUser) {
    return next(new ApiError(401, "Invalid API token", {
      code: "INVALID_API_TOKEN"
    }));
  }

  req.apiUser = apiUser;
  return next();
}

module.exports = { requireApiToken };
