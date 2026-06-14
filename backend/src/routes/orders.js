const express = require('express');

const crypto = require('crypto');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { queueFulfillmentForOrder } = require('../lib/fulfillment');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MAX_ORDER_LINE_QUANTITY = Math.max(1, Number(process.env.MAX_ORDER_LINE_QUANTITY || 20) || 20);

function generateOrderCode(prefix = 'DASH') {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
}

function resolveUnitPrice(product, role) {
  if (role === 'AGENT' && product.agentPrice != null) return product.agentPrice;
  return product.price;
}

function normalizeOrderItems(items) {
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
    .filter((it) => it.productId);

  if (normalized.length === 0) {
    const err = new Error('Invalid order items');
    err.statusCode = 400;
    throw err;
  }

  const invalidQuantity = normalized.find(
    (it) => !Number.isInteger(it.quantity) || it.quantity <= 0 || it.quantity > MAX_ORDER_LINE_QUANTITY
  );
  if (invalidQuantity) {
    const err = new Error(`Each item quantity must be a whole number between 1 and ${MAX_ORDER_LINE_QUANTITY}`);
    err.statusCode = 400;
    throw err;
  }

  return normalized;
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

    let normalized;
    try {
      normalized = normalizeOrderItems(items);
    } catch (err) {
      const statusCode = err?.statusCode || 400;
      return res.status(statusCode).json({ error: err?.message || 'Invalid order items' });
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

    let normalized;
    try {
      normalized = normalizeOrderItems(items);
    } catch (err) {
      const statusCode = err?.statusCode || 400;
      return res.status(statusCode).json({ error: err?.message || 'Invalid order items' });
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

router.get(
  '/track',
  asyncHandler(async (req, res) => {
    const orderCode = typeof req.query.orderCode === 'string' ? req.query.orderCode.trim() : '';
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const dateStr = typeof req.query.date === 'string' ? req.query.date.trim() : '';

    if (!orderCode && !phone) {
      return res.status(400).json({ error: 'Please provide an order code or phone number' });
    }

    if (!dateStr) {
      return res.status(400).json({ error: 'Missing order date' });
    }

    let targetDate;
    try {
      targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid order date format' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid order date format' });
    }

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const where = {
      createdAt: {
        gte: targetDate,
        lt: nextDay,
      },
    };

    if (orderCode) {
      where.orderCode = { equals: orderCode, mode: 'insensitive' };
    } else if (phone) {
      where.customerPhone = { contains: phone.replace(/\D/g, ''), mode: 'insensitive' };
    }

    const order = await prisma.order.findFirst({
      where,
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please check your details and date.' });
    }

    return res.json({ order });
  })
);

module.exports = router;
