const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  getCacheEntry,
  upsertCacheEntry,
  markCacheCompleted,
  touchCacheEntry,
  deleteCacheEntry,
  listCacheEntries,
  logEvent,
  getNextVideoInCategory
} = require('../db/database');
const { getDlink } = require('./baidu');
const windows = require('./windows');

const DEFAULT_MAX_GB = 8;
const MAX_CACHE_BYTES = Number(process.env.CACHE_MAX_BYTES) || (Number(process.env.CACHE_MAX_GB) || DEFAULT_MAX_GB) * 1024 * 1024 * 1024;
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '..', '..', 'data', 'cache');
const PREFETCH_NEXT = (process.env.PREFETCH_NEXT || 'true').toLowerCase() !== 'false';

const inProgress = new Set();
const queue = [];
let active = false;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getFileExtension(title) {
  if (!title) return '.mp4';
  const ext = path.extname(title).toLowerCase();
  if (ext === '.mov' || ext === '.mp4' || ext === '.m4v') return ext;
  return '.mp4';
}

function getCachePath(video) {
  const ext = getFileExtension(video.title);
  return path.join(CACHE_DIR, `${video.id}${ext}`);
}

function getCachedPath(videoId) {
  const entry = getCacheEntry(videoId);
  if (!entry || !entry.completed) return null;
  if (!fs.existsSync(entry.path)) {
    deleteCacheEntry(videoId);
    return null;
  }
  touchCacheEntry(videoId);
  return entry.path;
}

function currentCacheState() {
  const entries = listCacheEntries();
  const completed = [];
  let total = 0;
  entries.forEach((entry) => {
    if (!entry.completed) return;
    if (!fs.existsSync(entry.path)) {
      deleteCacheEntry(entry.video_id);
      return;
    }
    const size = Number(entry.size_bytes || 0);
    total += size;
    completed.push({
      video_id: entry.video_id,
      path: entry.path,
      size_bytes: size,
      last_accessed_at: entry.last_accessed_at || entry.updated_at || entry.created_at
    });
  });
  completed.sort((a, b) => String(a.last_accessed_at).localeCompare(String(b.last_accessed_at)));
  return { total, completed };
}

function evictIfNeeded(requiredBytes) {
  if (!MAX_CACHE_BYTES || MAX_CACHE_BYTES <= 0) return false;
  if (requiredBytes > MAX_CACHE_BYTES) return false;
  const state = currentCacheState();
  let total = state.total;
  for (const entry of state.completed) {
    if (total + requiredBytes <= MAX_CACHE_BYTES) break;
    try {
      fs.unlinkSync(entry.path);
    } catch (err) {
      // ignore delete errors
    }
    deleteCacheEntry(entry.video_id);
    total -= entry.size_bytes;
    logEvent('cache', `Evicted cache video ${entry.video_id}`);
  }
  return total + requiredBytes <= MAX_CACHE_BYTES;
}

async function downloadToCache(video) {
  if (!video || !video.id) return;
  const sizeBytes = Number(video.size_bytes || 0);
  if (!sizeBytes || sizeBytes <= 0) return;
  if (sizeBytes > MAX_CACHE_BYTES) return;

  ensureCacheDir();

  if (!evictIfNeeded(sizeBytes)) {
    logEvent('cache', `Skip cache video ${video.id}: not enough space`);
    return;
  }

  const targetPath = getCachePath(video);
  const tempPath = `${targetPath}.part`;
  if (fs.existsSync(targetPath)) {
    return;
  }

  const entry = getCacheEntry(video.id);
  if (!entry) {
    upsertCacheEntry({ video_id: video.id, path: targetPath, size_bytes: sizeBytes, completed: 0 });
  }

  logEvent('cache', `Start caching video ${video.id}`);

  let response;
  if (video.source_type === 'windows') {
    response = await windows.getFileStream(video.source_path);
  } else {
    const dlink = await getDlink(video.baidu_file_id);
    response = await axios.get(dlink, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'netdisk',
        Referer: 'https://pan.baidu.com/',
        Origin: 'https://pan.baidu.com'
      },
      maxRedirects: 5,
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  }

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });

  fs.renameSync(tempPath, targetPath);
  markCacheCompleted(video.id, sizeBytes, targetPath);
  logEvent('cache', `Cached video ${video.id}`);
}

function processQueue() {
  if (active) return;
  const task = queue.shift();
  if (!task) return;
  active = true;
  inProgress.add(task.id);
  downloadToCache(task)
    .catch((err) => {
      logEvent('cache', `Cache failed for video ${task.id}: ${err.message}`);
      const targetPath = getCachePath(task);
      const tempPath = `${targetPath}.part`;
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          // ignore
        }
      }
    })
    .finally(() => {
      inProgress.delete(task.id);
      active = false;
      processQueue();
    });
}

function queueDownload(video) {
  if (!video || !video.id) return;
  if (!MAX_CACHE_BYTES || MAX_CACHE_BYTES <= 0) return;
  const cached = getCachedPath(video.id);
  if (cached) return;
  if (inProgress.has(video.id)) return;
  const sizeBytes = Number(video.size_bytes || 0);
  if (!sizeBytes || sizeBytes <= 0) return;
  if (sizeBytes > MAX_CACHE_BYTES) return;
  queue.push(video);
  processQueue();
}

function prefetchNext(video) {
  if (!PREFETCH_NEXT) return;
  if (!video || !video.id) return;
  const next = getNextVideoInCategory(video.id);
  if (next) {
    queueDownload(next);
  }
}

module.exports = {
  getCachedPath,
  queueDownload,
  prefetchNext,
  MAX_CACHE_BYTES,
  CACHE_DIR
};
