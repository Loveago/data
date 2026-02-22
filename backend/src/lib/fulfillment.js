const { prisma } = require('./prisma');
const { datahubnetCheckStatus, datahubnetPlaceOrder } = require('./datahubnet');
const { grandapiCheckStatus, grandapiGetPackages, grandapiPlaceOrder } = require('./grandapi');

const DAY_START_MINUTES = 8 * 60 + 30;
const DAY_END_MINUTES = 18 * 60;
const ENABLE_FULFILLMENT_DEBUG = String(process.env.FULFILLMENT_DEBUG || '').trim().toLowerCase() === 'true';
let runtimeForcedProvider = null;
const SHOULD_USE_DATAHUBNET_EXPRESS = String(process.env.FULFILLMENT_DATAHUBNET_EXPRESS || '')
  .trim()
  .toLowerCase() === 'true';

function debugLog(...args) {
  if (!ENABLE_FULFILLMENT_DEBUG) return;
  const ts = new Date().toISOString();
  console.log('[FULFILLMENT]', ts, ...args);
}

function getDispatchIntervalMs() {
  const raw = process.env.FULFILLMENT_DISPATCH_INTERVAL_MS ?? process.env.HUBNET_DISPATCH_INTERVAL_MS;
  const intervalMs = Math.max(5000, Number(raw || 13000) || 13000);
  return intervalMs;
}

function normalizeForcedProviderValue(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'auto' || v === 'none') return null;
  if (v === 'encart') return 'grandapi';
  if (v === 'grandapi' || v === 'datahubnet') return v;
  return null;
}

function getForcedProvider() {
  if (runtimeForcedProvider === 'grandapi' || runtimeForcedProvider === 'datahubnet') {
    return runtimeForcedProvider;
  }

  return normalizeForcedProviderValue(process.env.FULFILLMENT_FORCE_PROVIDER);
}

function setForcedProvider(provider) {
  const normalized = normalizeForcedProviderValue(provider);
  runtimeForcedProvider = normalized;
  return normalized;
}

function normalizeProviderName(provider) {
  return provider === 'encart' ? 'grandapi' : provider;
}

function getProviderAliasList(provider) {
  const resolved = normalizeProviderName(provider);
  if (resolved === 'grandapi') return ['grandapi', 'encart'];
  return [resolved];
}

function getActiveProviderByTime(now = new Date()) {
  const forced = getForcedProvider();
  if (forced === 'grandapi' || forced === 'datahubnet') {
    debugLog('Force override active →', forced);
    return forced;
  }

  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minutes >= DAY_START_MINUTES && minutes < DAY_END_MINUTES) {
    debugLog('Time window selects provider', 'grandapi');
    return 'grandapi';
  }
  debugLog('Time window selects provider', 'datahubnet');
  return 'datahubnet';
}

function parseJsonEnv(raw, label) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const err = new Error(`Invalid ${label} JSON`);
    err.statusCode = 500;
    throw err;
  }
}

function getDatahubnetNetworkMap() {
  const telecel = getDatahubnetTelecelNetwork();
  const defaults = {
    mtn: 'mtn',
    telecel,
    airteltigo: 'airteltigo',
    'at-bigtime': 'at-bigtime',
  };
  const raw = process.env.DATAHUBNET_NETWORK_MAP;
  const custom = parseJsonEnv(raw, 'DATAHUBNET_NETWORK_MAP');
  return { ...defaults, ...custom };
}

function getGrandapiNetworkMap() {
  const defaults = {
    mtn: 'MTN',
    telecel: 'TELECEL',
    airteltigo: 'AIRTELTIGO',
    'at-bigtime': 'AIRTELTIGO',
  };
  const raw = process.env.GRANDAPI_NETWORK_MAP;
  const custom = parseJsonEnv(raw, 'GRANDAPI_NETWORK_MAP');
  return { ...defaults, ...custom };
}

function getDatahubnetCapacityMap() {
  return parseJsonEnv(process.env.DATAHUBNET_CAPACITY_MAP, 'DATAHUBNET_CAPACITY_MAP');
}

function getGrandapiCapacityMap() {
  return parseJsonEnv(process.env.GRANDAPI_CAPACITY_MAP, 'GRANDAPI_CAPACITY_MAP');
}

function getGrandapiPackageMap() {
  return parseJsonEnv(process.env.GRANDAPI_PACKAGE_MAP, 'GRANDAPI_PACKAGE_MAP');
}

