function getElitnutConfig() {
  const baseUrlRaw = process.env.ELITNUT_BASE_URL;
  const apiKey = process.env.ELITNUT_API_KEY;
  const baseUrl = baseUrlRaw ? String(baseUrlRaw).replace(/\/+$/, '') : 'https://elitnut.com';
  return { baseUrl, apiKey };
}

function assertElitnutReady() {
  const { apiKey } = getElitnutConfig();
  if (!apiKey) {
    const err = new Error('ElitNut is not configured');
    err.statusCode = 500;
    throw err;
  }
}

function elitnutHeaders() {
  const { apiKey } = getElitnutConfig();
  return {
    Authorization: `Bearer ${String(apiKey)}`,
    'Content-Type': 'application/json',
  };
}

async function elitnutInitiateTransaction({ network, number, reference, packageMb }) {
  assertElitnutReady();
  const { baseUrl } = getElitnutConfig();

  const payload = {
    network: String(network),
    number: String(number),
    reference: String(reference),
    package: Number(packageMb),
  };

  const r = await fetch(`${baseUrl}/api_init`, {
    method: 'POST',
    headers: elitnutHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'ElitNut transaction failed');
    err.statusCode = 502;
    err.elitnutResponse = data;
    throw err;
  }

  return data;
}

async function elitnutGetTransactionHistory({ network, reference }) {
  assertElitnutReady();
  const { baseUrl } = getElitnutConfig();

  const url = new URL(`${baseUrl}/api_req`);
  url.searchParams.set('network', String(network));
  if (reference) url.searchParams.set('reference', String(reference));

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: elitnutHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to fetch ElitNut transactions');
    err.statusCode = 502;
    err.elitnutResponse = data;
    throw err;
  }

  return data;
}

module.exports = {
  getElitnutConfig,
  elitnutInitiateTransaction,
  elitnutGetTransactionHistory,
};
