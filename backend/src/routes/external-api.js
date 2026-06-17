/**
 * External API v1
 * Authenticated via x-api-key header.
 * Allows third-party websites to place data bundle orders.
 */

const crypto = require('crypto');
const express = require('express');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireApiKey } = require('../middleware/auth');
const { queueFulfillmentForOrder } = require('../lib/fulfillment');

const router = express.Router();

function generateApiOrderCode() {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `API-${yyyymmdd}-${rand}`;
}

function toPesewas(ghsDecimal) {
  return Math.round(Number(ghsDecimal) * 100);
}

function getNetworkIdFromSlug(slug) {
  const mapping = {
    'mtn': 1,
    'telecel': 2,
    'airteltigo': 3,
    'at-ishare': 3,
    'at-bigtime': 4,
    'airtel': 5,
    'vodafone': 6,
  };
  return mapping[String(slug || '').toLowerCase()] || null;
}

function parseVolumeMbFromProductName(name) {
  if (!name) return null;
  const match = String(name).match(/(\d+)\s*(?:gb|mb)/i);
  if (!match) return null;
  const value = Number(match[1]);
  const isGb = String(name).toLowerCase().includes('gb');
  return isGb ? value * 1000 : value;
}

router.get(
  '/networks',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { enabled: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    return res.json({
      status: 'success',
      message: 'Networks retrieved successfully',
      networks: categories.map((c) => ({
        network_id: getNetworkIdFromSlug(c.slug),
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
    });
  })
);

router.get(
  '/packages',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { network } = req.query;

    const where = { stock: { gt: 0 } };
    if (network) {
      const category = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: String(network) },
            { name: { contains: String(network), mode: 'insensitive' } },
          ],
          enabled: true,
        },
      });
      if (!category) return res.status(404).json({ status: 'error', message: 'Network not found' });
      where.categoryId = category.id;
    } else {
      const enabledCategories = await prisma.category.findMany({ where: { enabled: true }, select: { id: true } });
      where.categoryId = { in: enabledCategories.map((c) => c.id) };
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ categoryId: 'asc' }, { price: 'asc' }],
    });

    const userRole = req.apiUser?.role || 'USER';

    return res.json({
      status: 'success',
      message: 'Packages retrieved successfully',
      packages: products.map((p) => {
        const rawPrice =
          userRole === 'SUPER_AGENT'
            ? (p.superAgentPrice ?? p.agentPrice ?? p.price)
            : userRole === 'AGENT' || userRole === 'ADMIN'
              ? (p.agentPrice ?? p.price)
              : p.price;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          network_id: getNetworkIdFromSlug(p.category?.slug),
          network: p.category?.name,
          network_slug: p.category?.slug,
          volume_mb: parseVolumeMbFromProductName(p.name),
          price: Number(rawPrice).toFixed(2),
          stock: p.stock,
        };
      }),
    });
  })
);

