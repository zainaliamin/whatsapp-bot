const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");

const { logger } = require("./config/logger");
const { apiLimiter } = require("./middlewares/rateLimitMiddleware");
const { errorHandler, notFoundHandler } = require("./middlewares/errorMiddleware");
const routes = require("./routes");

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`
    );
  });

  next();
});
app.use("/", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "OK", data: { uptime: process.uptime() } });
});

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
