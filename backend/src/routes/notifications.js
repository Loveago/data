const express = require('express');

const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function sanitizeHtml(input) {
  const raw = typeof input === 'string' ? input : '';
  if (!raw.trim()) return '';

  let s = raw;
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/javascript:/gi, '');
  return s;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '';
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 30) || 30));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, notificationsClearedAt: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await prisma.notification.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      items,
      clearedAt: user.notificationsClearedAt,
    });
  })
);

router.post(
  '/clear',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const now = new Date();

    await prisma.user.update({
      where: { id: userId },
      data: { notificationsClearedAt: now },
    });

    return res.json({ ok: true, clearedAt: now });
  })
);

module.exports = { router, sanitizeHtml };
