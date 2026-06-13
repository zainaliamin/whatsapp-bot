const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    data: null
  }
});

const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 70,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.apiUser?.id || req.user?.id || req.ip),
  message: {
    success: false,
    message: "Rate limit exceeded: maximum 70 messages per minute",
    data: null
  }
});

module.exports = {
  apiLimiter,
  messageRateLimiter
};
