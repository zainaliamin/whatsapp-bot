const { ApiError } = require("../utils/ApiError");

function enforceMessageExpiry(req, _res, next) {
  const user = req.apiUser || req.user;

  if (!user) {
    return next(new ApiError(401, "Unauthorized", {
      code: "UNAUTHORIZED"
    }));
  }

  if (!user.messageExpiryDate) {
    return next(new ApiError(403, "Messaging is disabled for this account. Contact admin to get access.", {
      code: "MESSAGING_DISABLED"
    }));
  }

  if (new Date(user.messageExpiryDate) < new Date()) {
    return next(new ApiError(403, "Messaging is disabled for this account (expired). Contact admin to renew access.", {
      code: "MESSAGING_EXPIRED",
      messageExpiryDate: user.messageExpiryDate
    }));
  }

  return next();
}

module.exports = { enforceMessageExpiry };
