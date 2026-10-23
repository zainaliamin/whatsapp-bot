const pino = require("pino");
const { env } = require("./env");

function getTransport() {
  if (env.nodeEnv === "production") {
    return undefined;
  }

  try {
    require.resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        levelFirst: true,
        singleLine: true,
        translateTime: "SYS:standard"
      }
    };
  } catch (_err) {
    // Fallback to standard JSON logs if pretty transport is unavailable.
    return undefined;
  }
}

const logger = pino({
  base: null,
  level: env.nodeEnv === "production" ? "info" : "debug",
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: getTransport()
});

module.exports = { logger };
