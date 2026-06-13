const express = require("express");
const messageController = require("../controllers/messageController");
const { validate } = require("../middlewares/validationMiddleware");
const { sendTextSchema, sendImageSchema } = require("../models/messageSchemas");
const { requireApiToken } = require("../middlewares/apiTokenMiddleware");
const { requireAuth } = require("../middlewares/authMiddleware");
const { messageRateLimiter } = require("../middlewares/rateLimitMiddleware");
const { enforceMessageExpiry } = require("../middlewares/messageExpiryMiddleware");

const router = express.Router();

router.post(
  "/send-text",
  requireApiToken,
  enforceMessageExpiry,
  messageRateLimiter,
  validate(sendTextSchema),
  messageController.sendText
);

router.post(
  "/send-image",
  requireApiToken,
  enforceMessageExpiry,
  messageRateLimiter,
  validate(sendImageSchema),
  messageController.sendImage
);

router.get("/my", requireAuth, messageController.myMessages);
router.get("/stats", requireAuth, messageController.myMessageStats);

module.exports = router;
