const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../lib/prisma');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice('bearer '.length);

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

const AGENT_ROLES = ['AGENT', 'SUPER_AGENT', 'ADMIN'];

async function requireAgent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const role = req.user.role;
  if (AGENT_ROLES.includes(role)) {
    return next();
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    if (dbUser && AGENT_ROLES.includes(dbUser.role)) {
      req.user.role = dbUser.role;
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    return next(error);
  }
}

async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'Missing x-api-key header', message: 'Include your API key in the x-api-key header' });
  }

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: String(key) },
      include: { user: { select: { id: true, email: true, name: true, role: true, walletBalance: true } } },
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive API key', message: 'The provided API key is invalid or has been deactivated' });
    }

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

    req.apiKey = apiKey;
    req.apiUser = apiKey.user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth, requireAdmin, requireAgent, requireApiKey };
