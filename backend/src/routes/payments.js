const express = require('express');

const crypto = require('crypto');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { computePaystackGrossAmountPesewas } = require('../lib/paystackFees');
const { queueFulfillmentForOrder } = require('../lib/fulfillment');
const { createRateLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const AGENT_UPGRADE_FEE_GHS = 40;
const MAX_ORDER_LINE_QUANTITY = Math.max(1, Number(process.env.MAX_ORDER_LINE_QUANTITY || 20) || 20);

const paymentInitializeRateLimit = createRateLimiter({
  windowMs: Number(process.env.PAYMENT_INITIALIZE_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.PAYMENT_INITIALIZE_LIMIT || 20),
  keyPrefix: 'payment-initialize',
  message: 'Too many payment initialization attempts. Please try again shortly.',
});

const paymentCompleteRateLimit = createRateLimiter({
  windowMs: Number(process.env.PAYMENT_COMPLETE_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.PAYMENT_COMPLETE_LIMIT || 60),
  keyPrefix: 'payment-complete',
  message: 'Too many payment verification attempts. Please try again shortly.',
});

function generateOrderCode(prefix = 'DASH') {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
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

async function resolveUnitPriceWithReferral(product, role, buyerId) {
  let basePrice = product.price;
  if (role === 'SUPER_AGENT') {
    basePrice = product.superAgentPrice ?? product.agentPrice ?? product.price;
  } else if (role === 'AGENT' || role === 'ADMIN') {
    basePrice = product.agentPrice ?? product.price;
  }

  if (!buyerId) return basePrice;

  const buyer = await prisma.user.findUnique({
    where: { id: String(buyerId) },
    select: { referredById: true },
  });

  if (!buyer?.referredById) return basePrice;

  const referralPrice = await prisma.referralPrice.findUnique({
    where: { referrerId_productId: { referrerId: buyer.referredById, productId: product.id } },
  });

  if (referralPrice) return referralPrice.price;
  return basePrice;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertSafeCallbackUrl(rawUrl) {
  const callbackUrl = normalizeString(rawUrl);
  if (!callbackUrl) {
    const err = new Error('Missing callbackUrl');
    err.statusCode = 400;
    throw err;
  }

  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    const err = new Error('Invalid callbackUrl');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const err = new Error('Invalid callbackUrl protocol');
    err.statusCode = 400;
    throw err;
  }

  const allowedRaw = process.env.PAYSTACK_CALLBACK_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
  const allowedOrigins = allowedRaw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) {
    const err = new Error('callbackUrl origin is not allowed');
    err.statusCode = 400;
    throw err;
  }

  return callbackUrl;
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

function findInvalidPersistedOrderItem(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { reason: 'Order has no items' };
  }

  const bad = items.find(
    (it) => !Number.isInteger(it.quantity) || it.quantity <= 0 || it.quantity > MAX_ORDER_LINE_QUANTITY
  );

  if (!bad) return null;
  return {
    reason: `Invalid item quantity ${String(bad.quantity)} for order item ${String(bad.id || bad.productId || 'unknown')}`,
  };
}

function generateGuestEmail(slug) {
  const base = String(slug || 'storefront').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safe = base || 'storefront';
  return `${safe}-${Date.now()}@guest.lofaq.store`;
}

function ensureCustomerDetails(storefrontSlug, raw = {}) {
  const name = normalizeString(raw.customerName) || 'Guest Buyer';
  const email = normalizeString(raw.customerEmail) || generateGuestEmail(storefrontSlug);
  const phone = normalizeString(raw.customerPhone) || '0000000000';
  const address = normalizeString(raw.customerAddress);
  return { name, email, phone, address };
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

const REFERRAL_BONUS_PERCENT = new Prisma.Decimal('0.03');

async function creditReferralBonus(tx, userId, subtotal, orderCode, orderItems = null) {
  if (!userId) return;
  const buyer = await tx.user.findUnique({ where: { id: String(userId) }, select: { referredById: true, role: true } });
  if (!buyer?.referredById) return;

  let bonus = new Prisma.Decimal('0');

  if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
    for (const item of orderItems) {
      if (!item.productId) continue;

      const referralPrice = await tx.referralPrice.findUnique({
        where: { referrerId_productId: { referrerId: buyer.referredById, productId: item.productId } },
      });

      if (!referralPrice) continue;

      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      const basePrice =
        buyer.role === 'SUPER_AGENT'
          ? product.superAgentPrice ?? product.agentPrice ?? product.price
          : buyer.role === 'AGENT' || buyer.role === 'ADMIN'
            ? product.agentPrice ?? product.price
            : product.price;

      const markup = new Prisma.Decimal(referralPrice.price).minus(new Prisma.Decimal(basePrice));
      const lineProfit = markup.mul(new Prisma.Decimal(String(item.quantity || 1)));
      bonus = bonus.add(lineProfit);
    }
  }

  if (bonus.isZero() || bonus.isNegative()) {
    bonus = new Prisma.Decimal(subtotal).mul(REFERRAL_BONUS_PERCENT);
  }

  const rounded = new Prisma.Decimal(bonus.toFixed(2));
  if (rounded.isZero()) return;

  await tx.user.update({ where: { id: buyer.referredById }, data: { walletBalance: { increment: rounded } } });
  await tx.walletTransaction.create({
    data: {
      userId: buyer.referredById,
      type: 'REFERRAL_BONUS',
      amount: rounded,
      reference: `REF_BONUS:${orderCode || 'order'}`,
    },
  });
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

async function computeOrderFromItems(items, role = 'USER', buyerId = null) {
  const normalized = normalizeOrderItems(items);

  const productIds = Array.from(new Set(normalized.map((it) => it.productId)));
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } });

  if (products.length !== productIds.length) {
    const err = new Error('One or more products not found');
    err.statusCode = 400;
    throw err;
  }

  const disabledCategory = products.find((p) => p.category && p.category.enabled === false);
  if (disabledCategory) {
    const err = new Error('This category is temporarily unavailable');
    err.statusCode = 400;
    throw err;
  }

  const priceById = new Map();
  for (const product of products) {
    const price = await resolveUnitPriceWithReferral(product, role, buyerId);
    priceById.set(product.id, price);
  }

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

  const normalized = normalizeOrderItems(items);

  const productIds = Array.from(new Set(normalized.map((it) => it.productId)));
  const storefront = await prisma.agentStorefront.findUnique({
    where: { id: storefrontId },
    include: { user: { select: { role: true, referredById: true } } },
  });
  const ownerRole = storefront?.user?.role ?? 'USER';
  const ownerId = storefront?.userId;
  const ownerReferrerId = storefront?.user?.referredById;

  const [products, prices, referralPrices] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } }),
    prisma.agentStorefrontPrice.findMany({ where: { storefrontId, productId: { in: productIds } } }),
    ownerReferrerId ? prisma.referralPrice.findMany({ where: { referrerId: ownerReferrerId, productId: { in: productIds } } }) : Promise.resolve([]),
  ]);

  if (products.length !== productIds.length) {
    const err = new Error('One or more products not found');
    err.statusCode = 400;
    throw err;
  }

  const disabledCategory = products.find((p) => p.category && p.category.enabled === false);
  if (disabledCategory) {
    const err = new Error('This category is temporarily unavailable');
    err.statusCode = 400;
    throw err;
  }

  const priceById = new Map(prices.map((p) => [p.productId, p.sellPrice]));
  const referralPriceById = new Map(referralPrices.map((p) => [p.productId, p.price]));
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

    let basePrice =
      ownerRole === 'SUPER_AGENT' ? (product.superAgentPrice ?? product.agentPrice ?? product.price) :
      ownerRole === 'AGENT' || ownerRole === 'ADMIN' ? (product.agentPrice ?? product.price) :
      product.price;

    const referralPrice = referralPriceById.get(it.productId);
    if (referralPrice) {
      basePrice = referralPrice;
    }

    if (sellPrice.lt(basePrice)) {
      const err = new Error('Storefront price cannot be lower than the base price for this product');
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
      agentCostPrice: new Prisma.Decimal(basePrice),
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
    const userId = req.user?.sub;
    const role = await getUserRole(userId, req.user?.role);
    const { subtotal, total } = await computeOrderFromItems(items, role, userId);

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
  paymentInitializeRateLimit,
  asyncHandler(async (req, res) => {
    const { items, callbackUrl, storefrontSlug, customerName, customerEmail, customerPhone, customerAddress } = req.body || {};

    if (!storefrontSlug) return res.status(400).json({ error: 'Missing storefront slug' });
    const safeCallbackUrl = assertSafeCallbackUrl(callbackUrl);

    const storefront = await prisma.agentStorefront.findUnique({ where: { slug: String(storefrontSlug) } });
    if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

    const customerDetails = ensureCustomerDetails(storefront.slug, {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
    });

    const { name, email, phone, address } = customerDetails;

    const { normalized, subtotal, total, orderItemsData } = await computeStorefrontOrderFromItems(items, storefront.id);

    const netPesewas = toPesewas(total);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    const secretKey = assertPaystackKey();

    // Generate order code first so it can be used as the Paystack reference
    // This makes orderCode === paymentReference === Paystack reference for easy tracking
    const pendingOrderCode = generateOrderCode('STORE');

    const payload = {
      email,
      amount: grossAmountPesewas,
      callback_url: safeCallbackUrl,
      reference: pendingOrderCode,
      metadata: {
        type: 'storefront_order',
        storefrontSlug: storefront.slug,
        storefrontId: storefront.id,
        agentUserId: storefront.userId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerAddress: address,
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

    const reference = data?.data?.reference ? String(data.data.reference) : pendingOrderCode;

    try {
      await prisma.order.create({
        data: {
          orderCode: pendingOrderCode,
          userId: storefront.userId,
          agentStorefrontId: storefront.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          customerAddress: address,
          subtotal,
          total: pesewasToDecimal(grossAmountPesewas),
          paymentProvider: 'paystack',
          paymentReference: pendingOrderCode,
          paymentStatus: 'UNPAID',
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
      });
    } catch (e) {
      console.error('[payments] storefront: failed to pre-create UNPAID order', { reference, error: e?.message });
    }

    return res.json({
      authorizationUrl: data.data.authorization_url,
      reference,
      subtotal: String(subtotal),
      fee: (feePesewas / 100).toFixed(2),
      total: (grossAmountPesewas / 100).toFixed(2),
      customer: customerDetails,
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
  paymentInitializeRateLimit,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { customerName, customerEmail, customerPhone, customerAddress, items, callbackUrl } = req.body || {};
    const normalizedCustomerAddress = customerAddress ? String(customerAddress) : '';

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing customer fields' });
    }

    const safeCallbackUrl = assertSafeCallbackUrl(callbackUrl);

    const role = await getUserRole(userId, req.user?.role);
    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role, userId);

    const netPesewas = toPesewas(total);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

    const secretKey = assertPaystackKey();

    const payload = {
      email: customerEmail,
      amount: grossAmountPesewas,
      callback_url: safeCallbackUrl,
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
  paymentCompleteRateLimit,
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
    const verifiedReference = vdata?.data?.reference ? String(vdata.data.reference) : '';
    const paidAmount = Number(vdata?.data?.amount);
    const currency = String(vdata?.data?.currency || '').toUpperCase();
    if (status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    if (!verifiedReference || verifiedReference !== String(reference)) {
      return res.status(400).json({ error: 'Payment reference mismatch' });
    }

    if (currency && currency !== 'GHS') {
      return res.status(400).json({ error: 'Unsupported payment currency' });
    }

    if (!Number.isInteger(paidAmount) || paidAmount <= 0) {
      return res.status(400).json({ error: 'Invalid paid amount' });
    }

    const verifiedMeta = vdata?.data?.metadata || {};
    const metadataGrossAmountPesewas = Number(verifiedMeta?.grossAmountPesewas);
    if (Number.isFinite(metadataGrossAmountPesewas) && metadataGrossAmountPesewas > 0 && paidAmount !== metadataGrossAmountPesewas) {
      console.warn('[payments] paystack metadata gross mismatch', {
        reference: String(reference),
        paidAmount,
        metadataGrossAmountPesewas,
      });
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    const existing = await prisma.order.findFirst({
      where: { paymentProvider: 'paystack', paymentReference: String(reference) },
      include: { items: { include: { product: true } } },
    });

    if (!existing) {
      const isStorefrontOrder = String(verifiedMeta.type || '') === 'storefront_order';
      const items = verifiedMeta.items ?? bodyItems;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing order items' });
      }

      if (isStorefrontOrder) {
        const storefrontSlug = verifiedMeta.storefrontSlug ?? bodyStorefrontSlug;
        if (!storefrontSlug) {
          return res.status(400).json({ error: 'Missing storefront slug' });
        }

        const storefront = await prisma.agentStorefront.findUnique({ where: { slug: String(storefrontSlug) } });
        if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

        const customerDetails = ensureCustomerDetails(storefront.slug, {
          customerName: verifiedMeta.customerName ?? bodyCustomerName,
          customerEmail: verifiedMeta.customerEmail ?? bodyCustomerEmail,
          customerPhone: verifiedMeta.customerPhone ?? bodyCustomerPhone,
          customerAddress: verifiedMeta.customerAddress ?? bodyCustomerAddress,
        });
        const { name, email, phone, address } = customerDetails;

        const { normalized, subtotal, total, orderItemsData } = await computeStorefrontOrderFromItems(items, storefront.id);
        const netPesewas = toPesewas(total);
        const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

        if (paidAmount !== grossAmountPesewas) {
          console.warn('[payments] storefront amount mismatch', {
            reference: String(reference),
            paidAmount,
            grossAmountPesewas,
          });
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

          const orderId = crypto.randomBytes(12).toString('hex').toUpperCase();
          const orderCode = `STORE-${orderId}`;
          const order = await tx.order.create({
            data: {
              orderCode,
              userId: storefront.userId,
              agentStorefrontId: storefront.id,
              agentProfitCreditedAt: new Date(),
              customerName: name,
              customerEmail: email,
              customerPhone: phone,
              customerAddress: address,
              subtotal,
              total: pesewasToDecimal(grossAmountPesewas),
              paymentProvider: 'paystack',
              paymentReference: orderCode,
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

        queueFulfillmentForOrder(created.id).catch((e) => console.error(e));
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
      const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role, userId);

      const customerName = normalizeString(verifiedMeta.customerName ?? bodyCustomerName);
      const customerEmail = normalizeString(verifiedMeta.customerEmail ?? bodyCustomerEmail);
      const customerPhone = normalizeString(verifiedMeta.customerPhone ?? bodyCustomerPhone);
      const customerAddress = normalizeString(verifiedMeta.customerAddress ?? bodyCustomerAddress);

      if (!customerName || !customerEmail || !customerPhone) {
        return res.status(400).json({ error: 'Missing customer fields' });
      }

      const netPesewas = toPesewas(total);
      const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netPesewas);

      if (paidAmount !== grossAmountPesewas) {
        console.warn('[payments] order amount mismatch', {
          reference: String(reference),
          paidAmount,
          grossAmountPesewas,
        });
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

        const orderId = crypto.randomBytes(12).toString('hex').toUpperCase();
        const orderCode = `DASH-${orderId}`;
        const order = await tx.order.create({
          data: {
            orderCode,
            userId: String(userId),
            customerName: String(customerName),
            customerEmail: String(customerEmail),
            customerPhone: String(customerPhone),
            customerAddress,
            subtotal,
            total: pesewasToDecimal(grossAmountPesewas),
            paymentProvider: 'paystack',
            paymentReference: orderCode,
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

        await creditReferralBonus(tx, String(userId), subtotal, order.orderCode, orderItemsData);
        return order;
      });

      queueFulfillmentForOrder(created.id).catch((e) => console.error(e));
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

    const invalidExistingItems = findInvalidPersistedOrderItem(existing.items);
    if (invalidExistingItems) {
      console.warn('[payments] refusing to settle malformed existing order', {
        orderId: existing.id,
        reference: String(reference),
        reason: invalidExistingItems.reason,
      });
      return res.status(409).json({ error: 'Order contains invalid item quantity and cannot be settled' });
    }

    const expectedFromTotal = toPesewas(existing.total);
    if (paidAmount !== expectedFromTotal) {
      console.warn('[payments] existing order amount mismatch', {
        orderId: existing.id,
        reference: String(reference),
        paidAmount,
        expectedFromTotal,
      });
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
        },
        include: { items: { include: { product: true } } },
      });
      await creditAgentProfitForOrder(tx, updatedOrder);
      await creditReferralBonus(tx, updatedOrder.userId, updatedOrder.subtotal, updatedOrder.orderCode, updatedOrder.items);
      return updatedOrder;
    });

    queueFulfillmentForOrder(updated.id).catch((e) => console.error(e));
    return res.status(201).json(updated);
  })
);

router.post(
  '/paystack/complete',
  requireAuth,
  paymentCompleteRateLimit,
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
    const { normalized, subtotal, total, orderItemsData } = await computeOrderFromItems(items, role, userId);

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
    const verifiedReference = vdata?.data?.reference ? String(vdata.data.reference) : '';
    const paidAmount = Number(vdata?.data?.amount);
    const currency = String(vdata?.data?.currency || '').toUpperCase();

    if (status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    if (!verifiedReference || verifiedReference !== String(reference)) {
      return res.status(400).json({ error: 'Payment reference mismatch' });
    }

    if (currency && currency !== 'GHS') {
      return res.status(400).json({ error: 'Unsupported payment currency' });
    }

    if (!Number.isInteger(paidAmount) || paidAmount <= 0) {
      return res.status(400).json({ error: 'Invalid paid amount' });
    }

    const verifiedMeta = vdata?.data?.metadata || {};
    const metadataGrossAmountPesewas = Number(verifiedMeta?.grossAmountPesewas);
    if (Number.isFinite(metadataGrossAmountPesewas) && metadataGrossAmountPesewas > 0 && paidAmount !== metadataGrossAmountPesewas) {
      console.warn('[payments] private complete metadata gross mismatch', {
        reference: String(reference),
        paidAmount,
        metadataGrossAmountPesewas,
      });
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    if (paidAmount !== grossAmountPesewas) {
      console.warn('[payments] private complete amount mismatch', {
        reference: String(reference),
        paidAmount,
        grossAmountPesewas,
      });
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

      const created = await tx.order.create({
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

      await creditReferralBonus(tx, userId, subtotal, created.orderCode, orderItemsData);
      return created;
    });

    queueFulfillmentForOrder(order.id).catch((e) => console.error(e));
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
