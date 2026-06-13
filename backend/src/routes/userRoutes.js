const express = require("express");
const userController = require("../controllers/userController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/profile", requireAuth, userController.getProfile);
router.patch("/profile", requireAuth, userController.updateProfile);
router.patch("/password", requireAuth, userController.changePassword);
router.get("/api-token", requireAuth, userController.getMyApiToken);

module.exports = router;
