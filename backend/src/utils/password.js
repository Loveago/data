const bcrypt = require('bcrypt');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function hashToken(token) {
  return bcrypt.hash(token, 12);
}

async function verifyToken(token, hash) {
  return bcrypt.compare(token, hash);
}

module.exports = { hashPassword, verifyPassword, hashToken, verifyToken };
