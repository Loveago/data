const express = require('express');

const bcrypt = require('bcrypt');

const { Prisma, NotificationLevel } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { getFulfillmentControlState, setForcedProvider } = require('../lib/fulfillment');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sanitizeHtml } = require('./notifications');

const router = express.Router();

function parseMoneyInput(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  return trimmed;
}

function parseForcedProviderInput(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v || v === 'auto' || v === 'none') return null;
  if (v === 'encart') return 'grandapi';
  if (v === 'grandapi' || v === 'datahubnet') return v;
  return undefined;
}

router.get(
  '/fulfillment-provider',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    void req;
    return res.json(getFulfillmentControlState());
  })
);

router.patch(
  '/fulfillment-provider',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const provider = parseForcedProviderInput(req.body?.provider);
    if (provider === undefined) {
      return res.status(400).json({ error: 'Invalid provider. Use grandapi, datahubnet, or auto.' });
    }

    setForcedProvider(provider);
    return res.json(getFulfillmentControlState());
  })
);

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
    if (!role || !['USER', 'ADMIN', 'AGENT'].includes(role)) {
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

router.get(
  '/notifications',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '';
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));

    const items = await prisma.notification.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ items });
  })
);

router.post(
  '/notifications',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, body, level } = req.body || {};

    const t = typeof title === 'string' ? title.trim() : '';
    if (!t) return res.status(400).json({ error: 'Title is required' });
    if (t.length > 120) return res.status(400).json({ error: 'Title is too long' });

    const rawBody = typeof body === 'string' ? body : '';
    const cleanedBody = sanitizeHtml(rawBody);
    if (!cleanedBody.trim()) return res.status(400).json({ error: 'Body is required' });
    if (cleanedBody.length > 5000) return res.status(400).json({ error: 'Body is too long' });

    const lvl = typeof level === 'string' ? level.trim().toUpperCase() : 'INFO';
    const allowed = NotificationLevel ? Object.values(NotificationLevel) : ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];
    const finalLevel = allowed.includes(lvl) ? lvl : 'INFO';

    const created = await prisma.notification.create({
      data: {
        title: t,
        body: cleanedBody,
        level: finalLevel,
      },
    });

    return res.status(201).json(created);
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

router.get(
  '/withdrawals',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const where = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? { status } : {};

    const items = await prisma.withdrawalRequest.findMany({
      where,
      include: { user: { select: { id: true, email: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      items: items.map((w) => ({
        id: w.id,
        userId: w.userId,
        user: w.user,
        amount: String(w.amount),
        fee: String(w.fee),
        totalDeducted: String(w.totalDeducted),
        momoNumber: w.momoNumber,
        momoNetwork: w.momoNetwork,
        status: w.status,
        adminNote: w.adminNote,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
      })),
    });
  })
);

router.patch(
  '/withdrawals/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { adminNote } = req.body || {};

    const wr = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr) return res.status(404).json({ error: 'Withdrawal request not found' });
    if (wr.status !== 'PENDING') return res.status(400).json({ error: `Already ${wr.status.toLowerCase()}` });

    const updated = await prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminNote: adminNote || null,
        processedAt: new Date(),
      },
    });

    return res.json({
      id: updated.id,
      status: updated.status,
      processedAt: updated.processedAt,
    });
  })
);

router.patch(
  '/withdrawals/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { adminNote } = req.body || {};

    const wr = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr) return res.status(404).json({ error: 'Withdrawal request not found' });
    if (wr.status !== 'PENDING') return res.status(400).json({ error: `Already ${wr.status.toLowerCase()}` });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote || null,
          processedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: wr.userId },
        data: { walletBalance: { increment: wr.totalDeducted } },
      });

      await tx.walletTransaction.create({
        data: {
          userId: wr.userId,
          type: 'DEPOSIT',
          amount: wr.totalDeducted,
          reference: `WITHDRAW_REFUND:${wr.id}`,
        },
      });

      return result;
    });

    return res.json({
      id: updated.id,
      status: updated.status,
      processedAt: updated.processedAt,
    });
  })
);

module.exports = router;
