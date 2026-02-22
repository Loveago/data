const express = require('express');

const router = express.Router();

const { prisma } = require('../lib/prisma');
const { updateOrderCompletion } = require('../lib/fulfillment');
const { asyncHandler } = require('../utils/asyncHandler');

function getWebhookSecret() {
  return String(process.env.GRANDAPI_WEBHOOK_TOKEN || '').trim();
}

function extractPayload(body) {
  if (!body || typeof body !== 'object') return {};
  if (body.payload && typeof body.payload === 'object') return body.payload;
  if (body.data && typeof body.data === 'object') return body.data;
  return body;
}

function gatherIdentifiers(payload, body) {
  const ids = [];
  const candidates = [
    body?.orderId,
    body?.id,
    body?.reference,
    payload?.orderId,
    payload?.id,
    payload?.reference,
    payload?.orderReference,
    payload?.providerReference,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const v = String(value).trim();
    if (v) ids.push(v);
  }
  return [...new Set(ids)];
}

function resolveStatusText(body, payload) {
  const candidates = [payload?.status, body?.status, payload?.state, body?.state];
  for (const value of candidates) {
    if (!value) continue;
    const v = String(value).trim();
    if (v) return v;
  }
  return '';
}

function isDeliveredStatus(text) {
  return /deliver|success|complete/i.test(text);
}

function isFailedStatus(text) {
  return /fail|error|reject|cancel/i.test(text);
}

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const secret = getWebhookSecret();
    if (secret) {
      const provided = String(
        req.query.token ||
          req.headers['x-grandapi-token'] ||
          req.headers['x-grandapi-secret'] ||
          ''
      ).trim();
      if (!provided || provided !== secret) {
        return res.status(401).json({ error: 'Invalid webhook token' });
      }
    }

    const body = req.body || {};
    const payload = extractPayload(body);
    const identifiers = gatherIdentifiers(payload, body);
    if (identifiers.length === 0) {
      return res.status(400).json({ error: 'Missing order reference' });
    }

    const item = await prisma.orderItem.findFirst({
      where: {
        OR: [
          { hubnetTransactionId: { in: identifiers } },
          { hubnetReference: { in: identifiers } },
        ],
      },
      include: { order: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Matching order item not found' });
    }

    const statusText = resolveStatusText(body, payload);
    const lowered = statusText.toLowerCase();
    const updateBase = {
      hubnetLastAttemptAt: new Date(),
      hubnetTransactionId: item.hubnetTransactionId || identifiers[0],
      fulfillmentProvider: 'grandapi',
    };

    if (isDeliveredStatus(lowered)) {
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
      return res.json({ ok: true, status: 'delivered' });
    }

    if (isFailedStatus(lowered)) {
      const reason =
        payload?.message ||
        payload?.error ||
        body?.message ||
        body?.error ||
        statusText ||
        'GrandAPI failed';
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          ...updateBase,
          hubnetStatus: 'FAILED',
          hubnetLastError: String(reason),
        },
      });
      return res.json({ ok: true, status: 'failed' });
    }

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        ...updateBase,
        hubnetStatus: 'SUBMITTED',
      },
    });
    return res.json({ ok: true, status: 'received' });
  })
);

module.exports = router;
