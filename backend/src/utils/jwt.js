const jwt = require('jsonwebtoken');

function getAccessSecret() {
  if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is required');
  return process.env.JWT_ACCESS_SECRET;
}

function getRefreshSecret() {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required');
  return process.env.JWT_REFRESH_SECRET;
}

function getAccessTtl() {
  return process.env.JWT_ACCESS_TTL || '15m';
}

function getRefreshTtl() {
  return process.env.JWT_REFRESH_TTL || '7d';
}

function signAccessToken(payload) {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: getAccessTtl() });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: getRefreshTtl() });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret());
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret());
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
