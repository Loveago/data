const { prisma } = require('./prisma');

const { datahubnetCheckStatus, datahubnetPlaceOrder } = require('./datahubnet');

const DEFAULT_BASE_URL = 'https://console.hubnet.app/live/api/context/business/transaction';

function getHubnetConfig() {
  const enabledRaw = process.env.HUBNET_ENABLED;
  const enabled = enabledRaw == null ? true : String(enabledRaw).toLowerCase() === 'true';

  const apiKey = process.env.HUBNET_API_KEY ? String(process.env.HUBNET_API_KEY) : '';
  const baseUrl = process.env.HUBNET_BASE_URL ? String(process.env.HUBNET_BASE_URL) : DEFAULT_BASE_URL;
  const webhookUrl = process.env.HUBNET_WEBHOOK_URL ? String(process.env.HUBNET_WEBHOOK_URL) : '';

  const intervalMsRaw = process.env.HUBNET_DISPATCH_INTERVAL_MS;
  const intervalMs = Math.max(5000, Number(intervalMsRaw || 13000) || 13000);

  let mapping = {};
  const mapRaw = process.env.HUBNET_NETWORK_MAP;
  if (mapRaw) {
    try {
      mapping = JSON.parse(mapRaw);
    } catch {
      const err = new Error('Invalid HUBNET_NETWORK_MAP JSON');
      err.statusCode = 500;
      throw err;
    }

  }

  return { enabled, apiKey, baseUrl, webhookUrl, intervalMs, mapping };
}

async function dispatchOneDatahubnetItem(intervalMs) {
  const cutoff = new Date(Date.now() - intervalMs);
  const datahubnetCapacityMap = getDatahubnetCapacityMap();
  const telecelNetwork = getDatahubnetTelecelNetwork();

  const candidate = await prisma.orderItem.findFirst({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      fulfillmentProvider: 'datahubnet',
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
  });

  if (!candidate) return false;

  const claimed = await prisma.orderItem.updateMany({
    where: {
      id: candidate.id,
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      fulfillmentProvider: 'datahubnet',
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
      ],
    },
    data: {
      hubnetStatus: 'SENDING',
      hubnetAttempts: { increment: 1 },
      hubnetLastAttemptAt: new Date(),
      hubnetLastError: null,
      hubnetNetwork: telecelNetwork,
    },
  });

  if (!claimed || claimed.count !== 1) return true;

  const item = await prisma.orderItem.findUnique({
    where: { id: candidate.id },
    include: { order: true, product: { include: { category: true } } },
  });

  if (!item) return true;

  const phone = item.recipientPhone || item.order?.customerPhone;
  const volumeMb = item.hubnetVolumeMb || parseVolumeMbFromProduct(item.product);
  const capacity = resolveDatahubnetCapacity(item.product, volumeMb, datahubnetCapacityMap);
  const reference = item.hubnetReference || buildDatahubnetReference(item.orderId, item.id);

  if (!phone || !capacity) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: !phone ? 'Missing recipient phone' : 'Unable to determine bundle size (capacity)',
        hubnetNetwork: telecelNetwork,
        hubnetReference: reference,
      },
    });
    return true;
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      hubnetNetwork: telecelNetwork,
      hubnetVolumeMb: volumeMb,
      hubnetReference: reference,
    },
  });

  try {
    const res = await datahubnetPlaceOrder({
      phone,
      network: telecelNetwork,
      capacity,
      reference,
      express: true,
    });

    const errorText = res?.error != null ? String(res.error) : '';
    if (errorText) {
      const err = new Error(errorText);
      err.statusCode = 502;
      throw err;
    }

    const remoteId = res?.data?.order_id || res?.order_id || res?.id;

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'SUBMITTED',
        hubnetTransactionId: remoteId ? String(remoteId) : item.hubnetTransactionId,
      },
    });
  } catch (e) {
    const message = e?.message ? String(e.message) : 'DataHubnet request failed';
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: message,
      },
    });
  }

  return true;
}

