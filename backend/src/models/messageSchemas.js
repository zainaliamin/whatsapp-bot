const Joi = require("joi");

const sendTextSchema = Joi.object({
  recipientNumber: Joi.string().min(8).max(20).required(),
  messageText: Joi.string().min(1).max(4096).required(),
  sourceApplication: Joi.string().min(2).max(120).required()
});

const sendImageSchema = Joi.object({
  recipientNumber: Joi.string().min(8).max(20).required(),
  imageUrl: Joi.string().uri().required(),
  caption: Joi.string().allow("").max(1024).optional(),
  sourceApplication: Joi.string().min(2).max(120).required()
});

module.exports = {
  sendTextSchema,
  sendImageSchema
};
