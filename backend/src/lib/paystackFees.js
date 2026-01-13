function getPaystackFeeConfig() {
  const percent = Number(process.env.PAYSTACK_FEE_PERCENT ?? '1.95');
  const flatGhs = Number(process.env.PAYSTACK_FEE_FLAT_GHS ?? '0');
  const capGhsRaw = process.env.PAYSTACK_FEE_CAP_GHS;
  const capGhs = capGhsRaw == null || capGhsRaw === '' ? null : Number(capGhsRaw);

  return {
    percent: Number.isFinite(percent) ? percent : 1.95,
    flatGhs: Number.isFinite(flatGhs) ? flatGhs : 0,
    capGhs: capGhs != null && Number.isFinite(capGhs) ? capGhs : null,
  };
}

function roundUpPesewas(n) {
  return Math.ceil(Number(n));
}

function computePaystackGrossAmountPesewas(netAmountPesewas) {
  const net = Number(netAmountPesewas);
  if (!Number.isFinite(net) || net <= 0) {
    return { netAmountPesewas: 0, feePesewas: 0, grossAmountPesewas: 0 };
  }

  const { percent, flatGhs, capGhs } = getPaystackFeeConfig();
  const decimalFee = percent / 100;
  const flatPesewas = roundUpPesewas(flatGhs * 100);
  const capPesewas = capGhs == null ? null : roundUpPesewas(capGhs * 100);

  const applicableFeesIfNotPassing = roundUpPesewas(net * decimalFee + flatPesewas);

  let gross;
  if (capPesewas != null && applicableFeesIfNotPassing > capPesewas) {
    gross = net + capPesewas;
  } else {
    gross = roundUpPesewas((net + flatPesewas) / (1 - decimalFee) + 1);
  }

  const fee = Math.max(0, gross - net);
  return { netAmountPesewas: net, feePesewas: fee, grossAmountPesewas: gross };
}

module.exports = {
  computePaystackGrossAmountPesewas,
  getPaystackFeeConfig,
};
