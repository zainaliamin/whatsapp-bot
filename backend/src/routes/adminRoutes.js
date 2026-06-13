const express = require("express");
const adminController = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validationMiddleware");
const { createUserSchema, updateUserSchema } = require("../models/adminSchemas");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.post("/users", validate(createUserSchema), adminController.createUser);
router.get("/users", adminController.listUsers);
router.patch("/users/:userId", validate(updateUserSchema), adminController.updateUser);
router.delete("/users/:userId", adminController.deleteUser);
router.get("/reports", adminController.getReport);

module.exports = router;