async function pollOneDatahubnetItem(intervalMs) {
  const cutoff = new Date(Date.now() - intervalMs);

  const item = await prisma.orderItem.findFirst({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      fulfillmentProvider: 'datahubnet',
      hubnetStatus: 'SUBMITTED',
      OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }],
    },
    include: { order: true },
    orderBy: { updatedAt: 'asc' },
  });

  if (!item) return false;

  await prisma.orderItem.update({
    where: { id: item.id },
    data: { hubnetLastAttemptAt: new Date() },
  });

  try {
    const checkId = item.hubnetTransactionId || item.hubnetReference;
    const res = await datahubnetCheckStatus(checkId);
    const statusText = res?.data?.order?.status || res?.data?.status || res?.status || '';
    const s = String(statusText).toLowerCase();

    if (/deliver|success|completed/.test(s)) {
      const updated = await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'DELIVERED',
          hubnetDeliveredAt: new Date(),
          hubnetLastError: null,
        },
      });

      const remaining = await prisma.orderItem.count({
        where: {
          orderId: updated.orderId,
          hubnetSkip: false,
          NOT: { hubnetStatus: 'DELIVERED' },
        },
      });

      if (remaining === 0) {
        const deliverableCount = await prisma.orderItem.count({
          where: { orderId: updated.orderId, hubnetSkip: false },
        });

        if (deliverableCount > 0) {
          await prisma.order.update({ where: { id: updated.orderId }, data: { status: 'COMPLETED' } });
        }
      }

      return true;
    }

    if (/fail|error|cancel/.test(s)) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'FAILED',
          hubnetLastError: String(statusText || 'DataHubnet failed'),
        },
      });
      return true;
    }
  } catch (e) {
    const message = e?.message ? String(e.message) : 'DataHubnet status check failed';
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { hubnetLastError: message },
    });
  }

  return true;
}

function getFulfillmentProviderMap() {
  const raw = process.env.FULFILLMENT_PROVIDER_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const err = new Error('Invalid FULFILLMENT_PROVIDER_MAP JSON');
    err.statusCode = 500;
    throw err;
  }
}

function getDatahubnetCapacityMap() {
  const raw = process.env.DATAHUBNET_CAPACITY_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const err = new Error('Invalid DATAHUBNET_CAPACITY_MAP JSON');
    err.statusCode = 500;
    throw err;
  }
}

function getDatahubnetTelecelNetwork() {
  const raw = process.env.DATAHUBNET_TELECEL_NETWORK;
  const v = raw == null ? 'telecel' : String(raw).trim();
  return v || 'telecel';
}

function hubnetHeaders(apiKey) {
  return {
    token: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('233')) return `0${digits.slice(3)}`;
  const err = new Error('Invalid phone number');
  err.statusCode = 400;
  throw err;
}

function tryNormalizePhone(phone) {
  try {
    return normalizePhone(phone);
  } catch {
    return null;
  }
}

