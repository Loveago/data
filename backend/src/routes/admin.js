const express = require('express');

const bcrypt = require('bcrypt');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function parseMoneyInput(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  return trimmed;
}

router.get(
  '/orders',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '';
    const limit = Math.min(500, Math.max(1, Number(limitRaw || 200) || 200));

    const where = {
      ...(status && ['PENDING', 'PROCESSING', 'COMPLETED'].includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { orderCode: { contains: q, mode: 'insensitive' } },
              { paymentReference: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const items = await prisma.order.findMany({
      where,
      take: limit,
      include: { user: { select: { id: true, email: true } }, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ items });
  })
);

router.patch(
  '/orders/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status } = req.body || {};
    if (!status || !['PENDING', 'PROCESSING', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await prisma.order.update({ where: { id }, data: { status } });
    return res.json(updated);
  })
);

router.get(
  '/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const itemsRaw = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        walletBalance: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = itemsRaw.map((u) => ({
      ...u,
      walletBalance: String(u.walletBalance || '0'),
    }));

    return res.json({ items });
  })
);

router.patch(
  '/users/:id/role',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { role } = req.body || {};
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(updated);
  })
);

router.patch(
  '/users/:id/wallet-balance',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { mode, amount, reason } = req.body || {};

    const moneyStr = parseMoneyInput(amount);
    if (!moneyStr) return res.status(400).json({ error: 'Invalid amount' });
    if (!mode || !['set', 'increment'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, walletBalance: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const current = new Prisma.Decimal(user.walletBalance || '0');
    const input = new Prisma.Decimal(moneyStr);

    const nextBalance = mode === 'set' ? input : current.add(input);
    if (nextBalance.isNegative()) return res.status(400).json({ error: 'Wallet balance cannot be negative' });

    const delta = nextBalance.sub(current);
    const deltaAbs = delta.isNegative() ? delta.mul(-1) : delta;
    const txType = delta.isNegative() ? 'SPEND' : 'DEPOSIT';

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { walletBalance: nextBalance },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          walletBalance: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!delta.isZero()) {
        await tx.walletTransaction.create({
          data: {
            userId: id,
            type: txType,
            amount: deltaAbs,
            reference: `ADMIN_ADJUST:${reason ? String(reason).slice(0, 140) : ''}`,
          },
        });
      }

      return u;
    });

    return res.json({
      ...updated,
      walletBalance: String(updated.walletBalance || '0'),
    });
  })
);

router.post(
  '/users/:id/reset-password',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return res.json({ ok: true });
  })
);

router.post(
  '/users/:id/force-logout',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    await prisma.user.update({ where: { id }, data: { refreshTokenHash: null, refreshTokenExpiresAt: null } });
    return res.json({ ok: true });
  })
);

router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [totalUsers, totalOrders, totalRevenueAgg] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { total: true } }),
    ]);

    const totalRevenue = String(totalRevenueAgg._sum.total || '0');

    return res.json({ totalUsers, totalOrders, totalRevenue });
  })
);

module.exports = router;