function getGrandapiBundleType() {
  const raw = process.env.GRANDAPI_BUNDLE_TYPE;
  const v = raw ? String(raw).trim().toUpperCase() : '';
  return v || 'EXPIRING';
}

function normalizeGrandapiNetwork(value) {
  const v = String(value || '').trim();
  return v ? v.toUpperCase() : v;
}

const GRANDAPI_PACKAGE_CACHE_TTL_MS = Math.max(
  60000,
  Number(process.env.GRANDAPI_PACKAGE_CACHE_TTL_MS || 300000) || 300000
);
const grandapiPackageCache = new Map();

function resolveGrandapiPackageFromMap(network, size, map) {
  if (!map || typeof map !== 'object') return null;
  const sizeKey = String(size);
  const networkKey = String(network || '').toLowerCase();
  const byNetwork = map[network] || map[networkKey] || map[String(network || '').toUpperCase()];
  if (byNetwork && typeof byNetwork === 'object' && byNetwork[sizeKey]) {
    return String(byNetwork[sizeKey]);
  }
  if (map[sizeKey]) return String(map[sizeKey]);
  return null;
}

async function resolveGrandapiPackageId(network, size, type) {
  const normalizedNetwork = normalizeGrandapiNetwork(network);
  const normalizedType = String(type || '').toUpperCase();
  const sizeValue = Number(size);
  if (!normalizedNetwork || !Number.isFinite(sizeValue) || sizeValue <= 0) return null;

  const packageMap = getGrandapiPackageMap();
  const mapped = resolveGrandapiPackageFromMap(normalizedNetwork, sizeValue, packageMap);
  if (mapped) return mapped;

  const cacheKey = `${normalizedNetwork}|${normalizedType}`;
  const now = Date.now();
  const cached = grandapiPackageCache.get(cacheKey);
  if (!cached || now - cached.fetchedAt > GRANDAPI_PACKAGE_CACHE_TTL_MS) {
    const res = await grandapiGetPackages({ network: normalizedNetwork, type: normalizedType });
    const payload = res?.payload || res?.data || res?.packages || [];
    const packages = Array.isArray(payload) ? payload : [];
    grandapiPackageCache.set(cacheKey, { fetchedAt: now, packages });
  }

  const packages = grandapiPackageCache.get(cacheKey)?.packages || [];
  const match = packages.find((pkg) => Number(pkg?.size) === sizeValue);
  return match?.id ? String(match.id) : match?.packageId ? String(match.packageId) : null;
}

function getDatahubnetTelecelNetwork() {
  const raw = process.env.DATAHUBNET_TELECEL_NETWORK;
  const v = raw == null ? 'telecel' : String(raw).trim();
  return v || 'telecel';
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('233')) return `0${digits.slice(3)}`;
  const err = new Error('Invalid phone number');
  err.statusCode = 400;
  throw err;
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