function parseVolumeMbFromProduct(product) {
  const hay = `${product?.name || ''} ${product?.slug || ''}`;
  const gb = hay.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gb) {
    const n = Number(gb[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1000);
  }

  const mb = hay.match(/(\d+)\s*mb/i);
  if (mb) {
    const n = Number(mb[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function parseCapacityFromProduct(product) {
  const hay = `${product?.name || ''} ${product?.slug || ''}`;
  const gb = hay.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gb) {
    const n = Number(gb[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  const mb = hay.match(/(\d+)\s*mb/i);
  if (mb) {
    const n = Number(mb[1]);
    if (Number.isFinite(n) && n > 0 && n % 1000 === 0) return n / 1000;
  }

  return null;
}

function resolveDatahubnetCapacity(product, volumeMb, capacityMap) {
  const slug = product?.slug ? String(product.slug) : '';
  if (slug && capacityMap && capacityMap[slug] != null) {
    const n = Number(capacityMap[slug]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  if (volumeMb != null && capacityMap && capacityMap[String(volumeMb)] != null) {
    const n = Number(capacityMap[String(volumeMb)]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  return parseCapacityFromProduct(product);
}

function getHubnetNetworkForCategorySlug(categorySlug, mapping) {
  const slug = String(categorySlug || '').toLowerCase();
  if (slug === 'mtn') return 'mtn';
  if (slug === 'airteltigo') return 'at';
  if (slug === 'big-time') return 'big-time';

  if (mapping && mapping[slug]) return String(mapping[slug]);

  return null;
}

function getFulfillmentProviderForCategorySlug(categorySlug, providerMap) {
  const slug = String(categorySlug || '').toLowerCase();
  const mapped = providerMap && providerMap[slug] ? String(providerMap[slug]).toLowerCase() : '';
  if (mapped) return mapped;
  return 'hubnet';
}

function buildHubnetReference(orderId, itemId) {
  const o = String(orderId || '').replace(/\W+/g, '');
  const i = String(itemId || '').replace(/\W+/g, '');
  const ref = `HN-${o.slice(-8)}-${i.slice(-6)}`.toUpperCase();
  return ref.length > 25 ? ref.slice(0, 25) : ref;
}

function buildDatahubnetReference(orderId, itemId) {
  const o = String(orderId || '').replace(/\W+/g, '');
  const i = String(itemId || '').replace(/\W+/g, '');
  const ref = `DH-${o.slice(-8)}-${i.slice(-6)}`.toUpperCase();
  return ref.length > 25 ? ref.slice(0, 25) : ref;
}

async function hubnetCheckBalance() {
  const { enabled, apiKey, baseUrl } = getHubnetConfig();
  if (!enabled) {
    const err = new Error('Hubnet is disabled');
    err.statusCode = 400;
    throw err;
  }
  if (!apiKey) {
    const err = new Error('Hubnet API key is not configured');
    err.statusCode = 500;
    throw err;
  }

  const r = await fetch(`${baseUrl}/check_balance`, { method: 'GET', headers: hubnetHeaders(apiKey) });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.reason || data?.message || 'Failed to check Hubnet balance');
    err.statusCode = 502;
    throw err;
  }
  return data;
}

async function hubnetNewTransaction({ network, phone, volumeMb, reference, referrer, webhook }) {
  const { enabled, apiKey, baseUrl } = getHubnetConfig();
  if (!enabled) {
    const err = new Error('Hubnet is disabled');
    err.statusCode = 400;
    throw err;
  }
  if (!apiKey) {
    const err = new Error('Hubnet API key is not configured');
    err.statusCode = 500;
    throw err;
  }

  const normalizedReferrer = referrer ? tryNormalizePhone(referrer) : null;

  const payload = {
    phone: normalizePhone(phone),
    volume: String(volumeMb),
    reference: String(reference),
    ...(normalizedReferrer ? { referrer: normalizedReferrer } : {}),
    ...(webhook ? { webhook: String(webhook) } : {}),
  };

  const url = `${baseUrl}/${encodeURIComponent(String(network))}-new-transaction`;
  const r = await fetch(url, { method: 'POST', headers: hubnetHeaders(apiKey), body: JSON.stringify(payload) });
  const data = await r.json().catch(() => null);

  if (!r.ok) {
    const err = new Error(data?.reason || data?.message || 'Hubnet request failed');
    err.statusCode = 502;
    err.hubnetResponse = data;
    throw err;
  }

  return data;
}

async function queueHubnetForOrder(orderId) {
  const { enabled, apiKey, webhookUrl, mapping } = getHubnetConfig();

  const providerMap = getFulfillmentProviderMap();
  const datahubnetCapacityMap = getDatahubnetCapacityMap();
  const telecelNetwork = getDatahubnetTelecelNetwork();

  const hubnetConfigured = Boolean(enabled && apiKey);
  const datahubnetConfigured = Boolean(process.env.DATAHUBNET_API_KEY);
  if (!hubnetConfigured && !datahubnetConfigured) return { queued: false };

  const order = await prisma.order.findUnique({
    where: { id: String(orderId) },
    include: { items: { include: { product: { include: { category: true } } } } },
  });

  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (String(order.paymentStatus) !== 'PAID') {
    return { queued: false };
  }

  const deliverable = [];

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const already = item.hubnetStatus;
      if (already && String(already) !== 'FAILED') continue;

      const provider = getFulfillmentProviderForCategorySlug(item.product?.category?.slug, providerMap);

      if (provider === 'datahubnet') {
        if (!datahubnetConfigured) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              hubnetSkip: false,
              hubnetStatus: 'FAILED',
              hubnetNetwork: telecelNetwork,
              hubnetAttempts: { increment: 1 },
              hubnetLastError: 'DataHubnet is not configured',
              hubnetLastAttemptAt: new Date(),
              fulfillmentProvider: 'datahubnet',
            },
          });
          continue;
        }

        const volumeMb = parseVolumeMbFromProduct(item.product);
        const capacity = resolveDatahubnetCapacity(item.product, volumeMb, datahubnetCapacityMap);
        if (!capacity) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              hubnetSkip: false,
              hubnetStatus: 'FAILED',
              hubnetNetwork: telecelNetwork,
              hubnetAttempts: { increment: 1 },
              hubnetLastError: 'Unable to determine bundle size (capacity)',
              hubnetLastAttemptAt: new Date(),
              fulfillmentProvider: 'datahubnet',
            },
          });
          continue;
        }

        const reference = item.hubnetReference || buildDatahubnetReference(order.id, item.id);

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: false,
            hubnetStatus: 'PENDING',
            hubnetNetwork: telecelNetwork,
            hubnetVolumeMb: volumeMb,
            hubnetReference: reference,
            hubnetAttempts: 0,
            hubnetLastAttemptAt: null,
            hubnetLastError: null,
            hubnetTransactionId: null,
            hubnetPaymentId: null,
            fulfillmentProvider: 'datahubnet',
          },
        });

        deliverable.push(item.id);
        continue;
      }

      if (!hubnetConfigured) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: false,
            hubnetStatus: 'FAILED',
            hubnetAttempts: { increment: 1 },
            hubnetLastAttemptAt: new Date(),
            hubnetLastError: 'Hubnet is not configured',
            fulfillmentProvider: 'hubnet',
          },
        });
        continue;
      }

      const network = getHubnetNetworkForCategorySlug(item.product?.category?.slug, mapping);
      if (!network) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: true,
            hubnetStatus: null,
            hubnetNetwork: null,
            hubnetVolumeMb: null,
            hubnetReference: null,
            hubnetTransactionId: null,
            hubnetPaymentId: null,
            hubnetAttempts: 0,
            hubnetLastError: null,
            hubnetLastAttemptAt: null,
            hubnetDeliveredAt: null,
            fulfillmentProvider: 'hubnet',
          },
        });
        continue;
      }
      const volumeMb = parseVolumeMbFromProduct(item.product);
      if (!volumeMb) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: false,
            hubnetStatus: 'FAILED',
            hubnetNetwork: network,
            hubnetAttempts: { increment: 1 },
            hubnetLastError: 'Unable to determine bundle size (volumeMb)',
            hubnetLastAttemptAt: new Date(),
            fulfillmentProvider: 'hubnet',
          },
        });
        continue;
      }

      const reference = item.hubnetReference || buildHubnetReference(order.id, item.id);

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetSkip: false,
          hubnetStatus: 'PENDING',
          hubnetNetwork: network,
          hubnetVolumeMb: volumeMb,
          hubnetReference: reference,
          hubnetAttempts: 0,
          hubnetLastAttemptAt: null,
          hubnetLastError: null,
          hubnetTransactionId: null,
          hubnetPaymentId: null,
          fulfillmentProvider: 'hubnet',
        },
      });

      deliverable.push(item.id);
    }

    if (deliverable.length > 0) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
    }
  });

  return { queued: true };
}

