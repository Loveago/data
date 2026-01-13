const DEFAULT_BASE_URL = 'https://www.datahubnet.online/api';

function getDatahubnetConfig() {
  const apiKey = process.env.DATAHUBNET_API_KEY ? String(process.env.DATAHUBNET_API_KEY) : '';
  const baseUrl = process.env.DATAHUBNET_BASE_URL ? String(process.env.DATAHUBNET_BASE_URL) : DEFAULT_BASE_URL;
  const authSchemeRaw = process.env.DATAHUBNET_AUTH_SCHEME ? String(process.env.DATAHUBNET_AUTH_SCHEME) : 'Api-Key';
  const authScheme = authSchemeRaw.trim() || 'Api-Key';

  const authSchemeStatusRaw = process.env.DATAHUBNET_AUTH_SCHEME_STATUS
    ? String(process.env.DATAHUBNET_AUTH_SCHEME_STATUS)
    : '';
  const authSchemeStatus = authSchemeStatusRaw.trim() || null;

  return { apiKey, baseUrl, authScheme, authSchemeStatus };
}

function datahubnetHeaders(overrideAuthScheme) {
  const { apiKey, authScheme } = getDatahubnetConfig();
  const scheme = overrideAuthScheme ? String(overrideAuthScheme) : authScheme;
  return {
    Authorization: `${scheme} ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function assertDatahubnetReady() {
  const { apiKey } = getDatahubnetConfig();
  if (!apiKey) {
    const err = new Error('DataHubnet API key is not configured');
    err.statusCode = 500;
    throw err;
  }
}

async function datahubnetGetPackages() {
  assertDatahubnetReady();
  const { baseUrl } = getDatahubnetConfig();

  const r = await fetch(`${baseUrl}/v1/packages`, {
    method: 'GET',
    headers: datahubnetHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to fetch DataHubnet packages');
    err.statusCode = 502;
    err.datahubnetResponse = data;
    throw err;
  }

  return data;
}

async function datahubnetGetBalance() {
  assertDatahubnetReady();
  const { baseUrl } = getDatahubnetConfig();

  const r = await fetch(`${baseUrl}/user/balance/`, {
    method: 'GET',
    headers: datahubnetHeaders(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to fetch DataHubnet balance');
    err.statusCode = 502;
    err.datahubnetResponse = data;
    throw err;
  }

  return data;
}

async function datahubnetPlaceOrder({ phone, network, capacity, reference, express }) {
  assertDatahubnetReady();
  const { baseUrl } = getDatahubnetConfig();

  const payload = {
    phone: String(phone),
    network: String(network),
    capacity: Number(capacity),
    reference: String(reference),
    ...(express == null ? {} : { express: Boolean(express) }),
  };

  const r = await fetch(`${baseUrl}/v1/placeOrder/`, {
    method: 'POST',
    headers: datahubnetHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'DataHubnet order failed');
    err.statusCode = 502;
    err.datahubnetResponse = data;
    throw err;
  }

  return data;
}

async function datahubnetCheckStatus(orderIdOrReference) {
  assertDatahubnetReady();
  const { baseUrl, authSchemeStatus } = getDatahubnetConfig();

  const id = encodeURIComponent(String(orderIdOrReference));
  const r = await fetch(`${baseUrl}/v1/check-status/${id}`, {
    method: 'GET',
    headers: datahubnetHeaders(authSchemeStatus),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to check DataHubnet status');
    err.statusCode = 502;
    err.datahubnetResponse = data;
    throw err;
  }

  return data;
}

module.exports = {
  getDatahubnetConfig,
  datahubnetGetPackages,
  datahubnetGetBalance,
  datahubnetPlaceOrder,
  datahubnetCheckStatus,
};
