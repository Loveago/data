const express = require('express');

const crypto = require('crypto');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { hashPassword, verifyPassword, hashToken, verifyToken } = require('../utils/password');

const router = express.Router();

function generateReferralCode() {
  return 'LFQ-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance != null ? String(user.walletBalance) : '0',
    referralCode: user.referralCode || null,
    referredById: user.referredById || null,
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
    const { email, password, name, phone, referralCode: refCode } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await hashPassword(password);

    let referredById = null;
    if (refCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: String(refCode).trim() } });
      if (referrer) referredById = referrer.id;
    }

    let referralCode = generateReferralCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.user.findUnique({ where: { referralCode } });
      if (!exists) break;
      referralCode = generateReferralCode();
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        phone: phone || null,
        role: 'USER',
        referralCode,
        referredById,
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

router.get(
  '/referral-info',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referrals: {
          select: { id: true, email: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let referralCode = user.referralCode;
    if (!referralCode) {
      let candidate = generateReferralCode();
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.user.findUnique({ where: { referralCode: candidate } });
        if (!exists) break;
        candidate = generateReferralCode();
      }
      referralCode = candidate;
      await prisma.user.update({ where: { id: userId }, data: { referralCode } });
    }

    const totalEarnings = await prisma.walletTransaction.aggregate({
      where: { userId, type: 'REFERRAL_BONUS' },
      _sum: { amount: true },
    });

    return res.json({
      referralCode,
      referrals: user.referrals.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        joinedAt: r.createdAt,
      })),
      totalEarnings: String(totalEarnings._sum.amount || '0'),
    });
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: String(email).trim() } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });

    const frontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'LOFAQ DATA HUB <noreply@lofaq.store>';

    if (resendApiKey) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Reset your LOFAQ DATA HUB password',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#1d4ed8">LOFAQ DATA HUB</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset Password</a>
              </p>
              <p style="font-size:13px;color:#666">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (e) {
        console.error('Failed to send reset email via Resend:', e);
      }
    } else {
      console.log('RESEND_API_KEY not set. Reset link:', resetLink);
    }

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: String(token),
        passwordResetExpiresAt: { gte: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(String(newPassword));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return res.json({ message: 'Password has been reset successfully. You can now log in.' });
  })
);

module.exports = router;
