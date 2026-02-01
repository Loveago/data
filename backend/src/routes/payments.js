const express = require('express');

const crypto = require('crypto');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { computePaystackGrossAmountPesewas } = require('../lib/paystackFees');
const { queueHubnetForOrder } = require('../lib/hubnet');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const AGENT_UPGRADE_FEE_GHS = 40;

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

function resolveUnitPrice(product, role) {
  if (role === 'AGENT' && product.agentPrice != null) return product.agentPrice;
  return product.price;
}

function computeAgentProfit(items) {
  let profit = new Prisma.Decimal('0');
  for (const it of items) {
    if (!it.agentCostPrice) continue;
    const margin = it.unitPrice.sub(it.agentCostPrice);
    const lineProfit = margin.mul(new Prisma.Decimal(String(it.quantity)));
    profit = profit.add(lineProfit);
  }
  if (profit.isNegative()) return new Prisma.Decimal('0');
  return profit;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance != null ? String(user.walletBalance) : '0',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getUserRole(userId, fallbackRole) {
  if (!userId) return fallbackRole || 'USER';
  const user = await prisma.user.findUnique({ where: { id: String(userId) }, select: { role: true } });
  return user?.role || fallbackRole || 'USER';
}

async function computeOrderFromItems(items, role = 'USER') {
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

  const priceById = new Map(products.map((p) => [p.id, resolveUnitPrice(p, role)]));
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

async function computeStorefrontOrderFromItems(items, storefrontId) {
  if (!storefrontId) {
    const err = new Error('Missing storefront');
    err.statusCode = 400;
    throw err;
  }

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
  const [products, prices] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } } }),
    prisma.agentStorefrontPrice.findMany({ where: { storefrontId, productId: { in: productIds } } }),
  ]);

  if (products.length !== productIds.length) {
    const err = new Error('One or more products not found');
    err.statusCode = 400;
    throw err;
  }

  const priceById = new Map(prices.map((p) => [p.productId, p.sellPrice]));
  const productById = new Map(products.map((p) => [p.id, p]));
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
    const sellPrice = priceById.get(it.productId);
    if (!sellPrice) {
      const err = new Error('Missing storefront price for one or more items');
      err.statusCode = 400;
      throw err;
    }

    const product = productById.get(it.productId);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 400;
      throw err;
    }

    if (sellPrice.lt(product.price)) {
      const err = new Error('Storefront price cannot be lower than base price');
      err.statusCode = 400;
      throw err;
    }

    const lineTotal = sellPrice.mul(new Prisma.Decimal(String(it.quantity)));
    subtotal = subtotal.add(lineTotal);
    return {
      productId: it.productId,
      quantity: it.quantity,
      recipientPhone: it.recipientPhone,
      unitPrice: sellPrice,
      lineTotal,
      agentCostPrice: product.price,
    };
  });

  const total = subtotal;
  return { normalized, subtotal, total, orderItemsData };
}

async function creditAgentProfitForOrder(tx, order) {
  if (!order?.agentStorefrontId || order?.agentProfitCreditedAt) return order;

  const profit = computeAgentProfit(order.items || []);
  if (profit.isZero()) {
    return tx.order.update({ where: { id: order.id }, data: { agentProfitCreditedAt: new Date() } });
  }

  await tx.user.update({
    where: { id: order.userId },
    data: { walletBalance: { increment: profit } },
  });
  await tx.walletTransaction.create({
    data: {
      userId: order.userId,
      type: 'DEPOSIT',
      amount: profit,
      reference: `AGENT_PROFIT:${order.orderCode || order.id}`,
    },
  });

  return tx.order.update({ where: { id: order.id }, data: { agentProfitCreditedAt: new Date() } });
}