async function dispatchOneHubnetItem() {
  const { enabled, intervalMs, webhookUrl, mapping } = getHubnetConfig();
  if (!enabled) return;

  const cutoff = new Date(Date.now() - intervalMs);

  const candidate = await prisma.orderItem.findFirst({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
        { OR: [{ fulfillmentProvider: null }, { fulfillmentProvider: 'hubnet' }] },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
  });

  if (!candidate) return;

  const claimed = await prisma.orderItem.updateMany({
    where: {
      id: candidate.id,
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
        { OR: [{ fulfillmentProvider: null }, { fulfillmentProvider: 'hubnet' }] },
      ],
    },
    data: {
      hubnetStatus: 'SENDING',
      hubnetAttempts: { increment: 1 },
      hubnetLastAttemptAt: new Date(),
      hubnetLastError: null,
    },
  });

  if (!claimed || claimed.count !== 1) return;

  const item = await prisma.orderItem.findUnique({
    where: { id: candidate.id },
    include: { order: true, product: { include: { category: true } } },
  });

  if (!item) return;

  const network = item.hubnetNetwork || getHubnetNetworkForCategorySlug(item.product?.category?.slug, mapping);
  if (!network) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetAttempts: { increment: 1 },
        hubnetLastAttemptAt: new Date(),
        hubnetLastError: `No Hubnet network mapping for category: ${String(item.product?.category?.slug || 'unknown')}`,
      },
    });
    return;
  }
  const volumeMb = item.hubnetVolumeMb || parseVolumeMbFromProduct(item.product);
  const reference = item.hubnetReference || buildHubnetReference(item.orderId, item.id);

  if (!volumeMb) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetNetwork: network,
        hubnetReference: reference,
        hubnetLastError: 'Unable to determine bundle size (volumeMb)',
      },
    });
    return;
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      hubnetNetwork: network,
      hubnetVolumeMb: volumeMb,
      hubnetReference: reference,
    },
  });

  try {
    const res = await hubnetNewTransaction({
      network,
      phone: item.recipientPhone || item.order?.customerPhone,
      volumeMb,
      reference,
      referrer: item.order?.customerPhone,
      webhook: webhookUrl,
    });

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'SUBMITTED',
        hubnetTransactionId: res?.transaction_id ? String(res.transaction_id) : item.hubnetTransactionId,
        hubnetPaymentId: res?.payment_id ? String(res.payment_id) : item.hubnetPaymentId,
      },
    });
  } catch (e) {
    const message = e?.message ? String(e.message) : 'Hubnet request failed';
    const permanent = /not eligible|contact the administrator/i.test(message);
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: message,
        ...(permanent ? { hubnetAttempts: 6 } : {}),
      },
    });
  }
}

