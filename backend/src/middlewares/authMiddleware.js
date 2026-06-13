const { verifyAccessToken } = require("../utils/token");
const { ApiError } = require("../utils/ApiError");
const { ROLES } = require("../utils/constants");

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, "Authorization token is required"));
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (_err) {
    return next(new ApiError(401, "Invalid or expired token"));
  }
}

function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    if (req.user.role !== role) {
      return next(new ApiError(403, "Forbidden: insufficient privileges"));
    }

    return next();
  };
}

const requireAdmin = requireRole(ROLES.ADMIN);

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin
};
