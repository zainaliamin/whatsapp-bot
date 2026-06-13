const express = require("express");
const clientController = require("../controllers/clientController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/create", requireAuth, clientController.createClient);
router.get("/status", requireAuth, clientController.getStatus);
router.post("/logout", requireAuth, clientController.logoutClient);
router.delete("/delete", requireAuth, clientController.deleteClient);

module.exports = router;
