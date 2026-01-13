const express = require('express');

const crypto = require('crypto');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { computePaystackGrossAmountPesewas } = require('../lib/paystackFees');
const { queueHubnetForOrder } = require('../lib/hubnet');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

function generateOrderCode() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GH-${yyyy}${mm}${dd}-${rand}`;
}

function assertPaystackKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const err = new Error('Paystack is not configured');
    err.statusCode = 500;
    throw err;
  }
  return key;
}

function toPesewas(decimal) {
  const n = Number(decimal);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function pesewasToDecimal(pesewas) {
  const n = Number(pesewas);
  if (!Number.isFinite(n)) return new Prisma.Decimal('0');
  return new Prisma.Decimal((n / 100).toFixed(2));
}

async function computeOrderFromItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Order items are required');
    err.statusCode = 400;
    throw err;
  }

  const normalized = items
    .map((it) => ({
      productId: it.productId,
      quantity: Number(it.quantity),
      recipientPhone: it.recipientPhone ? String(it.recipientPhone) : null,
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (normalized.length === 0) {
    const err = new Error('Invalid order items');
    err.statusCode = 400;
    throw err;
  }

  const productIds = Array.from(new Set(normalized.map((it) => it.productId)));
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  if (products.length !== productIds.length) {
    const err = new Error('One or more products not found');
    err.statusCode = 400;
    throw err;
  }

  const priceById = new Map(products.map((p) => [p.id, p.price]));
  const stockById = new Map(products.map((p) => [p.id, p.stock]));

  for (const it of normalized) {
    const stock = stockById.get(it.productId);
    if (stock == null || stock < it.quantity) {
      const err = new Error('Insufficient stock for one or more items');
      err.statusCode = 400;
      throw err;
    }
  }

  let subtotal = new Prisma.Decimal('0');

  const orderItemsData = normalized.map((it) => {
    const unitPrice = priceById.get(it.productId);
    const lineTotal = unitPrice.mul(new Prisma.Decimal(String(it.quantity)));
    subtotal = subtotal.add(lineTotal);
    return {
      productId: it.productId,
      quantity: it.quantity,
      recipientPhone: it.recipientPhone,
      unitPrice,
      lineTotal,
    };
  });

  const total = subtotal;

  return { normalized, subtotal, total, orderItemsData };
}

router.post(
  '/paystack/quote',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { items } = req.body || {};
    const { subtotal, total } = await computeOrderFromItems(items);

    const netPesewas = toPesewas(total);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    return res.json({
      subtotal: String(subtotal),
      fee: (feePesewas / 100).toFixed(2),
      total: (grossAmountPesewas / 100).toFixed(2),
    });
  })
);

router.post(
  '/paystack/initialize',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { customerName, customerEmail, customerPhone, customerAddress, items, callbackUrl } = req.body || {};

    if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    if (!callbackUrl) {
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items);

    const netPesewas = toPesewas(total);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    const secretKey = assertPaystackKey();

    const payload = {
      email: customerEmail,
      amount: grossAmountPesewas,
      callback_url: callbackUrl,
      metadata: {
        type: 'order',
        userId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items: normalized,
        netAmountPesewas: netPesewas,
        grossAmountPesewas,
        feePesewas,
      },
    };

    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok || !data?.status) {
      return res.status(502).json({ error: data?.message || 'Failed to initialize payment' });
    }

    const reference = data?.data?.reference ? String(data.data.reference) : '';
    if (!reference) {
      return res.status(502).json({ error: 'Missing payment reference' });
    }

    await prisma.order.create({
      data: {
        orderCode: generateOrderCode(),
        userId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        subtotal,
        total: pesewasToDecimal(grossAmountPesewas),
        paymentProvider: 'paystack',
        paymentReference: reference,
        paymentStatus: 'UNPAID',
        items: {
          create: orderItemsData.map((d) => ({
            productId: d.productId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            lineTotal: d.lineTotal,
            recipientPhone: d.recipientPhone,
          })),
        },
      },
    });

    return res.json({
      authorizationUrl: data.data.authorization_url,
      reference,
      subtotal: String(subtotal),
      fee: (feePesewas / 100).toFixed(2),
      total: (grossAmountPesewas / 100).toFixed(2),
    });
  })
);

router.post(
  '/paystack/complete-public',
  asyncHandler(async (req, res) => {
    const {
      reference,
      customerName: bodyCustomerName,
      customerEmail: bodyCustomerEmail,
      customerPhone: bodyCustomerPhone,
      customerAddress: bodyCustomerAddress,
      items: bodyItems,
    } = req.body || {};
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const secretKey = assertPaystackKey();
    const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(String(reference))}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const vdata = await vr.json();
    if (!vr.ok || !vdata?.status) {
      return res.status(502).json({ error: vdata?.message || 'Failed to verify payment' });
    }

    const status = vdata?.data?.status;
    const paidAmount = Number(vdata?.data?.amount);
    if (status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const verifiedMeta = vdata?.data?.metadata || {};

    const existing = await prisma.order.findFirst({
      where: { paymentProvider: 'paystack', paymentReference: String(reference) },
      include: { items: { include: { product: true } } },
    });

    if (!existing) {
      const userId = verifiedMeta.userId;
      const items = verifiedMeta.items ?? bodyItems;
      const customerName = verifiedMeta.customerName ?? bodyCustomerName;
      const customerEmail = verifiedMeta.customerEmail ?? bodyCustomerEmail;
      const customerPhone = verifiedMeta.customerPhone ?? bodyCustomerPhone;
      const customerAddress = verifiedMeta.customerAddress ?? bodyCustomerAddress;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId metadata' });
      }

      if (verifiedMeta.type && String(verifiedMeta.type) !== 'order') {
        return res.status(400).json({ error: 'Invalid order metadata' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing order items' });
      }

      if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
        return res.status(400).json({ error: 'Missing customer fields' });
      }

      const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items);

      const netPesewas = toPesewas(total);
      const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

      if (paidAmount !== grossAmountPesewas) {
        return res.status(400).json({ error: 'Payment amount mismatch' });
      }

      const created = await prisma.$transaction(async (tx) => {
        const already = await tx.order.findFirst({
          where: { paymentProvider: 'paystack', paymentReference: String(reference) },
          include: { items: { include: { product: true } } },
        });
        if (already) return already;

        for (const it of normalized) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.quantity } },
          });
        }

        return tx.order.create({
          data: {
            orderCode: generateOrderCode(),
            userId: String(userId),
            customerName: String(customerName),
            customerEmail: String(customerEmail),
            customerPhone: String(customerPhone),
            customerAddress: String(customerAddress),
            subtotal,
            total: pesewasToDecimal(grossAmountPesewas),
            paymentProvider: 'paystack',
            paymentReference: String(reference),
            paymentStatus: 'PAID',
            items: {
              create: orderItemsData.map((d) => ({
                productId: d.productId,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                lineTotal: d.lineTotal,
                recipientPhone: d.recipientPhone,
              })),
            },
          },
          include: { items: { include: { product: true } } },
        });
      });

      queueHubnetForOrder(created.id).catch((e) => console.error(e));
      return res.status(201).json(created);
    }

    if (existing.paymentStatus === 'PAID') {
      return res.json(existing);
    }

    const expectedFromTotal = toPesewas(existing.total);
    const expectedFromSubtotal = computePaystackGrossAmountPesewas(toPesewas(existing.subtotal)).grossAmountPesewas;
    const expectedPaid = paidAmount === expectedFromSubtotal ? expectedFromSubtotal : expectedFromTotal;
    if (paidAmount !== expectedFromTotal && paidAmount !== expectedFromSubtotal) {
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: existing.id },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }

      const insufficient = order.items.find((it) => (it.product?.stock ?? 0) < it.quantity);

      if (insufficient) {
        return tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID' },
          include: { items: { include: { product: true } } },
        });
      }

      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          ...(expectedPaid !== expectedFromTotal ? { total: pesewasToDecimal(expectedPaid) } : {}),
        },
        include: { items: { include: { product: true } } },
      });
    });

    queueHubnetForOrder(updated.id).catch((e) => console.error(e));
    return res.status(201).json(updated);
  })
);

router.post(
  '/paystack/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { reference, customerName, customerEmail, customerPhone, customerAddress, items } = req.body || {};

    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items);

    const netPesewas = toPesewas(total);
    const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    const secretKey = assertPaystackKey();

    const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const vdata = await vr.json();

    if (!vr.ok || !vdata?.status) {
      return res.status(502).json({ error: vdata?.message || 'Failed to verify payment' });
    }

    const status = vdata?.data?.status;
    const paidAmount = Number(vdata?.data?.amount);

    if (status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    if (paidAmount !== grossAmountPesewas) {
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    const order = await prisma.$transaction(async (tx) => {
      for (const it of normalized) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      const netPesewas = toPesewas(total);
      const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

      if (paidAmount !== grossAmountPesewas) {
        const err = new Error('Payment amount mismatch');
        err.statusCode = 400;
        throw err;
      }

      return tx.order.create({
        data: {
          orderCode: generateOrderCode(),
          userId,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          subtotal,
          total: pesewasToDecimal(grossAmountPesewas),
          paymentProvider: 'paystack',
          paymentReference: String(reference),
          paymentStatus: 'PAID',
          items: { create: orderItemsData.map((d) => ({
            productId: d.productId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            lineTotal: d.lineTotal,
            recipientPhone: d.recipientPhone,
          })) },
        },
        include: { items: { include: { product: true } } },
      });
    });

    queueHubnetForOrder(order.id).catch((e) => console.error(e));
    return res.status(201).json(order);
  })
);

module.exports = router;
