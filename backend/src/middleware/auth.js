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

async function requireAgent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const role = req.user.role;
  if (role === 'AGENT' || role === 'ADMIN') {
    return next();
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    if (dbUser && (dbUser.role === 'AGENT' || dbUser.role === 'ADMIN')) {
      req.user.role = dbUser.role;
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth, requireAdmin, requireAgent };
