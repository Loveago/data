const express = require('express');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAgent } = require('../middleware/auth');

const router = express.Router();

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toDecimal(value) {
  const v = value == null ? '' : String(value).trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

function publicStorefront(storefront) {
  if (!storefront) return null;
  return {
    id: storefront.id,
    slug: storefront.slug,
    title: storefront.title,
    welcomeMessage: storefront.welcomeMessage,
    heroEmoji: storefront.heroEmoji,
    accentColor: storefront.accentColor,
    createdAt: storefront.createdAt,
    updatedAt: storefront.updatedAt,
  };
}

async function ensureStorefrontForUser(user) {
  const base = slugify(user?.name || user?.email?.split('@')[0] || 'agent');
  const baseSlug = base || `agent-${user.id.slice(-6)}`;
  let slug = baseSlug;

  let storefront = await prisma.agentStorefront.findUnique({ where: { userId: user.id } });
  if (storefront) return storefront;

  let attempt = 0;
  while (attempt < 5) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    slug = `${baseSlug}${suffix}`;
    try {
      storefront = await prisma.agentStorefront.create({
        data: {
          userId: user.id,
          slug,
          title: `${user.name || user.email || 'Agent'} Store`,
          welcomeMessage: `Welcome to ${user.name || 'our'} data store.`,
          heroEmoji: '🛰️',
          accentColor: '#1d4ed8',
        },
      });
      return storefront;
    } catch (e) {
      if (e?.code === 'P2002') {
        const existing = await prisma.agentStorefront.findUnique({ where: { userId: user.id } });
        if (existing) return existing;
      }
      attempt += 1;
      if (attempt >= 5) throw e;
    }
  }

  return storefront;
}

router.get(
  '/me',
  requireAuth,
  requireAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storefront = await ensureStorefrontForUser(user);
    const prices = await prisma.agentStorefrontPrice.findMany({
      where: { storefrontId: storefront.id },
      include: { product: { include: { category: true } } },
    });

    return res.json({
      storefront: publicStorefront(storefront),
      prices: prices.map((p) => ({
        id: p.id,
        productId: p.productId,
        sellPrice: String(p.sellPrice),
        product: p.product,
      })),
    });
  })
);

router.put(
  '/me',
  requireAuth,
  requireAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { title, welcomeMessage, heroEmoji, accentColor, slug } = req.body || {};

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storefront = await ensureStorefrontForUser(user);
    const updates = {};

    if (title != null) updates.title = String(title).trim() || storefront.title;
    if (welcomeMessage != null) updates.welcomeMessage = String(welcomeMessage).trim();
    if (heroEmoji != null) updates.heroEmoji = String(heroEmoji).trim();
    if (accentColor != null) updates.accentColor = String(accentColor).trim();

    if (slug != null) {
      const nextSlug = slugify(slug);
      if (!nextSlug) return res.status(400).json({ error: 'Invalid slug' });
      updates.slug = nextSlug;
    }

    try {
      const updated = await prisma.agentStorefront.update({ where: { id: storefront.id }, data: updates });
      return res.json({ storefront: publicStorefront(updated) });
    } catch (e) {
      if (e?.code === 'P2002') return res.status(409).json({ error: 'Slug already in use' });
      throw e;
    }
  })
);

router.get(
  '/me/products',
  requireAuth,
  requireAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storefront = await ensureStorefrontForUser(user);
    const products = await prisma.product.findMany({ include: { category: true } });
    const prices = await prisma.agentStorefrontPrice.findMany({ where: { storefrontId: storefront.id } });
    const priceByProduct = new Map(prices.map((p) => [p.productId, p]));

    const items = products.map((product) => {
      const price = priceByProduct.get(product.id);
      return {
        product,
        sellPrice: price ? String(price.sellPrice) : null,
      };
    });

    return res.json({
      storefront: publicStorefront(storefront),
      items,
    });
  })
);

router.put(
  '/me/prices',
  requireAuth,
  requireAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { prices } = req.body || {};
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'Prices must be an array' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storefront = await ensureStorefrontForUser(user);
    const productIds = Array.from(new Set(prices.map((p) => p.productId).filter(Boolean)));

    if (productIds.length === 0) return res.status(400).json({ error: 'Missing product ids' });

    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) return res.status(400).json({ error: 'One or more products not found' });

    const productById = new Map(products.map((p) => [p.id, p]));

    const updates = prices.map((p) => {
      const productId = String(p.productId);
      const raw = p.sellPrice;
      const rawStr = raw == null ? '' : String(raw).trim();
      if (!rawStr) {
        return prisma.agentStorefrontPrice.deleteMany({ where: { storefrontId: storefront.id, productId } });
      }

      const sellPrice = toDecimal(rawStr);
      if (!sellPrice) {
        const err = new Error('Invalid sell price');
        err.statusCode = 400;
        throw err;
      }
      const product = productById.get(productId);
      if (!product) {
        const err = new Error('Product not found');
        err.statusCode = 400;
        throw err;
      }
      if (sellPrice.lt(product.price)) {
        const err = new Error('Sell price cannot be lower than base price');
        err.statusCode = 400;
        throw err;
      }
      return prisma.agentStorefrontPrice.upsert({
        where: { storefrontId_productId: { storefrontId: storefront.id, productId } },
        create: { storefrontId: storefront.id, productId, sellPrice },
        update: { sellPrice },
      });
    });

    await prisma.$transaction(updates);
    const updated = await prisma.agentStorefrontPrice.findMany({
      where: { storefrontId: storefront.id },
      include: { product: { include: { category: true } } },
    });

    return res.json({
      storefront: publicStorefront(storefront),
      prices: updated.map((p) => ({
        id: p.id,
        productId: p.productId,
        sellPrice: String(p.sellPrice),
        product: p.product,
      })),
    });
  })
);

router.get(
  '/public/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').trim();
    const storefront = await prisma.agentStorefront.findUnique({ where: { slug } });
    if (!storefront) return res.status(404).json({ error: 'Storefront not found' });

    const prices = await prisma.agentStorefrontPrice.findMany({
      where: { storefrontId: storefront.id },
      include: { product: { include: { category: true } } },
    });

    const items = prices.map((price) => ({
      product: price.product,
      sellPrice: String(price.sellPrice),
    }));

    return res.json({
      storefront: publicStorefront(storefront),
      items,
    });
  })
);

module.exports = router;
