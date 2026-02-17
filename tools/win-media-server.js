const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.WIN_MEDIA_ROOT || 'D:\\\\KidsVideos';
const TOKEN = process.env.WIN_MEDIA_TOKEN || '';
const HOST = process.env.WIN_MEDIA_HOST || '127.0.0.1';
const PORT = Number(process.env.WIN_MEDIA_PORT || 18080);

function normalizeRelPath(p) {
  if (!p || typeof p !== 'string') return '/';
  let normalized = p.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  normalized = path.posix.normalize(normalized);
  return normalized;
}

function resolveSafe(relPath) {
  const root = path.resolve(ROOT_DIR);
  const safeRel = normalizeRelPath(relPath);
  const resolved = path.resolve(root, `.${safeRel}`);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return { root, resolved, rel: safeRel };
}

function isAuthorized(req) {
  if (!TOKEN) return true;
  const header = req.headers['x-auth-token'];
  return header === TOKEN;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  return 'application/octet-stream';
}

function handleList(req, res, url) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: 'UNAUTHORIZED' });
  }
  const relPath = normalizeRelPath(url.searchParams.get('path') || '/');
  const safe = resolveSafe(relPath);
  if (!safe) {
    return sendJson(res, 400, { error: 'INVALID_PATH' });
  }
  let entries;
  try {
    entries = fs.readdirSync(safe.resolved, { withFileTypes: true });
  } catch (err) {
    return sendJson(res, 404, { error: 'NOT_FOUND', message: err.message });
  }
  const list = entries.map((entry) => {
    const absPath = path.join(safe.resolved, entry.name);
    let stat = null;
    try {
      stat = fs.statSync(absPath);
    } catch (err) {
      stat = null;
    }
    const childRel = path.posix.join(safe.rel, entry.name);
    return {
      name: entry.name,
      path: childRel,
      isDir: entry.isDirectory(),
      size: stat && stat.isFile() ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : 0
    };
  });
  return sendJson(res, 200, { path: safe.rel, entries: list });
}

function handleFile(req, res, url) {
  if (!isAuthorized(req)) {
    res.writeHead(401);
    res.end('UNAUTHORIZED');
    return;
  }
  const relPath = normalizeRelPath(url.searchParams.get('path') || '');
  const safe = resolveSafe(relPath);
  if (!safe) {
    res.writeHead(400);
    res.end('INVALID_PATH');
    return;
  }
  let stat;
  try {
    stat = fs.statSync(safe.resolved);
  } catch (err) {
    res.writeHead(404);
    res.end('NOT_FOUND');
    return;
  }
  if (!stat.isFile()) {
    res.writeHead(404);
    res.end('NOT_FILE');
    return;
  }

  const total = stat.size;
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', getContentType(safe.resolved));

  if (!range) {
    res.writeHead(200, { 'Content-Length': total });
    fs.createReadStream(safe.resolved).pipe(res);
    return;
  }

  const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : total - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start >= total) {
    res.writeHead(416, { 'Content-Range': `bytes */${total}` });
    res.end();
    return;
  }

  const chunkSize = end - start + 1;
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Content-Length': chunkSize
  });
  fs.createReadStream(safe.resolved, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/list') {
    return handleList(req, res, url);
  }
  if (req.method === 'GET' && url.pathname === '/file') {
    return handleFile(req, res, url);
  }
  res.writeHead(404);
  res.end('NOT_FOUND');
});

server.listen(PORT, HOST, () => {
  console.log(`Windows media server running on http://${HOST}:${PORT}`);
  console.log(`ROOT_DIR=${ROOT_DIR}`);
});
