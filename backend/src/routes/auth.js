const express = require('express');

const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { hashPassword, verifyPassword, hashToken, verifyToken } = require('../utils/password');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance != null ? String(user.walletBalance) : '0',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function computeRefreshExpiryDate(ttl) {
  const m = /^([0-9]+)\s*(s|m|h|d)$/.exec(ttl);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(Date.now() + value * multipliers[unit]);
}

async function issueTokensForUser(user) {
  const tokenPayload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const ttl = process.env.JWT_REFRESH_TTL || '7d';
  const expiresAt = computeRefreshExpiryDate(ttl);
  const refreshTokenHash = await hashToken(refreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash,
      refreshTokenExpiresAt: expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name, phone } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        phone: phone || null,
        role: 'USER',
      },
    });

    const tokens = await issueTokensForUser(user);

    return res.status(201).json({ user: publicUser(user), ...tokens });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = await issueTokensForUser(user);
    return res.json({ user: publicUser(user), ...tokens });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = decoded.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const matches = await verifyToken(refreshToken, user.refreshTokenHash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = await issueTokensForUser(user);
    return res.json(tokens);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(204).send();
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const userId = decoded.sub;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
        });
      }
    } catch (e) {
      return res.status(204).send();
    }

    return res.status(204).send();
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { name, phone, email } = req.body || {};

    if (name === undefined && phone === undefined && email === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextEmail = email != null ? String(email).trim() : undefined;
    if (nextEmail !== undefined && !nextEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (nextEmail !== undefined && nextEmail !== current.email) {
      const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const data = {};
    if (name !== undefined) {
      const n = name == null ? '' : String(name).trim();
      data.name = n ? n : null;
    }
    if (phone !== undefined) {
      const p = phone == null ? '' : String(phone).trim();
      data.phone = p ? p : null;
    }
    if (nextEmail !== undefined) {
      data.email = nextEmail;
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });
    const tokens = await issueTokensForUser(updated);

    return res.json({ user: publicUser(updated), ...tokens });
  })
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ok = await verifyPassword(String(currentPassword), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const passwordHash = await hashPassword(String(newPassword));
    const updated = await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    const tokens = await issueTokensForUser(updated);

    return res.json({ user: publicUser(updated), ...tokens });
  })
);

module.exports = router;
