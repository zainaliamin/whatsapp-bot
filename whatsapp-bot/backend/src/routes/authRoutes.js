const express = require("express");
const authController = require("../controllers/authController");
const { validate } = require("../middlewares/validationMiddleware");
const { registerSchema, loginSchema } = require("../models/authSchemas");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);

module.exports = router;
