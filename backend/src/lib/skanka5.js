const DEFAULT_BASE_URL = 'https://agent.skanka5.com/api/v1';

function getSkanka5Config() {
  const apiKey = process.env.SKANKA5_API_KEY ? String(process.env.SKANKA5_API_KEY) : '';
  const baseUrl = process.env.SKANKA5_BASE_URL
    ? String(process.env.SKANKA5_BASE_URL).replace(/\/+$/, '')
    : DEFAULT_BASE_URL;
  return { apiKey, baseUrl };
}

function skanka5Headers() {
  const { apiKey } = getSkanka5Config();
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  };
}

function assertSkanka5Ready() {
  const { apiKey } = getSkanka5Config();
  if (!apiKey) {
    const err = new Error('Skanka5 API key is not configured');
    err.statusCode = 500;
    throw err;
  }
}

async function skanka5PlaceOrder({ networkId, msisdn, volumeMb, reference }) {
  assertSkanka5Ready();
  const { baseUrl } = getSkanka5Config();

  const payload = {
    network_id: Number(networkId),
    msisdn: String(msisdn),
    volume_mb: Number(volumeMb),
  };

  const headers = { ...skanka5Headers() };
  if (reference) {
    headers['Idempotency-Key'] = String(reference).slice(0, 255);
  }

  const r = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false) {
    const err = new Error(data?.error || data?.message || 'Skanka5 order failed');
    err.statusCode = 502;
    err.skanka5Response = data;
    throw err;
  }

  return data;
}

async function skanka5CheckStatus(reference) {
  assertSkanka5Ready();
  const { baseUrl } = getSkanka5Config();
  const ref = encodeURIComponent(String(reference || '').trim());
  if (!ref) {
    const err = new Error('Skanka5 reference is required to check order status');
    err.statusCode = 400;
    throw err;
  }

  const r = await fetch(`${baseUrl}/orders/${ref}`, {
    method: 'GET',
    headers: skanka5Headers(),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || data?.success === false) {
    const err = new Error(data?.error || data?.message || 'Failed to check Skanka5 order status');
    err.statusCode = 502;
    err.skanka5Response = data;
    throw err;
  }

  return data;
}

module.exports = {
  getSkanka5Config,
  skanka5PlaceOrder,
  skanka5CheckStatus,
};
