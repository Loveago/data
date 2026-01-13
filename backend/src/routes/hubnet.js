const express = require('express');

const { prisma } = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { hubnetCheckBalance, queueHubnetForOrder, applyHubnetWebhookUpdate } = require('../lib/hubnet');

const router = express.Router();

router.get(
  '/balance',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    void req;
    const data = await hubnetCheckBalance();
    return res.json(data);
  })
);

router.post(
  '/queue-order/:orderId',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const orderId = req.params.orderId;
    const result = await queueHubnetForOrder(orderId);
    return res.json(result);
  })
);

router.get(
  '/items',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : '';

    const items = await prisma.orderItem.findMany({
      where: orderId ? { orderId } : undefined,
      include: { order: true, product: { include: { category: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    return res.json({ items });
  })
);

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const secret = process.env.HUBNET_WEBHOOK_SECRET ? String(process.env.HUBNET_WEBHOOK_SECRET) : '';
    if (secret) {
      const headerSecret = req.header('x-hubnet-secret');
      const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
      if (headerSecret !== secret && querySecret !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const updated = await applyHubnetWebhookUpdate(req.body);
    if (!updated) return res.json({ ok: true, ignored: true });
    return res.json({ ok: true, itemId: updated.id });
  })
);

module.exports = router;
