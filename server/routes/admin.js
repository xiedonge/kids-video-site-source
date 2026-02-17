const express = require('express');
const {
  getConfig,
  getConfigMap,
  setConfigMany,
  getAdminSession,
  getLogs,
  clearData,
  exportAll,
  logEvent,
  upsertCategory,
  upsertVideo,
  markDeletedVideos
} = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const baidu = require('../services/baidu');
const windows = require('../services/windows');

const router = express.Router();

router.get('/status', (req, res) => {
  const session = getAdminSession(req.cookies.admin_session);
  if (!session) {
    return res.status(401).json({ ok: false });
  }
  return res.json({ ok: true, expiresAt: session.expires_at });
});

router.get('/config', requireAdmin, (req, res) => {
  const config = getConfigMap([
    'root_path',
    'baidu_scope',
    'source_type',
    'win_base_url',
    'win_root_path',
    'win_token'
  ]);
  const rootPath = config.root_path || '/';
  const scope = config.baidu_scope || null;
  const sourceType = config.source_type || 'baidu';
  const winBaseUrl = config.win_base_url || '';
  const winRootPath = config.win_root_path || '/';
  const winToken = config.win_token || '';
  res.json({
    rootPath,
    scope,
    sourceType,
    winBaseUrl,
    winRootPath,
    winToken
  });
});

router.post('/config', requireAdmin, (req, res) => {
  const { rootPath, sourceType, winBaseUrl, winRootPath, winToken } = req.body || {};
  const nextSourceType = sourceType === 'windows' ? 'windows' : 'baidu';
  const trimmedRoot = typeof rootPath === 'string' ? rootPath.trim() : '';
  const trimmedWinBase = typeof winBaseUrl === 'string' ? winBaseUrl.trim() : '';
  const trimmedWinRoot = typeof winRootPath === 'string' ? winRootPath.trim() : '';
  const trimmedWinToken = typeof winToken === 'string' ? winToken.trim() : '';

  if (nextSourceType === 'baidu' && !trimmedRoot) {
    return res.status(400).json({ error: 'INVALID_ROOT' });
  }
  if (nextSourceType === 'windows' && !trimmedWinBase) {
    return res.status(400).json({ error: 'INVALID_WIN_BASE' });
  }

  setConfigMany({
    root_path: trimmedRoot || '/',
    source_type: nextSourceType,
    win_base_url: trimmedWinBase,
    win_root_path: trimmedWinRoot || '/',
    win_token: trimmedWinToken
  });
  logEvent('config', `Config updated (source=${nextSourceType})`);
  return res.json({ ok: true });
});

router.post('/baidu/oauth/start', requireAdmin, (req, res) => {
  try {
    const url = baidu.getAuthUrl();
    return res.json({ url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/baidu/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }
  if (!code) {
    return res.status(400).send('Missing code');
  }
  try {
    await baidu.exchangeCodeForToken(code);
    return res.send('<html><body><h2>授权成功</h2><p>可以返回管理页面继续。</p></body></html>');
  } catch (err) {
    return res.status(500).send(`授权失败: ${err.message}`);
  }
});

router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const sourceType = getConfig('source_type') || 'baidu';
    let categoryCount = 0;
    let videoCount = 0;

    if (sourceType === 'windows') {
      const rootPath = getConfig('win_root_path') || '/';
      const folders = await windows.listFolder(rootPath);
      const categoryFolders = folders.filter((item) => item.isDir);
      categoryCount = categoryFolders.length;
      for (const folder of categoryFolders) {
        const categoryId = upsertCategory({
          name: folder.name,
          source_type: 'windows',
          source_path: folder.path
        });
        const files = await windows.listFolder(folder.path);
        const videos = files.filter((item) => {
          if (item.isDir) return false;
          const name = item.name.toLowerCase();
          return name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.m4v');
        });
        const keepPaths = [];
        for (const file of videos) {
          keepPaths.push(file.path);
          upsertVideo({
            category_id: categoryId,
            title: file.name,
            source_type: 'windows',
            source_path: file.path,
            size_bytes: file.size || 0,
            duration_seconds: 0,
            thumbnail_url: null
          });
          videoCount += 1;
        }
        markDeletedVideos(categoryId, keepPaths, 'source_path');
      }
      logEvent('sync', `Synced windows ${categoryCount} categories, ${videoCount} videos`);
      return res.json({ ok: true, categories: categoryCount, videos: videoCount });
    }

    const rootPath = getConfig('root_path') || '/';
    const folders = await baidu.listFolder(rootPath);
    const categoryFolders = folders.filter((item) => item.isdir === 1);
    categoryCount = categoryFolders.length;
    for (const folder of categoryFolders) {
      const categoryId = upsertCategory({
        name: folder.server_filename,
        baidu_file_id: String(folder.fs_id),
        source_type: 'baidu',
        source_path: folder.path
      });
      const files = await baidu.listFolder(folder.path);
      const videos = files.filter((item) => {
        if (item.isdir !== 0) return false;
        const name = item.server_filename.toLowerCase();
        return name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.m4v');
      });
      const keepIds = [];
      for (const file of videos) {
        keepIds.push(String(file.fs_id));
        upsertVideo({
          category_id: categoryId,
          title: file.server_filename,
          baidu_file_id: String(file.fs_id),
          source_type: 'baidu',
          source_path: file.path,
          size_bytes: file.size || 0,
          duration_seconds: file.duration || 0,
          thumbnail_url: file.thumbs && (file.thumbs.url || file.thumbs.icon) ? (file.thumbs.url || file.thumbs.icon) : null
        });
        videoCount += 1;
      }
      markDeletedVideos(categoryId, keepIds);
    }
    logEvent('sync', `Synced ${categoryCount} categories, ${videoCount} videos`);
    return res.json({ ok: true, categories: categoryCount, videos: videoCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/logs', requireAdmin, (req, res) => {
  const logs = getLogs(100);
  res.json({ logs });
});

router.get('/export', requireAdmin, (req, res) => {
  const data = exportAll();
  res.json({ exportedAt: new Date().toISOString(), data });
});

router.post('/clear', requireAdmin, (req, res) => {
  clearData();
  logEvent('admin', 'Cleared progress and stats');
  res.json({ ok: true });
});

module.exports = router;