let dispatcherTimer = null;
let dispatcherInFlight = false;

function startHubnetDispatcher() {
  const { enabled, apiKey, intervalMs } = getHubnetConfig();
  const datahubnetConfigured = Boolean(process.env.DATAHUBNET_API_KEY);
  if ((!enabled || !apiKey) && !datahubnetConfigured) return;
  if (dispatcherTimer) return;

  dispatcherTimer = setInterval(() => {
    if (dispatcherInFlight) return;
    dispatcherInFlight = true;
    Promise.resolve()
      .then(async () => {
        const dispatchedDatahubnet = await dispatchOneDatahubnetItem(intervalMs);
        if (dispatchedDatahubnet) return;
        const polledDatahubnet = await pollOneDatahubnetItem(intervalMs);
        if (polledDatahubnet) return;
        await dispatchOneHubnetItem();
      })
      .catch((e) => console.error(e))
      .finally(() => {
        dispatcherInFlight = false;
      });
  }, intervalMs);
}

async function applyHubnetWebhookUpdate(payload) {
  const reference = payload?.reference
    ? String(payload.reference)
    : payload?.data?.reference
      ? String(payload.data.reference)
      : payload?.data?.transaction?.reference
        ? String(payload.data.transaction.reference)
        : '';
  if (!reference) {
    const err = new Error('Missing reference');
    err.statusCode = 400;
    throw err;
  }

  const okRoot = payload?.status === true;
  const okNested = payload?.data?.status === true;
  const statusText = payload?.delivery_status || payload?.status_text || payload?.data?.delivery_status || payload?.data?.status;
  const deliveredText = typeof statusText === 'string' && /deliver|success|completed/i.test(statusText);
  const delivered = okRoot || okNested || deliveredText;

  const update = delivered
    ? {
        hubnetStatus: 'DELIVERED',
        hubnetDeliveredAt: new Date(),
        hubnetLastError: null,
        ...(payload?.transaction_id
          ? { hubnetTransactionId: String(payload.transaction_id) }
          : payload?.data?.transaction_id
            ? { hubnetTransactionId: String(payload.data.transaction_id) }
            : {}),
        ...(payload?.payment_id
          ? { hubnetPaymentId: String(payload.payment_id) }
          : payload?.data?.payment_id
            ? { hubnetPaymentId: String(payload.data.payment_id) }
            : {}),
      }
    : {
        hubnetStatus: 'FAILED',
        hubnetLastError: payload?.reason || payload?.code || payload?.message ? String(payload?.reason || payload?.code || payload?.message) : 'Hubnet failed',
      };

  const existing = await prisma.orderItem.findUnique({ where: { hubnetReference: reference } });
  if (!existing) return null;

  const item = await prisma.orderItem.update({ where: { id: existing.id }, data: update });

  const remaining = await prisma.orderItem.count({
    where: {
      orderId: item.orderId,
      hubnetSkip: false,
      NOT: { hubnetStatus: 'DELIVERED' },
    },
  });

  if (remaining === 0) {
    const deliverableCount = await prisma.orderItem.count({
      where: { orderId: item.orderId, hubnetSkip: false },
    });

    if (deliverableCount > 0) {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: 'COMPLETED' } });
    }
  }

  return item;
}

module.exports = {
  hubnetCheckBalance,
  hubnetNewTransaction,
  queueHubnetForOrder,
  startHubnetDispatcher,
  applyHubnetWebhookUpdate,
};
