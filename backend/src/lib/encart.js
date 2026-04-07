const DEFAULT_BASE_URL = 'https://encartastores.com/api';

function getEncartConfig() {
  const apiKey = process.env.ENCART_API_KEY ? String(process.env.ENCART_API_KEY) : '';
  const baseUrl = process.env.ENCART_BASE_URL ? String(process.env.ENCART_BASE_URL).replace(/\/+$/, '') : DEFAULT_BASE_URL;
  return { apiKey, baseUrl };
}

function encartHeaders() {
  const { apiKey } = getEncartConfig();
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

function assertEncartReady() {
  const { apiKey } = getEncartConfig();
  if (!apiKey) {
    const err = new Error('Encart API key is not configured');
    err.statusCode = 500;
    throw err;
  }
}

async function encartGetBalance() {
  assertEncartReady();
  const { baseUrl } = getEncartConfig();

  const r = await fetch(`${baseUrl}/balance`, {
    method: 'GET',
    headers: encartHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.error || data?.message || 'Failed to fetch Encart balance');
    err.statusCode = 502;
    err.encartResponse = data;
    throw err;
  }

  return data;
}

async function encartPurchase({ networkKey, recipient, capacity }) {
  assertEncartReady();
  const { baseUrl } = getEncartConfig();

  const payload = {
    networkKey: String(networkKey),
    recipient: String(recipient),
    capacity: Number(capacity),
  };

  const r = await fetch(`${baseUrl}/purchase`, {
    method: 'POST',
    headers: encartHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false || data?.status === false) {
    const err = new Error(data?.error || data?.message || 'Encart purchase failed');
    err.statusCode = 502;
    err.encartResponse = data;
    throw err;
  }

  return data;
}

async function encartCheckStatus(reference) {
  assertEncartReady();
  const { baseUrl } = getEncartConfig();
  const ref = encodeURIComponent(String(reference || '').trim());
  if (!ref) {
    const err = new Error('Encart reference is required to check order status');
    err.statusCode = 400;
    throw err;
  }

  const url = new URL(`${baseUrl}/orders`);
  url.searchParams.set('reference', ref);

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: encartHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false || data?.status === false) {
    const err = new Error(data?.error || data?.message || 'Failed to check Encart order status');
    err.statusCode = 502;
    err.encartResponse = data;
    throw err;
  }

  return data;
}

module.exports = {
  getEncartConfig,
  encartGetBalance,
  encartPurchase,
  encartCheckStatus,
};
