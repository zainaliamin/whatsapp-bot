const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { env } = require("../config/env");

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function generateApiToken() {
  return `wsaas_${uuidv4().replace(/-/g, "")}`;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateApiToken
};
