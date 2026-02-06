const express = require('express');

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');
const { computePaystackGrossAmountPesewas } = require('../lib/paystackFees');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

function assertPaystackKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const err = new Error('Paystack is not configured');
    err.statusCode = 500;
    throw err;
  }
  return key;
}

function toPesewas(amountGhs) {
  const n = Number(amountGhs);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function pesewasToDecimalString(pesewas) {
  const n = Number(pesewas);
  if (!Number.isFinite(n) || n <= 0) return '0.00';
  return (n / 100).toFixed(2);
}

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return res.json({ walletBalance: String(user?.walletBalance || '0') });
  })
);

router.post(
  '/deposit/paystack/complete-public',
  asyncHandler(async (req, res) => {
    const { reference, amount: bodyAmount } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Missing reference' });

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
    const amount = meta.amount ?? bodyAmount;
    const netAmountPesewas = meta.netAmountPesewas != null ? Number(meta.netAmountPesewas) : toPesewas(amount);
    const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    if (!userId) return res.status(400).json({ error: 'Missing userId metadata' });
    if (meta.type && String(meta.type) !== 'wallet_deposit') return res.status(400).json({ error: 'Invalid deposit metadata' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Missing amount' });
    if (status !== 'success') return res.status(400).json({ error: 'Payment not successful' });
    if (paidAmount !== grossAmountPesewas) return res.status(400).json({ error: 'Payment amount mismatch' });

    const existing = await prisma.walletTransaction.findFirst({ where: { reference: String(reference) } });
    if (existing) {
      const u = await prisma.user.findUnique({ where: { id: String(userId) }, select: { walletBalance: true } });
      return res.json({ walletBalance: u?.walletBalance || '0' });
    }

    const delta = new Prisma.Decimal(String(amount));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: { userId: String(userId), type: 'DEPOSIT', amount: delta, reference: String(reference) },
      });

      return tx.user.update({
        where: { id: String(userId) },
        data: { walletBalance: { increment: delta } },
        select: { walletBalance: true },
      });
    });

    return res.json({ walletBalance: updated.walletBalance });
  })
);

router.post(
  '/deposit/paystack/quote',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const netAmountPesewas = toPesewas(amount);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    return res.json({
      amount: Number(amount),
      fee: pesewasToDecimalString(feePesewas),
      total: pesewasToDecimalString(grossAmountPesewas),
    });
  })
);

router.post(
  '/deposit/paystack/initialize',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { amount, email, callbackUrl } = req.body || {};

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!callbackUrl) return res.status(400).json({ error: 'Missing callbackUrl' });

    const netAmountPesewas = toPesewas(amount);
    const { feePesewas, grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    const secretKey = assertPaystackKey();

    const payload = {
      email,
      amount: grossAmountPesewas,
      callback_url: callbackUrl,
      metadata: {
        userId,
        type: 'wallet_deposit',
        amount: Number(amount),
        netAmountPesewas,
        grossAmountPesewas,
        feePesewas,
      },
    };

    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok || !data?.status) {
      return res.status(502).json({ error: data?.message || 'Failed to initialize payment' });
    }

    return res.json({
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      amount: Number(amount),
      fee: pesewasToDecimalString(feePesewas),
      total: pesewasToDecimalString(grossAmountPesewas),
    });
  })
);

router.post(
  '/deposit/paystack/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { reference, amount } = req.body || {};

    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const secretKey = assertPaystackKey();

    const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
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
    const netAmountPesewas = meta.netAmountPesewas != null ? Number(meta.netAmountPesewas) : toPesewas(amount);
    const { grossAmountPesewas } = computePaystackGrossAmountPesewas(netAmountPesewas);

    if (status !== 'success') return res.status(400).json({ error: 'Payment not successful' });
    if (paidAmount !== grossAmountPesewas) return res.status(400).json({ error: 'Payment amount mismatch' });

    const existing = await prisma.walletTransaction.findFirst({ where: { reference: String(reference) } });
    if (existing) {
      const u = await prisma.user.findUnique({ where: { id: String(userId) }, select: { walletBalance: true } });
      return res.json({ walletBalance: u?.walletBalance || '0' });
    }

    const delta = new Prisma.Decimal(String(amount));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: { userId, type: 'DEPOSIT', amount: delta, reference: String(reference) },
      });

      return tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: delta } }, select: { walletBalance: true } });
    });

    return res.json({ walletBalance: updated.walletBalance });
  })
);

const WITHDRAWAL_FEE_PERCENT = new Prisma.Decimal('0.02');
const WITHDRAWAL_MIN_GHS = new Prisma.Decimal('50');

router.post(
  '/withdraw',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const { amount: rawAmount } = req.body || {};

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    const amountDec = new Prisma.Decimal(amount.toFixed(2));

    if (amountDec.lt(WITHDRAWAL_MIN_GHS)) {
      return res.status(400).json({ error: `Minimum withdrawal is GHS ${WITHDRAWAL_MIN_GHS}` });
    }

    const fee = new Prisma.Decimal(amountDec.mul(WITHDRAWAL_FEE_PERCENT).toFixed(2));
    const totalDeducted = amountDec.add(fee);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const balance = new Prisma.Decimal(user.walletBalance || '0');
    if (balance.lt(totalDeducted)) {
      return res.status(400).json({ error: 'Insufficient wallet balance (amount + 2% fee)' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount: amountDec,
          reference: `WITHDRAW:${Date.now()}`,
        },
      });

      if (!fee.isZero()) {
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'SPEND',
            amount: fee,
            reference: `WITHDRAW_FEE:${Date.now()}`,
          },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: totalDeducted } },
        select: { walletBalance: true },
      });
    });

    return res.json({
      walletBalance: String(updated.walletBalance),
      withdrawn: String(amountDec),
      fee: String(fee),
      totalDeducted: String(totalDeducted),
    });
  })
);

router.post(
  '/withdraw/quote',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount: rawAmount } = req.body || {};
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const amountDec = new Prisma.Decimal(amount.toFixed(2));
    const fee = new Prisma.Decimal(amountDec.mul(WITHDRAWAL_FEE_PERCENT).toFixed(2));
    const totalDeducted = amountDec.add(fee);

    return res.json({
      amount: String(amountDec),
      fee: String(fee),
      totalDeducted: String(totalDeducted),
    });
  })
);

module.exports = router;
