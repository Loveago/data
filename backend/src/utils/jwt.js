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

function getJwtIssuer() {
  return process.env.JWT_ISSUER ? String(process.env.JWT_ISSUER).trim() : undefined;
}

function getJwtAudience() {
  return process.env.JWT_AUDIENCE ? String(process.env.JWT_AUDIENCE).trim() : undefined;
}

function signOptions(expiresIn) {
  return {
    expiresIn,
    algorithm: 'HS256',
    ...(getJwtIssuer() ? { issuer: getJwtIssuer() } : {}),
    ...(getJwtAudience() ? { audience: getJwtAudience() } : {}),
  };
}

function verifyOptions() {
  return {
    algorithms: ['HS256'],
    ...(getJwtIssuer() ? { issuer: getJwtIssuer() } : {}),
    ...(getJwtAudience() ? { audience: getJwtAudience() } : {}),
  };
}

function signAccessToken(payload) {
  return jwt.sign(payload, getAccessSecret(), signOptions(getAccessTtl()));
}

function signRefreshToken(payload) {
  return jwt.sign(payload, getRefreshSecret(), signOptions(getRefreshTtl()));
}

function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret(), verifyOptions());
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret(), verifyOptions());
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
