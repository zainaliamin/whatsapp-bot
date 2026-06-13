const messageService = require("../services/messageService");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const sendText = asyncHandler(async (req, res) => {
  const userId = req.apiUser?.userId || req.user?.id || req.apiUser?.id;
  const data = await messageService.sendTextMessage({
    userId,
    recipientNumber: req.body.recipientNumber,
    messageText: req.body.messageText,
    sourceApplication: req.body.sourceApplication
  });

  return sendSuccess(res, "Text message sent", data, 201);
});

const sendImage = asyncHandler(async (req, res) => {
  const userId = req.apiUser?.userId || req.user?.id || req.apiUser?.id;
  const data = await messageService.sendImageMessage({
    userId,
    recipientNumber: req.body.recipientNumber,
    imageUrl: req.body.imageUrl,
    caption: req.body.caption,
    sourceApplication: req.body.sourceApplication
  });

  return sendSuccess(res, "Image message sent", data, 201);
});

const myMessages = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const data = await messageService.getUserMessages(req.user.id, limit);
  return sendSuccess(res, "Messages fetched", data);
});

const myMessageStats = asyncHandler(async (req, res) => {
  const data = await messageService.getUserMessageStats(req.user.id);
  return sendSuccess(res, "Message stats fetched", data);
});

module.exports = {
  sendText,
  sendImage,
  myMessages,
  myMessageStats
};
