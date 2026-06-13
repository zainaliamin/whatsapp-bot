const { logger } = require("../config/logger");

function notFoundHandler(_req, res) {
  return res.status(404).json({
    success: false,
    message: "Route not found",
    data: null
  });
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    logger.error({ err }, "Unhandled error");
  } else {
    logger.warn({ err }, "Handled request error");
  }

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    data: err.details || null
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
