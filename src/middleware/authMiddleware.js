// src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

const operatorAllowlist = [
  { path: '/clients/profile', type: 'exact' },
  { path: '/aggregator', type: 'prefix' },
  { path: '/amplify/rekap', type: 'exact' },
  { path: '/amplify/rekap-khusus', type: 'exact' },
  { path: '/amplify-khusus/rekap', type: 'exact' },
  { path: '/insta/rekap-likes', type: 'exact' },
  { path: '/insta/rapid-profile', type: 'exact' },
  { path: '/tiktok/rekap-komentar', type: 'exact' },
  { path: '/users', type: 'exact' },
  { path: '/users/create', type: 'exact' },
  { path: '/users/list', type: 'exact' },
  { path: '/dashboard/stats', type: 'exact' },
  { path: '/dashboard/login-web/recap', type: 'exact' },
];

const operatorMethodAllowlist = [
  { method: 'PUT', pattern: /^\/users\/[^/]+$/ },
  { method: 'POST', pattern: /^\/link-reports$/ },
  { method: 'POST', pattern: /^\/link-reports-khusus$/ },
  { method: 'PUT', pattern: /^\/link-reports\/[^/]+$/ },
  { method: 'PUT', pattern: /^\/link-reports-khusus\/[^/]+$/ },
  { method: 'POST', pattern: /^\/dashboard\/komplain\/(insta|tiktok)$/ },
];

const readOnlyRoles = new Set([
  'user',
  'client',
  'ditbinmas',
  'ditlantas',
  'bidhumas',
  'ditsamapta',
  'ditintelkam',
]);

const reportMutationPatterns = [
  { method: 'POST', pattern: /^\/link-reports(?:-khusus)?$/ },
  { method: 'PUT', pattern: /^\/link-reports(?:-khusus)?\/[^/]+$/ },
];

function isReadOnlyRoleAllowed(req, role) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

  if (
    role === 'user' &&
    req.method === 'PUT' &&
    /^\/users\/[^/]+\/wa-notification$/.test(req.path)
  ) {
    const requestedUserId = req.path.split('/')[2];
    return String(req.user?.user_id || '') === decodeURIComponent(requestedUserId);
  }

  return reportMutationPatterns.some(
    ({ method, pattern }) => method === req.method && pattern.test(req.path)
  );
}

function isOperatorAllowedPath(method, pathname) {
  const isPathAllowed = operatorAllowlist.some(({ path, type }) => {
    if (type === 'prefix') {
      return pathname === path || pathname.startsWith(`${path}/`);
    }
    return pathname === path;
  });
  if (isPathAllowed) {
    return true;
  }
  return operatorMethodAllowlist.some(({ method: allowedMethod, pattern }) => {
    if (allowedMethod !== method) {
      return false;
    }
    return pattern.test(pathname);
  });
}

export function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    const role = String(decoded.role || '').toLowerCase();
    const isScopedClientRole = Boolean(decoded.client_id) &&
      role === String(decoded.client_id).toLowerCase();
    if (role === 'operator' && !isOperatorAllowedPath(req.method, req.path)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if ((readOnlyRoles.has(role) || isScopedClientRole) && !isReadOnlyRoleAllowed(req, role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (role !== 'operator' && !readOnlyRoles.has(role) && !isScopedClientRole) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
