const express = require('express');

const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return res.json({ items });
  })
);

router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, slug } = req.body || {};
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const created = await prisma.category.create({ data: { name, slug } });
    return res.status(201).json(created);
  })
);

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { name, slug } = req.body || {};

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name != null ? { name } : {}),
        ...(slug != null ? { slug } : {}),
      },
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
    await prisma.category.delete({ where: { id } });
    return res.status(204).send();
  })
);

module.exports = router;
