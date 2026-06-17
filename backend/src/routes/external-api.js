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

    return res.json({
      status: 'success',
      message: 'Packages retrieved successfully',
      packages: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        network: p.category?.name,
        network_slug: p.category?.slug,
        price: Number(p.price).toFixed(2),
        stock: p.stock,
      })),
    });
  })
);

router.post(
  '/orders',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const apiUser = req.apiUser;
    const { package_id, recipient_number, quantity: rawQty, customer_reference } = req.body || {};

    if (!package_id) return res.status(400).json({ status: 'error', message: 'package_id is required' });
    if (!recipient_number) return res.status(400).json({ status: 'error', message: 'recipient_number is required' });

    const quantity = Math.max(1, Number(rawQty || 1) || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ status: 'error', message: 'quantity must be between 1 and 20' });
    }

    const product = await prisma.product.findUnique({
      where: { id: String(package_id) },
      include: { category: true },
    });

    if (!product) return res.status(404).json({ status: 'error', message: 'Package not found' });
    if (product.stock < quantity) {
      return res.status(400).json({ status: 'error', message: `Insufficient stock. Available: ${product.stock}` });
    }

    const unitPrice = new Prisma.Decimal(product.price);
    const lineTotal = unitPrice.mul(quantity);

    const orderCode = generateApiOrderCode();
    const externalReference = customer_reference ? String(customer_reference).slice(0, 100) : null;

    const order = await prisma.$transaction(async (tx) => {
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
    const hubnetStatus = item?.hubnetStatus ?? null;

    const statusMap = {
      PENDING: 'pending',
      SENDING: 'processing',
      SUBMITTED: 'processing',
      DELIVERED: 'delivered',
      FAILED: 'failed',
    };
    const orderStatus = hubnetStatus ? (statusMap[hubnetStatus] ?? 'processing') : 'pending';

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
