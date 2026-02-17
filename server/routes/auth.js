const express = require('express');
const crypto = require('crypto');
const { createAdminSession, logEvent } = require('../db/database');

const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

router.post('/api/admin/login', (req, res) => {
  const { username } = req.body || {};
  if (!username || username.trim() !== ADMIN_USERNAME) {
    return res.status(401).json({ ok: false, error: 'INVALID_USERNAME' });
  }
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  createAdminSession(sessionToken, expiresAt);
  const secure = (req.headers['x-forwarded-proto'] || req.protocol) === 'https';
  res.cookie('admin_session', sessionToken, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: 90 * 24 * 60 * 60 * 1000
  });
  logEvent('admin', 'Admin login via username');
  return res.json({ ok: true, expiresAt });
});

router.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

module.exports = router;