router.post(
  '/paystack/quote',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { items } = req.body || {};
    const role = await getUserRole(req.user?.sub, req.user?.role);
    const { subtotal, total } = await computeOrderFromItems(items, role);

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
  '/paystack/initialize-storefront',
  asyncHandler(async (req, res) => {
    const { customerName, customerEmail, customerPhone, customerAddress, items, callbackUrl, storefrontSlug } = req.body || {};
    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!storefrontSlug) return res.status(400).json({ error: 'Missing storefront slug' });
    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }
    if (!callbackUrl) {
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    const storefront = await prisma.agentStorefront.findUnique({ where: { slug: String(storefrontSlug) } });
    if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

    const { normalized, subtotal, total } = await computeStorefrontOrderFromItems(items, storefront.id);

    const netPesewas = toPesewas(total);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    const secretKey = assertPaystackKey();

    const payload = {
      email: customerEmail,
      amount: grossAmountPesewas,
      callback_url: callbackUrl,
      metadata: {
        type: 'storefront_order',
        storefrontSlug: storefront.slug,
        storefrontId: storefront.id,
        agentUserId: storefront.userId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress: normalizedCustomerAddress,
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
  '/paystack/quote-storefront',
  asyncHandler(async (req, res) => {
    const { items, storefrontSlug } = req.body || {};
    if (!storefrontSlug) return res.status(400).json({ error: 'Missing storefront slug' });

    const storefront = await prisma.agentStorefront.findUnique({ where: { slug: String(storefrontSlug) } });
    if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

    const { subtotal, total } = await computeStorefrontOrderFromItems(items, storefront.id);

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
    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    if (!callbackUrl) {
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    const role = await getUserRole(userId, req.user?.role);
    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role);

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
        customerAddress: normalizedCustomerAddress,
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
      storefrontSlug: bodyStorefrontSlug,
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
      const isStorefrontOrder = String(verifiedMeta.type || '') === 'storefront_order';
      const items = verifiedMeta.items ?? bodyItems;
      const customerName = verifiedMeta.customerName ?? bodyCustomerName;
      const customerEmail = verifiedMeta.customerEmail ?? bodyCustomerEmail;
      const customerPhone = verifiedMeta.customerPhone ?? bodyCustomerPhone;
      const customerAddressRaw = verifiedMeta.customerAddress ?? bodyCustomerAddress;
      const customerAddress = customerAddressRaw ? String(customerAddressRaw) : '';

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing order items' });
      }

      if (!customerName || !customerEmail || !customerPhone) {
        return res.status(400).json({ error: 'Missing customer fields' });
      }

      if (isStorefrontOrder) {
        const storefrontSlug = verifiedMeta.storefrontSlug ?? bodyStorefrontSlug;
        if (!storefrontSlug) {
          return res.status(400).json({ error: 'Missing storefront slug' });
        }

        const storefront = await prisma.agentStorefront.findUnique({ where: { slug: String(storefrontSlug) } });
        if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

        const { normalized, subtotal, total, orderItemsData } = await computeStorefrontOrderFromItems(items, storefront.id);
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

          const profit = computeAgentProfit(orderItemsData);

          const order = await tx.order.create({
            data: {
              orderCode: generateOrderCode(),
              userId: storefront.userId,
              agentStorefrontId: storefront.id,
              agentProfitCreditedAt: new Date(),
              customerName: String(customerName),
              customerEmail: String(customerEmail),
              customerPhone: String(customerPhone),
              customerAddress,
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
                  agentCostPrice: d.agentCostPrice,
                })),
              },
            },
            include: { items: { include: { product: true } } },
          });

          if (!profit.isZero()) {
            await tx.user.update({ where: { id: storefront.userId }, data: { walletBalance: { increment: profit } } });
            await tx.walletTransaction.create({
              data: {
                userId: storefront.userId,
                type: 'DEPOSIT',
                amount: profit,
                reference: `AGENT_PROFIT:${order.orderCode || order.id}`,
              },
            });
          }

          return order;
        });

        queueHubnetForOrder(created.id).catch((e) => console.error(e));
        return res.status(201).json(created);
      }

      const userId = verifiedMeta.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId metadata' });
      }

      if (verifiedMeta.type && String(verifiedMeta.type) !== 'order') {
        return res.status(400).json({ error: 'Invalid order metadata' });
      }

      const role = await getUserRole(userId, verifiedMeta.role);
      const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role);

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
            customerAddress,
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
      if (existing.agentStorefrontId && !existing.agentProfitCreditedAt) {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: existing.id },
            include: { items: true },
          });
          if (order) await creditAgentProfitForOrder(tx, order);
        });
      }
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

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          ...(expectedPaid !== expectedFromTotal ? { total: pesewasToDecimal(expectedPaid) } : {}),
        },
        include: { items: { include: { product: true } } },
      });
      await creditAgentProfitForOrder(tx, updatedOrder);
      return updatedOrder;
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
    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    const role = await getUserRole(userId, req.user?.role);
    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role);

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
          customerAddress: normalizedCustomerAddress,
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

router.post(
  '/agent-upgrade/initialize',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { callbackUrl, email } = req.body || {};

    if (!callbackUrl) {
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'AGENT') {
      return res.status(400).json({ error: 'You are already an agent' });
    }

    const contactEmail = email || user.email;
    if (!contactEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const netAmountPesewas = toPesewas(AGENT_UPGRADE_FEE_GHS);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    const secretKey = assertPaystackKey();

    const payload = {
      email: contactEmail,
      amount: grossAmountPesewas,
      callback_url: callbackUrl,
      metadata: {
        type: 'agent_upgrade',
        userId,
        amount: AGENT_UPGRADE_FEE_GHS,
        netAmountPesewas,
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

    return res.json({
      authorizationUrl: data.data.authorization_url,
      reference,
      amount: AGENT_UPGRADE_FEE_GHS,
      fee: (feePesewas / 100).toFixed(2),
      total: (grossAmountPesewas / 100).toFixed(2),
    });
  })
);

router.post(
  '/agent-upgrade/complete-public',
  asyncHandler(async (req, res) => {
    const { reference } = req.body || {};
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
    const meta = vdata?.data?.metadata || {};
    const userId = meta.userId;
    const netAmountPesewas = meta.netAmountPesewas != null ? Number(meta.netAmountPesewas) : toPesewas(AGENT_UPGRADE_FEE_GHS);
    const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId metadata' });
    }
    if (meta.type && String(meta.type) !== 'agent_upgrade') {
      return res.status(400).json({ error: 'Invalid upgrade metadata' });
    }
    if (status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }
    if (paidAmount !== grossAmountPesewas) {
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    const current = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, email: true, name: true, phone: true, role: true, walletBalance: true, createdAt: true, updatedAt: true },
    });

    if (!current) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (current.role === 'AGENT') {
      return res.json({ user: publicUser(current), alreadyAgent: true });
    }

    const updated = await prisma.user.update({
      where: { id: current.id },
      data: { role: 'AGENT' },
      select: { id: true, email: true, name: true, phone: true, role: true, walletBalance: true, createdAt: true, updatedAt: true },
    });

    return res.json({ user: publicUser(updated) });
  })
);

module.exports = router;
