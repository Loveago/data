function computePaystackGrossAmountPesewas(netAmountPesewas) {
  const net = Number(netAmountPesewas);
  if (!Number.isFinite(net) || net <= 0) {
    return { netAmountPesewas: 0, feePesewas: 0, grossAmountPesewas: 0 };
  }

  const fee = Math.round(net * 0.0195);
  const gross = net + fee;
  return { netAmountPesewas: net, feePesewas: fee, grossAmountPesewas: gross };
}

module.exports = {
  computePaystackGrossAmountPesewas,
  getPaystackFeeConfig,
};