function resolveCapacityForProduct(product, volumeMb, capacityMap) {
  const slug = product?.slug ? String(product.slug) : '';
  if (slug && capacityMap && capacityMap[slug] != null) {
    const n = Number(capacityMap[slug]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  if (volumeMb != null && capacityMap && capacityMap[String(volumeMb)] != null) {
    const n = Number(capacityMap[String(volumeMb)]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  if (volumeMb != null && volumeMb % 1000 === 0) {
    return volumeMb / 1000;
  }

  return parseCapacityFromProduct(product);
}

function getNetworkForProvider(provider, categorySlug) {
  const slug = String(categorySlug || '').toLowerCase();
  if (!slug) return null;

  const resolved = normalizeProviderName(provider);
  if (resolved === 'grandapi') {
    const map = getGrandapiNetworkMap();
    return map[slug] ? String(map[slug]) : null;
  }

  const map = getDatahubnetNetworkMap();
  return map[slug] ? String(map[slug]) : null;
}

function buildProviderReference(provider, orderId, itemId) {
  const resolved = normalizeProviderName(provider);
  const prefix = resolved === 'grandapi' ? 'GA' : 'DH';
  const o = String(orderId || '').replace(/\W+/g, '');
  const i = String(itemId || '').replace(/\W+/g, '');
  const ref = `${prefix}-${o.slice(-8)}-${i.slice(-6)}`.toUpperCase();
  return ref.length > 25 ? ref.slice(0, 25) : ref;
}

function isDeliveredStatus(text) {
  return /deliver|success|completed|fulfilled/i.test(text);
}

function isFailedStatus(text) {
  return /fail|error|cancel|rejected/i.test(text);
}

async function updateOrderCompletion(orderId) {
  const remaining = await prisma.orderItem.count({
    where: {
      orderId,
      hubnetSkip: false,
      NOT: { hubnetStatus: 'DELIVERED' },
    },
  });

  if (remaining === 0) {
    const deliverableCount = await prisma.orderItem.count({
      where: { orderId, hubnetSkip: false },
    });

    if (deliverableCount > 0) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
    }
  }
}

async function queueFulfillmentForOrder(orderId) {
  const datahubnetConfigured = Boolean(process.env.DATAHUBNET_API_KEY);
  const grandapiConfigured = Boolean(process.env.GRANDAPI_API_KEY);
  if (!datahubnetConfigured && !grandapiConfigured) return { queued: false };

  const grandapiNetworkMap = getGrandapiNetworkMap();
  const datahubnetNetworkMap = getDatahubnetNetworkMap();
  const grandapiCapacityMap = getGrandapiCapacityMap();
  const datahubnetCapacityMap = getDatahubnetCapacityMap();

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
    debugLog('Order not queued because paymentStatus != PAID', order.id, order.paymentStatus);
    return { queued: false };
  }

  const deliverable = [];

  await prisma.$transaction(async (tx) => {
    debugLog('Queueing order items for fulfillment', order.id, order.items.length);
    for (const item of order.items) {
      const already = item.hubnetStatus;
      if (already && String(already) !== 'FAILED') continue;

      const categorySlug = item.product?.category?.slug ? String(item.product.category.slug).toLowerCase() : '';
      const grandapiNetwork = categorySlug ? grandapiNetworkMap[categorySlug] : null;
      const datahubnetNetwork = categorySlug ? datahubnetNetworkMap[categorySlug] : null;

      if (!grandapiNetwork && !datahubnetNetwork) {
        debugLog('Skipping item, no network mapping', item.id, categorySlug);
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: true,
            hubnetStatus: null,
            hubnetNetwork: null,
            hubnetVolumeMb: null,
            hubnetReference: null,
            hubnetAttempts: 0,
            hubnetLastAttemptAt: null,
            hubnetLastError: null,
            hubnetTransactionId: null,
            hubnetPaymentId: null,
            hubnetDeliveredAt: null,
            fulfillmentProvider: null,
          },
        });
        continue;
      }

      const volumeMb = parseVolumeMbFromProduct(item.product);
      const grandapiCapacity = resolveCapacityForProduct(item.product, volumeMb, grandapiCapacityMap);
      const datahubnetCapacity = resolveCapacityForProduct(item.product, volumeMb, datahubnetCapacityMap);
      if (!grandapiCapacity && !datahubnetCapacity) {
        debugLog('Marking failed, unable to determine capacity', item.id);
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetSkip: false,
            hubnetStatus: 'FAILED',
            hubnetNetwork: null,
            hubnetVolumeMb: volumeMb,
            hubnetReference: null,
            hubnetAttempts: 1,
            hubnetLastAttemptAt: new Date(),
            hubnetLastError: 'Unable to determine bundle size (capacity)',
            hubnetTransactionId: null,
            hubnetPaymentId: null,
            hubnetDeliveredAt: null,
            fulfillmentProvider: null,
          },
        });
        continue;
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetSkip: false,
          hubnetStatus: 'PENDING',
          hubnetNetwork: null,
          hubnetVolumeMb: volumeMb,
          hubnetReference: null,
          hubnetAttempts: 0,
          hubnetLastAttemptAt: null,
          hubnetLastError: null,
          hubnetTransactionId: null,
          hubnetPaymentId: null,
          hubnetDeliveredAt: null,
          fulfillmentProvider: null,
        },
      });

      deliverable.push(item.id);
    }

    if (deliverable.length > 0) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
      debugLog('Order queued for fulfillment', order.id, deliverable);
    }
  });

  if (deliverable.length === 0) {
    debugLog('No deliverable items found for order', order.id);
  }
  return { queued: true };
}

