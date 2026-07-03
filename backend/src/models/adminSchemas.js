const Joi = require("joi");

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required(),
  role: Joi.string().valid("admin", "user").default("user"),
  messageExpiryDate: Joi.date().iso().allow(null).optional()
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid("admin", "user").optional(),
  messageExpiryDate: Joi.date().iso().allow(null).optional()
}).min(1);

const resetUserPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(64).required()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema
};