router.post(
  '/orders',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const apiUser = req.apiUser;
    const { package_id, network_id, volume_mb, recipient_number, quantity: rawQty, customer_reference } = req.body || {};

    if (!recipient_number) return res.status(400).json({ status: 'error', message: 'recipient_number is required' });

    let product;

    if (package_id) {
      product = await prisma.product.findUnique({
        where: { id: String(package_id) },
        include: { category: true },
      });
      if (!product) return res.status(404).json({ status: 'error', message: 'Package not found' });
    } else if (network_id != null && volume_mb != null) {
      const networkIdNum = Number(network_id);
      const volumeMbNum = Number(volume_mb);
      if (!Number.isInteger(networkIdNum) || !Number.isInteger(volumeMbNum)) {
        return res.status(400).json({ status: 'error', message: 'network_id and volume_mb must be integers' });
      }

      const allCategories = await prisma.category.findMany({
        where: { enabled: true },
        select: { id: true, slug: true },
      });
      const matchingCategory = allCategories.find((c) => getNetworkIdFromSlug(c.slug) === networkIdNum);
      if (!matchingCategory) {
        return res.status(404).json({ status: 'error', message: `Network ID ${networkIdNum} not found` });
      }

      const candidates = await prisma.product.findMany({
        where: { categoryId: matchingCategory.id, stock: { gt: 0 } },
        include: { category: true },
      });

      product = candidates.find((p) => parseVolumeMbFromProductName(p.name) === volumeMbNum);
      if (!product) {
        return res.status(404).json({ status: 'error', message: `No package found for network_id ${networkIdNum} with volume ${volumeMbNum}MB` });
      }
    } else {
      return res.status(400).json({ status: 'error', message: 'Either package_id or (network_id + volume_mb) is required' });
    }

    if (!product) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const quantity = Math.max(1, Number(rawQty || 1) || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ status: 'error', message: 'quantity must be between 1 and 20' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ status: 'error', message: `Insufficient stock. Available: ${product.stock}` });
    }

    // Role-aware pricing
    const userRole = apiUser.role || 'USER';
    const rawUnitPrice =
      userRole === 'SUPER_AGENT'
        ? (product.superAgentPrice ?? product.agentPrice ?? product.price)
        : userRole === 'AGENT' || userRole === 'ADMIN'
          ? (product.agentPrice ?? product.price)
          : product.price;
    const unitPrice = new Prisma.Decimal(rawUnitPrice);
    const lineTotal = unitPrice.mul(quantity);

    // Wallet balance check
    const walletBalance = new Prisma.Decimal(apiUser.walletBalance ?? 0);
    if (walletBalance.lt(lineTotal)) {
      return res.status(400).json({ status: 'error', message: `Insufficient wallet balance. Required: GHS ${Number(lineTotal).toFixed(2)}, Available: GHS ${Number(walletBalance).toFixed(2)}` });
    }

    const orderCode = generateApiOrderCode();
    const externalReference = customer_reference ? String(customer_reference).slice(0, 100) : null;

    const order = await prisma.$transaction(async (tx) => {
      // Deduct wallet balance
      await tx.user.update({
        where: { id: apiUser.id },
        data: { walletBalance: { decrement: lineTotal } },
      });

      // Record wallet spend
      await tx.walletTransaction.create({
        data: {
          userId: apiUser.id,
          type: 'SPEND',
          amount: lineTotal,
          reference: orderCode,
        },
      });

      // Decrement stock
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: quantity } },
      });

      return tx.order.create({
        data: {
          orderCode,
          userId: apiUser.id,
          customerName: apiUser.name || apiUser.email,
          customerEmail: apiUser.email,
          customerPhone: String(recipient_number),
          customerAddress: '',
          subtotal: lineTotal,
          total: lineTotal,
          paymentProvider: 'api',
          paymentReference: orderCode,
          paymentStatus: 'PAID',
          status: 'PENDING',
          items: {
            create: [
              {
                productId: product.id,
                quantity,
                unitPrice,
                lineTotal,
                recipientPhone: String(recipient_number),
              },
            ],
          },
        },
        include: {
          items: { include: { product: { include: { category: true } } } },
        },
      });
    });

    queueFulfillmentForOrder(order.id).catch((e) => console.error('[external-api] fulfillment error', e));

    return res.status(201).json({
      status: 'success',
      message: 'Order placed successfully',
      order: {
        reference: order.orderCode,
        external_reference: externalReference,
        status: 'pending',
        recipient_number: String(recipient_number),
        package: {
          id: product.id,
          name: product.name,
          network: product.category?.name,
        },
        quantity,
        unit_price: Number(unitPrice).toFixed(2),
        total: Number(lineTotal).toFixed(2),
        created_at: order.createdAt,
      },
    });
  })
);

router.get(
  '/orders/:reference',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const reference = String(req.params.reference || '').trim();
    if (!reference) return res.status(400).json({ status: 'error', message: 'reference is required' });

    const apiUser = req.apiUser;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderCode: reference }, { paymentReference: reference }],
        userId: apiUser.id,
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });

    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const item = order.items[0];

    // Use order.status (same source of truth as the website dashboard)
    const statusMap = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'delivered',
      FAILED: 'failed',
    };
    const orderStatus = statusMap[order.status] ?? 'pending';

    return res.json({
      status: 'success',
      message: 'Order retrieved successfully',
      order: {
        reference: order.orderCode,
        status: orderStatus,
        api_status: 'success',
        recipient_number: order.customerPhone,
        package: item
          ? {
              id: item.product?.id,
              name: item.product?.name,
              network: item.product?.category?.name,
            }
          : null,
        quantity: item?.quantity ?? 1,
        unit_price: item ? Number(item.unitPrice).toFixed(2) : null,
        total: Number(order.total).toFixed(2),
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
    });
  })
);

router.get(
  '/balance',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const apiUser = req.apiUser;
    const user = await prisma.user.findUnique({
      where: { id: apiUser.id },
      select: { walletBalance: true },
    });

    return res.json({
      status: 'success',
      message: 'Balance retrieved successfully',
      balance: {
        available: Number(user?.walletBalance ?? 0).toFixed(2),
        currency: 'GHS',
      },
    });
  })
);

module.exports = router;
