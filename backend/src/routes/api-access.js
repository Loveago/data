const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const request = await prisma.apiAccessRequest.findUnique({
      where: { userId },
      include: {
        apiKey: { select: { id: true, key: true, isActive: true, lastUsedAt: true, createdAt: true } },
      },
    });

    return res.json({ request: request || null });
  })
);

router.post(
  '/request',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { reason } = req.body || {};

    const existing = await prisma.apiAccessRequest.findUnique({ where: { userId } });
    if (existing) {
      return res.status(409).json({ error: 'You already have an API access request', request: existing });
    }

    const request = await prisma.apiAccessRequest.create({
      data: {
        userId,
        reason: reason ? String(reason).slice(0, 500) : null,
        status: 'PENDING',
      },
    });

    return res.status(201).json({ ok: true, request });
  })
);

module.exports = router;
