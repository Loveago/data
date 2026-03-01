const express = require('express');

const crypto = require('crypto');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { queueFulfillmentForOrder } = require('../lib/fulfillment');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateOrderCode() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GH-${yyyy}${mm}${dd}-${rand}`;
}

function resolveUnitPrice(product, role) {
  if (role === 'AGENT' && product.agentPrice != null) return product.agentPrice;
  return product.price;
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { customerName, customerEmail, customerPhone, customerAddress, items } = req.body || {};

    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const normalized = items
      .map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        recipientPhone: it.recipientPhone ? String(it.recipientPhone) : null,
      }))
      .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'Invalid order items' });
    }

    const productIds = Array.from(new Set(normalized.map((it) => it.productId)));
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    const disabledCategory = products.find((p) => p.category && p.category.enabled === false);
    if (disabledCategory) {
      return res.status(400).json({ error: 'This category is temporarily unavailable' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const role = user?.role || 'USER';
    const priceById = new Map(products.map((p) => [p.id, resolveUnitPrice(p, role)]));
    const stockById = new Map(products.map((p) => [p.id, p.stock]));

    for (const it of normalized) {
      const stock = stockById.get(it.productId);
      if (stock == null || stock < it.quantity) {
        return res.status(400).json({ error: 'Insufficient stock for one or more items' });
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

    const order = await prisma.$transaction(async (tx) => {
      for (const it of normalized) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return tx.order.create({
        data: {
          orderCode: generateOrderCode(),
          userId,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress: normalizedCustomerAddress,
          subtotal,
          total,
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: { include: { category: true } } } } },
      });
    });

    if (order.paymentStatus === 'PAID') {
      queueFulfillmentForOrder(order.id).catch((e) => console.error(e));
    }
    return res.status(201).json(order);
  })
);

router.post(
  '/wallet',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { customerName, customerEmail, customerPhone, customerAddress, items } = req.body || {};

    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const normalized = items
      .map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        recipientPhone: it.recipientPhone ? String(it.recipientPhone) : null,
      }))
      .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'Invalid order items' });
    }

    const productIds = Array.from(new Set(normalized.map((it) => it.productId)));
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    const disabledCategory = products.find((p) => p.category && p.category.enabled === false);
    if (disabledCategory) {
      return res.status(400).json({ error: 'This category is temporarily unavailable' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true, role: true } });
    const role = user?.role || 'USER';
    const priceById = new Map(products.map((p) => [p.id, resolveUnitPrice(p, role)]));
    const stockById = new Map(products.map((p) => [p.id, p.stock]));

    for (const it of normalized) {
      const stock = stockById.get(it.productId);
      if (stock == null || stock < it.quantity) {
        return res.status(400).json({ error: 'Insufficient stock for one or more items' });
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

    const walletBalance = user?.walletBalance || new Prisma.Decimal('0');
    if (walletBalance.lt(total)) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { walletBalance: { decrement: total } } });
      await tx.walletTransaction.create({
        data: { userId, type: 'SPEND', amount: total, reference: null },
      });

      for (const it of normalized) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return tx.order.create({
        data: {
          orderCode: generateOrderCode(),
          userId,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress: normalizedCustomerAddress,
          subtotal,
          total,
          paymentProvider: 'wallet',
          paymentReference: null,
          paymentStatus: 'PAID',
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: { include: { category: true } } } } },
      });
    });

    if (order.paymentStatus === 'PAID') {
      queueFulfillmentForOrder(order.id).catch((e) => console.error(e));
    }

    return res.status(201).json(order);
  })
);

router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const pageRaw = typeof req.query.page === 'string' ? req.query.page : '';
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '';
    const page = Math.max(1, Number(pageRaw || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 10) || 10));
    const skip = Math.max(0, (page - 1) * limit);

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: { items: { include: { product: { include: { category: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return res.json({ items, total, page, limit });
  })
);

module.exports = router;
