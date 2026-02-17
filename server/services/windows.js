const axios = require('axios');
const { getConfig } = require('../db/database');

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/\/+$/, '');
}

function normalizeRelPath(p) {
  if (!p || typeof p !== 'string' || p.trim() === '') return '/';
  let normalized = p.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  return normalized;
}

function getWindowsConfig() {
  const baseUrl = normalizeBaseUrl(getConfig('win_base_url') || '');
  const token = getConfig('win_token') || '';
  const rootPath = normalizeRelPath(getConfig('win_root_path') || '/');
  return { baseUrl, token, rootPath };
}

function buildHeaders(token, range) {
  const headers = {};
  if (token) headers['x-auth-token'] = token;
  if (range) headers.Range = range;
  return headers;
}

async function listFolder(relPath) {
  const { baseUrl, token } = getWindowsConfig();
  if (!baseUrl) {
    throw new Error('WINDOWS_BASE_URL_MISSING');
  }
  const pathParam = normalizeRelPath(relPath);
  const { data } = await axios.get(`${baseUrl}/api/list`, {
    params: { path: pathParam },
    headers: buildHeaders(token),
    timeout: 10000
  });
  if (!data || !Array.isArray(data.entries)) {
    throw new Error('WINDOWS_LIST_FAILED');
  }
  return data.entries;
}

async function getFileStream(relPath, range) {
  const { baseUrl, token } = getWindowsConfig();
  if (!baseUrl) {
    throw new Error('WINDOWS_BASE_URL_MISSING');
  }
  const pathParam = normalizeRelPath(relPath);
  return axios.get(`${baseUrl}/file`, {
    params: { path: pathParam },
    responseType: 'stream',
    headers: buildHeaders(token, range),
    timeout: 0,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });
}

module.exports = {
  getWindowsConfig,
  normalizeRelPath,
  listFolder,
  getFileStream
};
