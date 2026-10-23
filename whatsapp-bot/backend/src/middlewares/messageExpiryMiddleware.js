const { ApiError } = require("../utils/ApiError");
const userRepository = require("../repositories/userRepository");

async function enforceMessageExpiry(req, _res, next) {
  let user = req.apiUser || req.user;

  if (!user) {
    return next(new ApiError(401, "Unauthorized", {
      code: "UNAUTHORIZED"
    }));
  }

  try {
    const userId = user.id || user.userId;
    if (!user.messageExpiryDate && userId) {
      const freshUser = await userRepository.findById(userId);
      user = {
        ...user,
        messageExpiryDate: freshUser?.message_expiry_date
      };
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
  } catch (err) {
    return next(err);
  }
}

module.exports = { enforceMessageExpiry };
