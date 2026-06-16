'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma');
const { queueFulfillmentForOrder } = require('./fulfillment');

const MAX_ORDER_LINE_QUANTITY = Math.max(1, Number(process.env.MAX_ORDER_LINE_QUANTITY || 20) || 20);
const REFERRAL_BONUS_PERCENT = new Prisma.Decimal('0.03');

function toPesewas(decimal) {
  const n = Number(decimal);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
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

async function creditReferralBonus(tx, userId, subtotal, orderCode) {
  if (!userId) return;
  const buyer = await tx.user.findUnique({ where: { id: String(userId) }, select: { referredById: true } });
  if (!buyer?.referredById) return;

  const bonus = new Prisma.Decimal(subtotal).mul(REFERRAL_BONUS_PERCENT);
  if (bonus.isZero() || bonus.isNegative()) return;

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

/**
 * Settle an UNPAID paystack order that has been verified as successfully paid.
 * Idempotent: returns immediately if the order is already PAID.
 *
 * @param {string} orderId - DB order ID
 * @param {number} verifiedAmountPesewas - Amount confirmed by Paystack (in pesewas)
 * @returns {Promise<object>} The settled order
 */
async function settleUnpaidOrder(orderId, verifiedAmountPesewas) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    if (order.paymentStatus === 'PAID') {
      return { order, alreadyPaid: true };
    }

    if (order.paymentStatus !== 'UNPAID') {
      const err = new Error('Order cannot be settled - unexpected payment status');
      err.statusCode = 409;
      throw err;
    }

    const invalidItem = findInvalidPersistedOrderItem(order.items);
    if (invalidItem) {
      const err = new Error(invalidItem.reason);
      err.statusCode = 409;
      throw err;
    }

    const expectedPesewas = toPesewas(order.total);
    if (verifiedAmountPesewas !== expectedPesewas) {
      const err = new Error(
        `Payment amount mismatch: paid ${verifiedAmountPesewas} pesewas, expected ${expectedPesewas}`
      );
      err.statusCode = 400;
      throw err;
    }

    const insufficient = order.items.find((it) => (it.product?.stock ?? 0) < it.quantity);

    if (!insufficient) {
      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID' },
      include: { items: { include: { product: true } } },
    });

    await creditAgentProfitForOrder(tx, updatedOrder);
    await creditReferralBonus(tx, updatedOrder.userId, updatedOrder.subtotal, updatedOrder.orderCode);

    return { order: updatedOrder, alreadyPaid: false };
  });

  if (!result.alreadyPaid) {
    queueFulfillmentForOrder(result.order.id).catch((e) =>
      console.error('[orderSettlement] fulfillment queue error', e?.message)
    );
  }

  return result.order;
}

module.exports = {
  toPesewas,
  computeAgentProfit,
  creditReferralBonus,
  creditAgentProfitForOrder,
  findInvalidPersistedOrderItem,
  settleUnpaidOrder,
};
