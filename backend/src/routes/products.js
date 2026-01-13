const express = require('express');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 24;
    const skip = Math.max(0, (page - 1) * limit);

    const where = {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        category
          ? {
              category: {
                OR: [{ id: category }, { slug: category }, { name: { equals: category, mode: 'insensitive' } }],
              },
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({ items, total, page, limit });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    const byId = await prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (byId) return res.json(byId);

    const bySlug = await prisma.product.findUnique({ where: { slug: id }, include: { category: true } });
    if (bySlug) return res.json(bySlug);

    return res.status(404).json({ error: 'Product not found' });
  })
);

router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, slug, description, price, stock, categoryId, imageUrls } = req.body || {};

    if (!name || !slug || !description || price == null || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price: new Prisma.Decimal(String(price)),
        stock: stock == null ? 0 : Number(stock),
        categoryId,
        imageUrls: Array.isArray(imageUrls) ? imageUrls.map(String) : [],
      },
      include: { category: true },
    });

    return res.status(201).json(created);
  })
);

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { name, slug, description, price, stock, categoryId, imageUrls } = req.body || {};

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name != null ? { name } : {}),
        ...(slug != null ? { slug } : {}),
        ...(description != null ? { description } : {}),
        ...(price != null ? { price: new Prisma.Decimal(String(price)) } : {}),
        ...(stock != null ? { stock: Number(stock) } : {}),
        ...(categoryId != null ? { categoryId } : {}),
        ...(imageUrls != null ? { imageUrls: Array.isArray(imageUrls) ? imageUrls.map(String) : [] } : {}),
      },
      include: { category: true },
    });

    return res.json(updated);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    await prisma.product.delete({ where: { id } });
    return res.status(204).send();
  })
);

module.exports = router;
