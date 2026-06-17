const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const Prisma = require('@prisma/client').Prisma;

const router = express.Router();

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

router.get(
  '/my-products',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, referredById: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const [products, referralPrices] = await Promise.all([
      prisma.product.findMany({
        where: { category: { enabled: true } },
        include: { category: true },
        orderBy: [{ categoryId: 'asc' }, { price: 'asc' }],
      }),
      user.referredById
        ? prisma.referralPrice.findMany({ where: { referrerId: user.referredById } })
        : Promise.resolve([]),
    ]);

    const referralPriceById = new Map(referralPrices.map((p) => [p.productId, p.price]));

    const items = products.map((product) => {
      let basePrice =
        user.role === 'SUPER_AGENT'
          ? product.superAgentPrice ?? product.agentPrice ?? product.price
          : user.role === 'AGENT' || user.role === 'ADMIN'
            ? product.agentPrice ?? product.price
            : product.price;

      const referralPrice = referralPriceById.get(product.id);
      const effectivePrice = referralPrice ?? basePrice;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        stock: product.stock,
        category: product.category,
        imageUrls: product.imageUrls,
        basePrice: String(basePrice),
        referralPrice: referralPrice ? String(referralPrice) : null,
        effectivePrice: String(effectivePrice),
        isReferralPrice: !!referralPrice,
      };
    });

    return res.json({ items, total: items.length });
  })
);

router.get(
  '/my-referral-pricing',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const referralPrices = await prisma.referralPrice.findMany({
      where: { referrerId: userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            agentPrice: true,
            superAgentPrice: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const userRole = user?.role || 'USER';

    const pricesWithBasePrice = referralPrices.map((rp) => {
      const basePrice =
        userRole === 'SUPER_AGENT'
          ? rp.product.superAgentPrice ?? rp.product.agentPrice ?? rp.product.price
          : userRole === 'AGENT' || userRole === 'ADMIN'
            ? rp.product.agentPrice ?? rp.product.price
            : rp.product.price;

      return {
        id: rp.id,
        productId: rp.product.id,
        productName: rp.product.name,
        productSlug: rp.product.slug,
        category: rp.product.category,
        basePrice: String(basePrice),
        referralPrice: String(rp.price),
        markup: String(new Prisma.Decimal(rp.price).minus(new Prisma.Decimal(basePrice))),
        createdAt: rp.createdAt,
        updatedAt: rp.updatedAt,
      };
    });

    return res.json({
      referralPrices: pricesWithBasePrice,
      userRole,
    });
  })
);

router.post(
  '/set-referral-price',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { productId, price: rawPrice } = req.body || {};

    if (!productId || rawPrice == null) {
      return res.status(400).json({ error: 'Product ID and price are required' });
    }

    const price = new Prisma.Decimal(String(rawPrice));

    if (price.isNegative() || price.isZero()) {
      return res.status(400).json({ error: 'Price must be greater than zero' });
    }

    const product = await prisma.product.findUnique({ where: { id: String(productId) } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const userRole = user?.role || 'USER';

    const basePrice =
      userRole === 'SUPER_AGENT'
        ? product.superAgentPrice ?? product.agentPrice ?? product.price
        : userRole === 'AGENT' || userRole === 'ADMIN'
          ? product.agentPrice ?? product.price
          : product.price;

    if (price.lt(new Prisma.Decimal(basePrice))) {
      return res.status(400).json({
        error: `Referral price cannot be lower than your base price (${String(basePrice)})`,
      });
    }

    const referralPrice = await prisma.referralPrice.upsert({
      where: { referrerId_productId: { referrerId: userId, productId: String(productId) } },
      create: {
        referrerId: userId,
        productId: String(productId),
        price,
      },
      update: { price },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            agentPrice: true,
            superAgentPrice: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });

    return res.json({
      id: referralPrice.id,
      productId: referralPrice.product.id,
      productName: referralPrice.product.name,
      productSlug: referralPrice.product.slug,
      category: referralPrice.product.category,
      basePrice: String(basePrice),
      referralPrice: String(referralPrice.price),
      markup: String(new Prisma.Decimal(referralPrice.price).minus(new Prisma.Decimal(basePrice))),
      createdAt: referralPrice.createdAt,
      updatedAt: referralPrice.updatedAt,
    });
  })
);

router.delete(
  '/referral-price/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { id } = req.params;

    const referralPrice = await prisma.referralPrice.findUnique({ where: { id: String(id) } });
    if (!referralPrice) {
      return res.status(404).json({ error: 'Referral price not found' });
    }

    if (referralPrice.referrerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.referralPrice.delete({ where: { id: String(id) } });

    return res.json({ success: true });
  })
);

module.exports = router;
