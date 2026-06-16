'use strict';

const { prisma } = require('./prisma');
const { settleUnpaidOrder } = require('./orderSettlement');

const RECONCILE_CUTOFF_MIN = Math.max(0, Number(process.env.RECONCILE_CUTOFF_MIN ?? 1));
const RECONCILE_MAX_AGE_HOURS = Math.max(1, Number(process.env.RECONCILE_MAX_AGE_HOURS || 48));
const RECONCILE_BATCH = Math.min(100, Math.max(1, Number(process.env.RECONCILE_BATCH || 50)));
const RECONCILE_INTERVAL_MS = Math.max(30_000, Number(process.env.RECONCILE_INTERVAL_MS || 60_000));

let workerRunning = false;
let workerTimer = null;

/**
 * Finds all UNPAID paystack orders and verifies them against the Paystack API.
 * Successfully paid orders are settled (stock decremented, fulfillment queued).
 * Safe to call concurrently - skips if a run is already in progress.
 *
 * @returns {Promise<object>} Run statistics
 */
async function reconcileUnpaidOrders() {
  if (workerRunning) {
    return { skipped: true, reason: 'already running' };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { error: 'Paystack not configured' };
  }

  workerRunning = true;

  try {
    const now = new Date();
    const cutoffOld = new Date(now.getTime() - RECONCILE_MAX_AGE_HOURS * 60 * 60 * 1000);
    const createdAtFilter =
      RECONCILE_CUTOFF_MIN > 0
        ? { gt: cutoffOld, lt: new Date(now.getTime() - RECONCILE_CUTOFF_MIN * 60 * 1000) }
        : { gt: cutoffOld };

    const unpaid = await prisma.order.findMany({
      where: {
        paymentStatus: 'UNPAID',
        paymentProvider: 'paystack',
        paymentReference: { not: null },
        createdAt: createdAtFilter,
      },
      select: { id: true, paymentReference: true, total: true, orderCode: true },
      take: RECONCILE_BATCH,
      orderBy: { createdAt: 'asc' },
    });

    let settled = 0;
    let failed = 0;
    let notReady = 0;

    for (const order of unpaid) {
      try {
        const ref = order.paymentReference;

        const vr = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
          { headers: { Authorization: `Bearer ${secretKey}` } }
        );
        const vdata = await vr.json();

        if (!vr.ok || vdata?.data?.status !== 'success') {
          notReady++;
          continue;
        }

        const paidAmount = Number(vdata.data.amount);
        const expectedPesewas = Math.round(Number(order.total) * 100);

        if (paidAmount !== expectedPesewas) {
          console.warn('[reconcile] amount mismatch, skipping', {
            orderId: order.id,
            orderCode: order.orderCode,
            ref,
            paidAmount,
            expectedPesewas,
          });
          notReady++;
          continue;
        }

        await settleUnpaidOrder(order.id, paidAmount);
        console.log('[reconcile] settled order', order.orderCode || order.id);
        settled++;
      } catch (e) {
        console.error('[reconcile] error processing order', order.orderCode || order.id, e?.message);
        failed++;
      }
    }

    const result = { total: unpaid.length, settled, failed, notReady };
    if (unpaid.length > 0) {
      console.log('[reconcile] run complete', result);
    }
    return result;
  } finally {
    workerRunning = false;
  }
}

/**
 * Start the background reconcile worker interval.
 * Safe to call multiple times - only starts once.
 */
function startReconcileWorker() {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    reconcileUnpaidOrders().catch((e) => console.error('[reconcile] worker error', e?.message));
  }, RECONCILE_INTERVAL_MS);
  console.log(`[reconcile] worker started (interval: ${RECONCILE_INTERVAL_MS / 1000}s, cutoff: ${RECONCILE_CUTOFF_MIN}min)`);
}

module.exports = { reconcileUnpaidOrders, startReconcileWorker };