async function dispatchOneProviderItem(provider, intervalMs) {
  const cutoff = new Date(Date.now() - intervalMs);
  const providerAliases = getProviderAliasList(provider);

  const candidate = await prisma.orderItem.findFirst({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
        { OR: [{ fulfillmentProvider: null }, { fulfillmentProvider: { in: providerAliases } }] },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
  });

  if (!candidate) return false;
  debugLog('Dispatch candidate found', provider, candidate.id);

  const claimed = await prisma.orderItem.updateMany({
    where: {
      id: candidate.id,
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetAttempts: { lt: 6 },
      AND: [
        { OR: [{ hubnetStatus: null }, { hubnetStatus: 'PENDING' }, { hubnetStatus: 'FAILED' }] },
        { OR: [{ hubnetLastAttemptAt: null }, { hubnetLastAttemptAt: { lte: cutoff } }] },
        { OR: [{ fulfillmentProvider: null }, { fulfillmentProvider: { in: providerAliases } }] },
      ],
    },
    data: {
      hubnetStatus: 'SENDING',
      hubnetAttempts: { increment: 1 },
      hubnetLastAttemptAt: new Date(),
      hubnetLastError: null,
      fulfillmentProvider: provider,
    },
  });

  if (!claimed || claimed.count !== 1) return true;

  const item = await prisma.orderItem.findUnique({
    where: { id: candidate.id },
    include: { order: true, product: { include: { category: true } } },
  });

  if (!item) return true;
  debugLog('Dispatching item', item.id, provider);

  const phoneRaw = item.recipientPhone || item.order?.customerPhone;
  let phone;
  try {
    phone = normalizePhone(phoneRaw);
  } catch (err) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: err?.message ? String(err.message) : 'Invalid phone number',
      },
    });
    debugLog('Dispatch failed - invalid phone', item.id, err?.message);
    return true;
  }

  const categorySlug = item.product?.category?.slug;
  const network = getNetworkForProvider(provider, categorySlug);
  if (!network) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: `No network mapping for category: ${String(categorySlug || 'unknown')}`,
      },
    });
    debugLog('Dispatch failed - no network mapping', item.id, categorySlug);
    return true;
  }

  const volumeMb = item.hubnetVolumeMb || parseVolumeMbFromProduct(item.product);
  const capacityMap = provider === 'grandapi' ? getGrandapiCapacityMap() : getDatahubnetCapacityMap();
  const capacity = resolveCapacityForProduct(item.product, volumeMb, capacityMap);
  if (!capacity) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: 'Unable to determine bundle size (capacity)',
      },
    });
    debugLog('Dispatch failed - capacity lookup', item.id, provider);
    return true;
  }

  const reference = item.hubnetReference || buildProviderReference(provider, item.orderId, item.id);

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      hubnetNetwork: network,
      hubnetVolumeMb: volumeMb,
      hubnetReference: reference,
      fulfillmentProvider: provider,
    },
  });

  try {
    if (provider === 'grandapi') {
      const bundleType = getGrandapiBundleType();
      const networkKey = normalizeGrandapiNetwork(network);
      const sizeGb = Number(capacity);
      const packageId = await resolveGrandapiPackageId(networkKey, sizeGb, bundleType);
      if (!packageId) {
        const err = new Error('Unable to resolve GrandAPI package for bundle size');
        err.statusCode = 502;
        throw err;
      }

      const res = await grandapiPlaceOrder({
        phone,
        network: networkKey,
        size: sizeGb,
        type: bundleType,
        packageId,
      });

      const payload = res?.payload || res?.data || res;
      const remoteId = payload?.orderId || payload?.id || payload?.orders?.[0]?.id;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'SUBMITTED',
          hubnetTransactionId: remoteId ? String(remoteId) : item.hubnetTransactionId,
        },
      });

      debugLog('GrandAPI order submitted', item.id, packageId, remoteId);
      return true;
    }

    const res = await datahubnetPlaceOrder({
      phone,
      network,
      capacity,
      reference,
      express: SHOULD_USE_DATAHUBNET_EXPRESS,
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
    debugLog('Datahubnet order submitted', item.id, reference, remoteId);
  } catch (e) {
    const message = e?.message ? String(e.message) : `${provider} request failed`;
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        hubnetStatus: 'FAILED',
        hubnetLastError: message,
      },
    });
    debugLog('Dispatch error', provider, item.id, message);
  }

  return true;
}

