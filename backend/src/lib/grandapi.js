const DEFAULT_BASE_URL = 'https://grandapi.duckdns.org/api';

function getGrandapiConfig() {
  const apiKey = process.env.GRANDAPI_API_KEY ? String(process.env.GRANDAPI_API_KEY) : '';
  const baseUrl = process.env.GRANDAPI_BASE_URL ? String(process.env.GRANDAPI_BASE_URL) : DEFAULT_BASE_URL;
  const bundleTypeRaw = process.env.GRANDAPI_BUNDLE_TYPE ? String(process.env.GRANDAPI_BUNDLE_TYPE) : 'EXPIRING';
  const bundleType = bundleTypeRaw.trim() || 'EXPIRING';
  const callbackUrl = process.env.GRANDAPI_CALLBACK_URL ? String(process.env.GRANDAPI_CALLBACK_URL) : '';
  return { apiKey, baseUrl, bundleType, callbackUrl };
}

function grandapiHeaders() {
  const { apiKey } = getGrandapiConfig();
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

function assertGrandapiReady() {
  const { apiKey } = getGrandapiConfig();
  if (!apiKey) {
    const err = new Error('GrandAPI API key is not configured');
    err.statusCode = 500;
    throw err;
  }
}

async function grandapiGetBalance() {
  assertGrandapiReady();
  const { baseUrl } = getGrandapiConfig();

  const r = await fetch(`${baseUrl}/balance`, {
    method: 'GET',
    headers: grandapiHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.error || data?.message || 'Failed to fetch GrandAPI balance');
    err.statusCode = 502;
    err.grandapiResponse = data;
    throw err;
  }

  return data;
}

async function grandapiGetPackages({ network, type }) {
  assertGrandapiReady();
  const { baseUrl } = getGrandapiConfig();
  const params = new URLSearchParams();
  if (network) params.set('network', String(network));
  if (type) params.set('type', String(type));

  const r = await fetch(`${baseUrl}/packages?${params.toString()}`, {
    method: 'GET',
    headers: grandapiHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.error || data?.message || 'Failed to fetch GrandAPI packages');
    err.statusCode = 502;
    err.grandapiResponse = data;
    throw err;
  }

  return data;
}

async function grandapiPlaceOrder({ phone, network, size, type, packageId, callback }) {
  assertGrandapiReady();
  const { baseUrl, callbackUrl } = getGrandapiConfig();

  const payload = {
    packages: [
      {
        packageId: String(packageId),
        size: Number(size),
        network: String(network),
        type: String(type),
        phone: String(phone),
        ...(callback || callbackUrl ? { callback: String(callback || callbackUrl) } : {}),
      },
    ],
  };

  const r = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: grandapiHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false || data?.status === false) {
    const err = new Error(data?.error || data?.message || 'GrandAPI order failed');
    err.statusCode = 502;
    err.grandapiResponse = data;
    throw err;
  }

  return data;
}

async function grandapiCheckStatus(orderId) {
  assertGrandapiReady();
  const { baseUrl } = getGrandapiConfig();
  const id = encodeURIComponent(String(orderId));

  const r = await fetch(`${baseUrl}/orders/${id}`, {
    method: 'GET',
    headers: grandapiHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false || data?.status === false) {
    const err = new Error(data?.error || data?.message || 'Failed to check GrandAPI status');
    err.statusCode = 502;
    err.grandapiResponse = data;
    throw err;
  }

  return data;
}

module.exports = {
  getGrandapiConfig,
  grandapiGetBalance,
  grandapiGetPackages,
  grandapiPlaceOrder,
  grandapiCheckStatus,
};
