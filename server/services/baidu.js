const axios = require('axios');
const { getConfigMap, setConfigMany, logEvent } = require('../db/database');

const OAUTH_BASE = process.env.BAIDU_OAUTH_BASE || 'https://openapi.baidu.com/oauth/2.0';
const PAN_BASE = process.env.BAIDU_PAN_BASE || 'https://pan.baidu.com/rest/2.0/xpan';
const BAIDU_SCOPE = process.env.BAIDU_SCOPE || 'basic,netdisk';

function getAuthUrl() {
  const clientId = process.env.BAIDU_CLIENT_ID;
  const redirectUri = process.env.BAIDU_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('Missing BAIDU_CLIENT_ID or BAIDU_REDIRECT_URI');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: BAIDU_SCOPE,
    display: 'popup'
  });
  return `${OAUTH_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const clientId = process.env.BAIDU_CLIENT_ID;
  const clientSecret = process.env.BAIDU_CLIENT_SECRET;
  const redirectUri = process.env.BAIDU_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing BAIDU OAuth env');
  }
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });
  const { data } = await axios.post(`${OAUTH_BASE}/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  storeTokens(data);
  logEvent('oauth', 'OAuth token updated');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const clientId = process.env.BAIDU_CLIENT_ID;
  const clientSecret = process.env.BAIDU_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing BAIDU OAuth env');
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  const { data } = await axios.post(`${OAUTH_BASE}/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  storeTokens(data, refreshToken);
  logEvent('oauth', 'OAuth token refreshed');
  return data;
}

function storeTokens(data, fallbackRefreshToken) {
  const expiresAt = new Date(Date.now() + (data.expires_in || 0) * 1000).toISOString();
  setConfigMany({
    baidu_access_token: data.access_token,
    baidu_refresh_token: data.refresh_token || fallbackRefreshToken || '',
    baidu_token_expires_at: expiresAt,
    baidu_scope: data.scope || BAIDU_SCOPE
  });
}

async function ensureAccessToken() {
  const { baidu_access_token, baidu_refresh_token, baidu_token_expires_at } = getConfigMap([
    'baidu_access_token',
    'baidu_refresh_token',
    'baidu_token_expires_at'
  ]);
  if (!baidu_access_token || !baidu_refresh_token) {
    throw new Error('Baidu token missing. Complete OAuth first.');
  }
  const expiresAt = baidu_token_expires_at ? new Date(baidu_token_expires_at).getTime() : 0;
  if (!expiresAt || Date.now() + 60000 >= expiresAt) {
    const refreshed = await refreshAccessToken(baidu_refresh_token);
    return refreshed.access_token;
  }
  return baidu_access_token;
}

async function listFolder(dirPath) {
  const accessToken = await ensureAccessToken();
  const items = [];
  const limit = 200;
  let start = 0;
  while (true) {
    const { data } = await axios.get(`${PAN_BASE}/file`, {
      params: {
        method: 'list',
        dir: dirPath,
        order: 'name',
        web: 1,
        start,
        limit,
        access_token: accessToken
      }
    });
    if (data.errno && data.errno !== 0) {
      throw new Error(`Baidu list error: ${data.errno}`);
    }
    const list = data.list || [];
    items.push(...list);
    if (list.length < limit) {
      break;
    }
    start += limit;
  }
  return items;
}

async function getDlink(fsId) {
  const accessToken = await ensureAccessToken();
  const { data } = await axios.get(`${PAN_BASE}/multimedia`, {
    params: {
      method: 'filemetas',
      access_token: accessToken,
      fsids: `[${fsId}]`,
      dlink: 1
    }
  });
  if (data.errno && data.errno !== 0) {
    throw new Error(`Baidu dlink error: ${data.errno}`);
  }
  const file = data.list && data.list[0];
  if (!file || !file.dlink) {
    throw new Error('Missing dlink');
  }
  if (file.dlink.includes('access_token=')) {
    return file.dlink;
  }
  const separator = file.dlink.includes('?') ? '&' : '?';
  return `${file.dlink}${separator}access_token=${accessToken}`;
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  ensureAccessToken,
  listFolder,
  getDlink
};
