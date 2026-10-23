const express = require("express");

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const clientRoutes = require("./clientRoutes");
const adminRoutes = require("./adminRoutes");
const messageRoutes = require("./messageRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/client", clientRoutes);
router.use("/admin", adminRoutes);
router.use("/messages", messageRoutes);
router.use("/bulk", require("./bulkRoutes"));

module.exports = router;
