const jwt = require('jsonwebtoken');

function normalizeRole(role) {
  if (!role) return null;
  return role === 'kcca' ? 'kcca_officer' : role;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...payload,
      role: normalizeRole(payload.role)
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  const normalizedRoles = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, normalizeRole };
