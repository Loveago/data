const { prisma } = require('./prisma');
const { datahubnetCheckStatus, datahubnetPlaceOrder } = require('./datahubnet');
const { grandapiCheckStatus, grandapiGetPackages, grandapiPlaceOrder } = require('./grandapi');
const { encartCheckStatus, encartPurchase } = require('./encart');
const { elitnutGetTransactionHistory, elitnutInitiateTransaction } = require('./elitnut');
const { skanka5CheckStatus, skanka5PlaceOrder } = require('./skanka5');

const DAY_START_MINUTES = 8 * 60 + 30;
const DAY_END_MINUTES = 18 * 60;
const ENABLE_FULFILLMENT_DEBUG = String(process.env.FULFILLMENT_DEBUG || '').trim().toLowerCase() === 'true';
let runtimeForcedProvider = null;
let runtimeAutoDeliverEnabled = null;
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
  if (v === 'encart') return 'encart';
  if (v === 'grandapi' || v === 'datahubnet' || v === 'elitnut' || v === 'skanka5') return v;
  return null;
}

function getForcedProvider() {
  if (runtimeForcedProvider === 'encart' || runtimeForcedProvider === 'grandapi' || runtimeForcedProvider === 'datahubnet' || runtimeForcedProvider === 'elitnut' || runtimeForcedProvider === 'skanka5') {
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
  return String(provider || '').trim().toLowerCase();
}

function getProviderAliasList(provider) {
  const resolved = normalizeProviderName(provider);
  return [resolved];
}

function getActiveProviderByTime(now = new Date()) {
  const forced = getForcedProvider();
  if (forced === 'encart' || forced === 'grandapi' || forced === 'datahubnet' || forced === 'elitnut' || forced === 'skanka5') {
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

function getEncartNetworkMap() {
  const defaults = {
    mtn: 'YELLO',
    telecel: 'TELECEL',
    airteltigo: 'AT_PREMIUM',
    'at-bigtime': 'AT_BIGTIME',
  };
  const raw = process.env.ENCART_NETWORK_MAP;
  const custom = parseJsonEnv(raw, 'ENCART_NETWORK_MAP');
  return { ...defaults, ...custom };
}

function getElitnutNetworkMap() {
  const defaults = {
    mtn: 'MTN',
    telecel: 'TELECEL',
    airteltigo: 'AT',
    'at-bigtime': 'AT',
  };
  const raw = process.env.ELITNUT_NETWORK_MAP;
  const custom = parseJsonEnv(raw, 'ELITNUT_NETWORK_MAP');
  return { ...defaults, ...custom };
}

function getSkanka5NetworkMap() {
  const defaults = {
    mtn: 3,
    telecel: 2,
    airteltigo: 1,
    'at-bigtime': 4,
  };
  const raw = process.env.SKANKA5_NETWORK_MAP;
  const custom = parseJsonEnv(raw, 'SKANKA5_NETWORK_MAP');
  return { ...defaults, ...custom };
}

function getDatahubnetCapacityMap() {
  return parseJsonEnv(process.env.DATAHUBNET_CAPACITY_MAP, 'DATAHUBNET_CAPACITY_MAP');
}

function getGrandapiCapacityMap() {
  return parseJsonEnv(process.env.GRANDAPI_CAPACITY_MAP, 'GRANDAPI_CAPACITY_MAP');
}

function getEncartCapacityMap() {
  return parseJsonEnv(process.env.ENCART_CAPACITY_MAP, 'ENCART_CAPACITY_MAP');
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
  if (resolved === 'elitnut') {
    const map = getElitnutNetworkMap();
    return map[slug] ? String(map[slug]) : null;
  }
  if (resolved === 'encart') {
    const map = getEncartNetworkMap();
    return map[slug] ? String(map[slug]) : null;
  }
  if (resolved === 'grandapi') {
    const map = getGrandapiNetworkMap();
    return map[slug] ? String(map[slug]) : null;
  }
  if (resolved === 'skanka5') {
    const map = getSkanka5NetworkMap();
    return map[slug] != null ? String(map[slug]) : null;
  }

  const map = getDatahubnetNetworkMap();
  return map[slug] ? String(map[slug]) : null;
}

function buildProviderReference(provider, orderId, itemId) {
  const resolved = normalizeProviderName(provider);
  const prefix = resolved === 'grandapi' ? 'GA' : resolved === 'encart' ? 'EC' : resolved === 'skanka5' ? 'SK5' : 'DH';
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

function getAutoDeliverAfterMs() {
  const raw = process.env.HUBNET_AUTO_DELIVER_AFTER_MS;
  const ms = Math.max(0, Number(raw || 2 * 60 * 60 * 1000) || 2 * 60 * 60 * 1000);
  return ms;
}

function getAutoDeliverEnabled() {
  if (typeof runtimeAutoDeliverEnabled === 'boolean') return runtimeAutoDeliverEnabled;
  const raw = process.env.HUBNET_AUTO_DELIVER_AFTER_MS;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

function setAutoDeliverEnabled(value) {
  if (value === null || value === undefined) {
    runtimeAutoDeliverEnabled = null;
    return null;
  }
  const bool = String(value).trim().toLowerCase() === 'true' || value === true || Number(value) === 1;
  runtimeAutoDeliverEnabled = bool;
  return bool;
}

async function finalizeStaleSubmittedItems() {
  if (!getAutoDeliverEnabled()) return;
  const autoDeliverAfterMs = getAutoDeliverAfterMs();
  if (!autoDeliverAfterMs) return;

  const cutoff = new Date(Date.now() - autoDeliverAfterMs);

  const stale = await prisma.orderItem.findMany({
    where: {
      order: { paymentStatus: 'PAID' },
      hubnetSkip: false,
      hubnetStatus: 'SUBMITTED',
      hubnetDeliveredAt: null,
      OR: [{ hubnetSubmittedAt: { lte: cutoff } }, { AND: [{ hubnetSubmittedAt: null }, { updatedAt: { lte: cutoff } }] }],
    },
    select: { id: true, orderId: true },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  });

  if (!stale.length) return;

  const ids = stale.map((x) => x.id);
  const orderIds = Array.from(new Set(stale.map((x) => x.orderId)));

  const now = new Date();
  await prisma.orderItem.updateMany({
    where: { id: { in: ids }, hubnetStatus: 'SUBMITTED', hubnetDeliveredAt: null },
    data: {
      hubnetStatus: 'DELIVERED',
      hubnetDeliveredAt: now,
      hubnetLastError: null,
    },
  });

  debugLog('Auto-finalized stale submitted items → DELIVERED', { count: ids.length, orderIds: orderIds.length });
  for (const orderId of orderIds) {
    await updateOrderCompletion(orderId);
  }
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
  const encartConfigured = Boolean(process.env.ENCART_API_KEY);
  const elitnutConfigured = Boolean(process.env.ELITNUT_API_KEY);
  const skanka5Configured = Boolean(process.env.SKANKA5_API_KEY);
  if (!datahubnetConfigured && !grandapiConfigured && !encartConfigured && !elitnutConfigured && !skanka5Configured) return { queued: false };

  const grandapiNetworkMap = getGrandapiNetworkMap();
  const encartNetworkMap = getEncartNetworkMap();
  const datahubnetNetworkMap = getDatahubnetNetworkMap();
  const elitnutNetworkMap = getElitnutNetworkMap();
  const skanka5NetworkMap = getSkanka5NetworkMap();
  const grandapiCapacityMap = getGrandapiCapacityMap();
  const encartCapacityMap = getEncartCapacityMap();
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
      const encartNetwork = categorySlug ? encartNetworkMap[categorySlug] : null;
      const datahubnetNetwork = categorySlug ? datahubnetNetworkMap[categorySlug] : null;
      const elitnutNetwork = categorySlug ? elitnutNetworkMap[categorySlug] : null;
      const skanka5Network = categorySlug ? skanka5NetworkMap[categorySlug] : null;

      if (!grandapiNetwork && !encartNetwork && !datahubnetNetwork && !elitnutNetwork && !skanka5Network) {
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
            hubnetSubmittedAt: null,
            hubnetDeliveredAt: null,
            fulfillmentProvider: null,
          },
        });
        continue;
      }

      const volumeMb = parseVolumeMbFromProduct(item.product);
      const grandapiCapacity = resolveCapacityForProduct(item.product, volumeMb, grandapiCapacityMap);
      const encartCapacity = resolveCapacityForProduct(item.product, volumeMb, encartCapacityMap);
      const datahubnetCapacity = resolveCapacityForProduct(item.product, volumeMb, datahubnetCapacityMap);
      const skanka5Capacity = volumeMb != null && Number.isFinite(volumeMb) && volumeMb > 0 ? volumeMb : null;
      if (!grandapiCapacity && !encartCapacity && !datahubnetCapacity && !skanka5Capacity) {
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
            hubnetSubmittedAt: null,
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
          hubnetSubmittedAt: null,
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
  const resolvedProvider = normalizeProviderName(provider);
  const capacityMap = resolvedProvider === 'grandapi'
    ? getGrandapiCapacityMap()
    : resolvedProvider === 'encart'
      ? getEncartCapacityMap()
      : resolvedProvider === 'skanka5'
        ? null
        : getDatahubnetCapacityMap();
  const capacity = resolvedProvider === 'skanka5' ? volumeMb : resolveCapacityForProduct(item.product, volumeMb, capacityMap);
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
    if (provider === 'elitnut') {
      const packageMb = Math.round(Number(capacity) * 1000);
      const res = await elitnutInitiateTransaction({
        network: String(network).toUpperCase(),
        number: phone,
        reference,
        packageMb,
      });

      const payload = res?.payload || res?.data || res;
      const remoteId = payload?.id || payload?.transactionId || payload?.transaction_id;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'SUBMITTED',
          hubnetTransactionId: remoteId ? String(remoteId) : item.hubnetTransactionId,
          hubnetSubmittedAt: new Date(),
        },
      });

      debugLog('ElitNut transaction submitted', item.id, reference, remoteId);
      return true;
    }

    if (provider === 'encart') {
      const networkKey = String(network);
      const res = await encartPurchase({
        networkKey,
        recipient: phone,
        capacity: Number(capacity),
        reference,
      });

      const payload = res?.payload || res?.data || res;
      const remoteRef = payload?.reference || payload?.order?.reference || payload?.id || reference;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'SUBMITTED',
          hubnetTransactionId: remoteRef ? String(remoteRef) : item.hubnetTransactionId,
          hubnetSubmittedAt: new Date(),
        },
      });

      debugLog('Encart order submitted', item.id, reference, remoteRef);
      return true;
    }

    if (provider === 'skanka5') {
      const networkId = Number(network);
      const res = await skanka5PlaceOrder({
        networkId,
        msisdn: phone,
        volumeMb: Number(volumeMb),
        reference,
      });

      const payload = res?.payload || res?.data || res;
      const topRef = payload?.reference || payload?.order?.reference || payload?.id || reference;
      const itemCode = payload?.items?.[0]?.order_code || null;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          hubnetStatus: 'SUBMITTED',
          hubnetTransactionId: topRef ? String(topRef) : item.hubnetTransactionId,
          hubnetPaymentId: itemCode ? String(itemCode) : item.hubnetPaymentId,
          hubnetSubmittedAt: new Date(),
        },
      });

      debugLog('Skanka5 order submitted', item.id, reference, topRef, itemCode);
      return true;
    }

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
          hubnetSubmittedAt: new Date(),
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
        hubnetSubmittedAt: new Date(),
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
        hubnetSubmittedAt: null,
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
    const checkId = item.hubnetTransactionId || item.hubnetReference;
    debugLog('Polling status', provider, item.id, checkId);
    if (!checkId) return true;

    if (resolvedProvider === 'elitnut') {
      const network = item.hubnetNetwork;
      if (!network) return true;

      const res = await elitnutGetTransactionHistory({
        network: String(network).toUpperCase(),
        reference: checkId,
      });

      const payload = res?.data || res?.payload || res;
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.transactions) ? payload.transactions : [];
      const entry = list && list.length ? list[0] : payload;
      const statusText = entry?.status || entry?.state || payload?.status || '';
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
        debugLog('ElitNut delivered', item.id, checkId);
        return true;
      }

      if (isFailedStatus(text)) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetStatus: 'FAILED',
            hubnetLastError: String(statusText || 'ElitNut failed'),
          },
        });
        debugLog('ElitNut failed status', item.id, statusText);
        return true;
      }

      return true;
    }

    if (resolvedProvider === 'encart') {
      const res = await encartCheckStatus(checkId);
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
        debugLog('Encart delivered', item.id, checkId);
        return true;
      }

      if (isFailedStatus(text)) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetStatus: 'FAILED',
            hubnetLastError: String(statusText || 'Encart failed'),
          },
        });
        debugLog('Encart failed status', item.id, statusText);
        return true;
      }

      return true;
    }

    if (resolvedProvider === 'skanka5') {
      const res = await skanka5CheckStatus(checkId);
      const line = res?.items?.[0];
      const statusText = line?.api_status || line?.status || res?.api_status || res?.status || '';
      const text = String(statusText || '').toLowerCase();

      if (!line) {
        debugLog('Skanka5 poll: no items in status response', item.id, checkId);
      }

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
        debugLog('Skanka5 delivered', item.id, checkId);
        return true;
      }

      if (isFailedStatus(text)) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            hubnetStatus: 'FAILED',
            hubnetLastError: String(statusText || 'Skanka5 failed'),
          },
        });
        debugLog('Skanka5 failed status', item.id, statusText);
        return true;
      }

      return true;
    }

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
  const encartConfigured = Boolean(process.env.ENCART_API_KEY);
  const elitnutConfigured = Boolean(process.env.ELITNUT_API_KEY);
  const skanka5Configured = Boolean(process.env.SKANKA5_API_KEY);
  if (!datahubnetConfigured && !grandapiConfigured && !encartConfigured && !elitnutConfigured && !skanka5Configured) return;
  if (dispatcherTimer) return;

  debugLog('Dispatcher initializing', { intervalMs, datahubnetConfigured, grandapiConfigured, encartConfigured, elitnutConfigured, skanka5Configured });

  dispatcherTimer = setInterval(() => {
    if (dispatcherInFlight) return;
    dispatcherInFlight = true;

    Promise.resolve()
      .then(async () => {
        await finalizeStaleSubmittedItems();
        const activeProvider = getActiveProviderByTime();
        debugLog('Tick active provider', activeProvider);
        if (activeProvider === 'elitnut' && elitnutConfigured) {
          const dispatched = await dispatchOneProviderItem('elitnut', intervalMs);
          debugLog('ElitNut dispatch tick result', dispatched);
          if (dispatched) return;
        }
        if (activeProvider === 'encart' && encartConfigured) {
          const dispatched = await dispatchOneProviderItem('encart', intervalMs);
          debugLog('Encart dispatch tick result', dispatched);
          if (dispatched) return;
        }
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

        if (activeProvider === 'skanka5' && skanka5Configured) {
          const dispatched = await dispatchOneProviderItem('skanka5', intervalMs);
          debugLog('Skanka5 dispatch tick result', dispatched);
          if (dispatched) return;
        }

        const polledElitnut = elitnutConfigured ? await pollOneProviderItem('elitnut', intervalMs) : false;
        debugLog('ElitNut poll tick result', polledElitnut);
        if (polledElitnut) return;

        const polledDatahubnet = datahubnetConfigured ? await pollOneProviderItem('datahubnet', intervalMs) : false;
        debugLog('Datahubnet poll tick result', polledDatahubnet);
        if (polledDatahubnet) return;

        const polledEncart = encartConfigured ? await pollOneProviderItem('encart', intervalMs) : false;
        debugLog('Encart poll tick result', polledEncart);
        if (polledEncart) return;

        const polledGrandapi = grandapiConfigured ? await pollOneProviderItem('grandapi', intervalMs) : false;
        debugLog('GrandAPI poll tick result', polledGrandapi);
        if (polledGrandapi) return;

        const polledSkanka5 = skanka5Configured ? await pollOneProviderItem('skanka5', intervalMs) : false;
        debugLog('Skanka5 poll tick result', polledSkanka5);
        if (polledSkanka5) return;
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
    autoDeliver: {
      enabled: getAutoDeliverEnabled(),
      timeoutMs: getAutoDeliverAfterMs(),
    },
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
  setAutoDeliverEnabled,
  startFulfillmentDispatcher,
  updateOrderCompletion,
};