async function pollOneProviderItem(provider, intervalMs) {
  const cutoff = new Date(Date.now() - intervalMs);
  const providerAliases = getProviderAliasList(provider);

  const item = await prisma.orderItem.findFirst({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      fulfillmentProvider: { in: providerAliases },
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
    const resolvedProvider = normalizeProviderName(provider);
    const checkId = resolvedProvider === 'grandapi'
      ? item.hubnetTransactionId || item.hubnetReference
      : item.hubnetTransactionId || item.hubnetReference;
    debugLog('Polling status', provider, item.id, checkId);
    if (!checkId) return true;

    if (resolvedProvider === 'grandapi') {
      const res = await grandapiCheckStatus(checkId);
      const statusText = res?.data?.status || res?.status || res?.payload?.status || '';
      const text = String(statusText || '').toLowerCase();

      if (isDeliveredStatus(text)) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetStatus: 'DELIVERED',
            hubnetDeliveredAt: new Date(),
            hubnetLastError: null,
          },
        });
        await updateOrderCompletion(item.orderId);
        debugLog('GrandAPI delivered', item.id, checkId);
        return true;
      }

      if (isFailedStatus(text)) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetStatus: 'FAILED',
            hubnetLastError: String(statusText || 'GrandAPI failed'),
          },
        });
        debugLog('GrandAPI failed status', item.id, statusText);
        return true;
      }

      return true;
    }

    const res = await datahubnetCheckStatus(checkId);
    const statusText = res?.data?.order?.status || res?.data?.status || res?.status || '';
    const s = String(statusText).toLowerCase();

    if (isDeliveredStatus(s)) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'DELIVERED',
          hubnetDeliveredAt: new Date(),
          hubnetLastError: null,
        },
      });
      await updateOrderCompletion(item.orderId);
      debugLog('Datahubnet delivered', item.id, checkId);
      return true;
    }

    if (isFailedStatus(s)) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'FAILED',
          hubnetLastError: String(statusText || 'DataHubnet failed'),
        },
      });
      debugLog('Datahubnet failed status', item.id, statusText);
      return true;
    }
  } catch (e) {
    const message = e?.message ? String(e.message) : `${provider} status check failed`;
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { hubnetLastError: message },
    });
    debugLog('Polling error', provider, item.id, message);
  }

  return true;
}

let dispatcherTimer = null;
let dispatcherInFlight = false;

function startFulfillmentDispatcher() {
  const intervalMs = getDispatchIntervalMs();
  const datahubnetConfigured = Boolean(process.env.DATAHUBNET_API_KEY);
  const grandapiConfigured = Boolean(process.env.GRANDAPI_API_KEY);
  if (!datahubnetConfigured && !grandapiConfigured) return;
  if (dispatcherTimer) return;

  debugLog('Dispatcher initializing', { intervalMs, datahubnetConfigured, grandapiConfigured });

  dispatcherTimer = setInterval(() => {
    if (dispatcherInFlight) return;
    dispatcherInFlight = true;

    Promise.resolve()
      .then(async () => {
        const activeProvider = getActiveProviderByTime();
        debugLog('Tick active provider', activeProvider);
        if (activeProvider === 'grandapi' && grandapiConfigured) {
          const dispatched = await dispatchOneProviderItem('grandapi', intervalMs);
          debugLog('GrandAPI dispatch tick result', dispatched);
          if (dispatched) return;
        }

        if (activeProvider === 'datahubnet' && datahubnetConfigured) {
          const dispatched = await dispatchOneProviderItem('datahubnet', intervalMs);
          debugLog('Datahubnet dispatch tick result', dispatched);
          if (dispatched) return;
        }

        const polledDatahubnet = datahubnetConfigured ? await pollOneProviderItem('datahubnet', intervalMs) : false;
        debugLog('Datahubnet poll tick result', polledDatahubnet);
        if (polledDatahubnet) return;
        const polledGrandapi = grandapiConfigured ? await pollOneProviderItem('grandapi', intervalMs) : false;
        debugLog('GrandAPI poll tick result', polledGrandapi);
        if (polledGrandapi) return;
      })
      .catch((e) => console.error(e))
      .finally(() => {
        dispatcherInFlight = false;
      });
  }, intervalMs);
}

function getFulfillmentControlState(now = new Date()) {
  const forcedProvider = getForcedProvider();
  const activeProvider = getActiveProviderByTime(now);
  return {
    forcedProvider,
    activeProvider,
    nowUtc: now.toISOString(),
    dayWindowUtc: {
      start: '08:30',
      end: '18:00',
    },
  };
}

module.exports = {
  getFulfillmentControlState,
  queueFulfillmentForOrder,
  setForcedProvider,
  startFulfillmentDispatcher,
  updateOrderCompletion,
};
