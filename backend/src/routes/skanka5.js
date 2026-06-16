const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { prisma } = require('../lib/prisma');
const { updateOrderCompletion } = require('../lib/fulfillment');
const { skanka5CheckStatus } = require('../lib/skanka5');
const { createRateLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const webhookRateLimit = createRateLimiter({
  windowMs: Number(process.env.WEBHOOK_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.WEBHOOK_LIMIT || 120),
  keyPrefix: 'skanka5-webhook',
  message: 'Too many webhook requests',
});

function getWebhookSecret() {
  return String(process.env.SKANKA5_WEBHOOK_SECRET || '').trim();
}

function safeTokenEquals(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return safeTokenEquals(signature, expected);
}

function extractPayload(body) {
  if (!body || typeof body !== 'object') return {};
  if (body.payload && typeof body.payload === 'object') return body.payload;
  if (body.data && typeof body.data === 'object') return body.data;
  return body;
}

function isDeliveredStatus(text) {
  return /deliver|success|complete/i.test(text);
}

function isFailedStatus(text) {
  return /fail|error|reject|cancel/i.test(text);
}

async function processSkanka5StatusLine(line) {
  const orderCode = line?.order_reference || line?.order_code || line?.reference;
  if (!orderCode) return { action: 'skipped', reason: 'no order code' };

  const item = await prisma.orderItem.findFirst({
    where: {
      OR: [
        { hubnetTransactionId: String(orderCode) },
        { hubnetReference: String(orderCode) },
        { hubnetPaymentId: String(orderCode) },
      ],
    },
    include: { order: true },
  });

  if (!item) return { action: 'notFound', orderCode };

  // line.status is the Skanka5 order lifecycle status: "pending", "processing", "processed"
  // line.api_status is the downstream carrier API call result — NOT the order delivery status
  const orderStatus = String(line?.status ?? '').toLowerCase();
  const updateBase = {
    hubnetLastAttemptAt: new Date(),
    fulfillmentProvider: 'skanka5',
  };

  if (orderStatus === 'processed') {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        ...updateBase,
        hubnetStatus: 'DELIVERED',
        hubnetDeliveredAt: new Date(),
        hubnetLastError: null,
      },
    });
    await updateOrderCompletion(item.orderId);
    return { action: 'delivered', itemId: item.id };
  }

  if (isFailedStatus(orderStatus)) {
    const reason = line?.message || line?.error || orderStatus || 'Skanka5 failed';
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        ...updateBase,
        hubnetStatus: 'FAILED',
        hubnetLastError: String(reason),
      },
    });
    return { action: 'failed', itemId: item.id };
  }

  // "pending" or "processing" — order is in progress, update last attempt time
  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      ...updateBase,
      hubnetStatus: 'SUBMITTED',
    },
  });
  return { action: orderStatus || 'submitted', itemId: item.id };
}

router.post(
  '/webhook',
  webhookRateLimit,
  asyncHandler(async (req, res) => {
    const secret = getWebhookSecret();
    if (secret) {
      const sig = String(
        req.headers['x-signature'] ||
          req.headers['x-webhook-signature'] ||
          req.headers['x-hub-signature-256'] ||
          req.headers['x-skanka5-signature'] ||
          ''
      ).trim();

      const rawBody = JSON.stringify(req.body);
      if (!sig || !verifyWebhookSignature(rawBody, sig, secret)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const body = req.body || {};
    const payload = extractPayload(body);

    let items = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(body.items)
        ? body.items
        : [];

    if (items.length === 0) {
      const single = payload.order_reference || payload.order_code || payload.reference || body.order_reference || body.order_code || body.reference;
      if (single) {
        items = [payload];
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No items in webhook payload' });
    }

    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    for (const line of items) {
      const result = await processSkanka5StatusLine(line);
      if (result.action === 'notFound') notFound++;
      else if (result.action === 'skipped') skipped++;
      else updated++;
    }

    return res.json({ ok: true, updated, notFound, skipped });
  })
);

const pollRateLimit = createRateLimiter({
  windowMs: Number(process.env.WEBHOOK_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.WEBHOOK_LIMIT || 120),
  keyPrefix: 'skanka5-poll',
  message: 'Too many poll requests',
});

router.post(
  '/poll',
  requireAuth,
  requireAdmin,
  pollRateLimit,
  asyncHandler(async (req, res) => {
    const reference = String(req.body?.reference || '').trim();
    if (!reference) {
      return res.status(400).json({ error: 'reference is required' });
    }

    const data = await skanka5CheckStatus(reference);
    const line = data?.items?.[0];
    // line.status is the Skanka5 order lifecycle status — do not use api_status as order status
    const statusText = String(line?.status ?? data?.status ?? '').toLowerCase();

    const dbItem = await prisma.orderItem.findFirst({
      where: {
        OR: [
          { hubnetTransactionId: reference },
          { hubnetReference: reference },
          { hubnetPaymentId: reference },
        ],
      },
    });

    let updated = null;
    if (dbItem) {
      const result = await processSkanka5StatusLine(line || data);
      updated = { ...result, itemId: dbItem.id };
    }

    return res.json({
      ok: true,
      reference,
      orderStatus: statusText || null,
      remoteData: data,
      dbUpdated: updated,
    });
  })
);

module.exports = router;
