const { getAdminSession } = require('../db/database');

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_session;
  const session = getAdminSession(token);
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  req.adminSession = session;
  return next();
}

module.exports = { requireAdmin };
