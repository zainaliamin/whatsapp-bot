const express = require("express");
const bulkController = require("../controllers/bulkController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

router.post("/enqueue", bulkController.enqueue);
router.get("/stats", bulkController.getStats);
router.get("/messages", bulkController.getMessagesByStatus);
router.post("/status", bulkController.setStatus);
router.delete("/pending", bulkController.clearPending);
router.post("/failed/requeue", bulkController.requeueFailed);

module.exports = router;
