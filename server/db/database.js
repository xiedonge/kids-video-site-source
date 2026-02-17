const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'kids-video-site.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  baidu_file_id TEXT UNIQUE,
  source_type TEXT DEFAULT 'baidu',
  source_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  baidu_file_id TEXT UNIQUE,
  source_type TEXT DEFAULT 'baidu',
  source_path TEXT,
  size_bytes INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
  video_id INTEGER PRIMARY KEY,
  last_position_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  total_watch_seconds INTEGER DEFAULT 0,
  last_watched_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  watch_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admin_login_tokens (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_files (
  video_id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT
);
`);

function ensureColumn(table, column, definition) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some((col) => col.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('videos', 'source_type', "TEXT DEFAULT 'baidu'");
ensureColumn('videos', 'source_path', 'TEXT');
ensureColumn('categories', 'source_type', "TEXT DEFAULT 'baidu'");
ensureColumn('categories', 'source_path', 'TEXT');

const now = () => new Date().toISOString();

function logEvent(type, message) {
  db.prepare('INSERT INTO logs (type, message, created_at) VALUES (?, ?, ?)')
    .run(type, message, now());
}

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getConfigMap(keys) {
  const rows = db.prepare(`SELECT key, value FROM config WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys);
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });
  return map;
}

function setConfig(key, value) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

function setConfigMany(values) {
  const stmt = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const tx = db.transaction((entries) => {
    entries.forEach(([key, value]) => stmt.run(key, value));
  });
  tx(Object.entries(values));
}

function upsertCategory({ name, baidu_file_id, source_type = null, source_path = null }) {
  let existing = null;
  if (baidu_file_id) {
    existing = db.prepare('SELECT id FROM categories WHERE baidu_file_id = ?').get(baidu_file_id);
  }
  if (!existing && source_type && source_path) {
    existing = db.prepare('SELECT id FROM categories WHERE source_type = ? AND source_path = ?')
      .get(source_type, source_path);
  }
  const timestamp = now();
  if (existing) {
    db.prepare('UPDATE categories SET name = ?, baidu_file_id = ?, source_type = ?, source_path = ?, updated_at = ? WHERE id = ?')
      .run(name, baidu_file_id || null, source_type || 'baidu', source_path || null, timestamp, existing.id);
    return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO categories (name, baidu_file_id, source_type, source_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, baidu_file_id || null, source_type || 'baidu', source_path || null, timestamp, timestamp);
  return info.lastInsertRowid;
}

function upsertVideo({
  category_id,
  title,
  baidu_file_id,
  source_type = null,
  source_path = null,
  size_bytes,
  duration_seconds,
  thumbnail_url
}) {
  let existing = null;
  if (baidu_file_id) {
    existing = db.prepare('SELECT id FROM videos WHERE baidu_file_id = ?').get(baidu_file_id);
  }
  if (!existing && source_type && source_path) {
    existing = db.prepare('SELECT id FROM videos WHERE source_type = ? AND source_path = ?')
      .get(source_type, source_path);
  }
  const timestamp = now();
  if (existing) {
    db.prepare(`UPDATE videos
      SET category_id = ?, title = ?, baidu_file_id = ?, source_type = ?, source_path = ?,
        size_bytes = ?, duration_seconds = ?, thumbnail_url = ?, deleted = 0, updated_at = ?
      WHERE id = ?`)
      .run(
        category_id,
        title,
        baidu_file_id || null,
        source_type || 'baidu',
        source_path || null,
        size_bytes || 0,
        duration_seconds || 0,
        thumbnail_url || null,
        timestamp,
        existing.id
      );
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO videos
    (category_id, title, baidu_file_id, source_type, source_path, size_bytes, duration_seconds, thumbnail_url, deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(
      category_id,
      title,
      baidu_file_id || null,
      source_type || 'baidu',
      source_path || null,
      size_bytes || 0,
      duration_seconds || 0,
      thumbnail_url || null,
      timestamp,
      timestamp
    );
  return info.lastInsertRowid;
}

function markDeletedVideos(categoryId, keepKeys, keyColumn = 'baidu_file_id') {
  const safeColumn = ['baidu_file_id', 'source_path'].includes(keyColumn) ? keyColumn : 'baidu_file_id';
  const placeholders = keepKeys.length ? keepKeys.map(() => '?').join(',') : null;
  if (!keepKeys.length) {
    db.prepare('UPDATE videos SET deleted = 1 WHERE category_id = ?').run(categoryId);
    return;
  }
  db.prepare(`UPDATE videos SET deleted = 1 WHERE category_id = ? AND ${safeColumn} NOT IN (${placeholders})`)
    .run(categoryId, ...keepKeys);
  db.prepare(`UPDATE videos SET deleted = 0 WHERE category_id = ? AND ${safeColumn} IN (${placeholders})`)
    .run(categoryId, ...keepKeys);
}

function listCategories(sourceType = null) {
  if (sourceType) {
    return db.prepare(`
      SELECT c.id, c.name, c.baidu_file_id,
        COUNT(v.id) as video_count
      FROM categories c
      LEFT JOIN videos v ON v.category_id = c.id AND v.deleted = 0
      WHERE c.source_type = ?
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE
    `).all(sourceType);
  }
  return db.prepare(`
    SELECT c.id, c.name, c.baidu_file_id,
      COUNT(v.id) as video_count
    FROM categories c
    LEFT JOIN videos v ON v.category_id = c.id AND v.deleted = 0
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `).all();
}

function getCategory(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function buildNumericOrderExpr(column) {
  return `CASE
    WHEN ${column} GLOB '[0-9]*' THEN CAST(
      substr(${column}, 1, length(${column}) - length(ltrim(${column}, '0123456789')))
    AS INTEGER)
    ELSE 2147483647
  END`;
}

function listVideosByCategory(categoryId, sourceType = null) {
  const sortExpr = buildNumericOrderExpr('v.title');
  if (sourceType) {
    return db.prepare(`
      SELECT v.*, p.last_position_seconds, p.duration_seconds AS progress_duration_seconds,
        p.progress_percent, p.completed, p.total_watch_seconds, p.last_watched_at
      FROM videos v
      JOIN categories c ON c.id = v.category_id
      LEFT JOIN progress p ON p.video_id = v.id
      WHERE v.category_id = ? AND v.deleted = 0 AND c.source_type = ?
      ORDER BY ${sortExpr}, v.title COLLATE NOCASE
    `).all(categoryId, sourceType);
  }
  return db.prepare(`
    SELECT v.*, p.last_position_seconds, p.duration_seconds AS progress_duration_seconds,
      p.progress_percent, p.completed, p.total_watch_seconds, p.last_watched_at
    FROM videos v
    LEFT JOIN progress p ON p.video_id = v.id
    WHERE v.category_id = ? AND v.deleted = 0
    ORDER BY ${sortExpr}, v.title COLLATE NOCASE
  `).all(categoryId);
}

function getVideo(id, sourceType = null) {
  if (sourceType) {
    return db.prepare(`
      SELECT v.*, c.name AS category_name, c.id AS category_id,
        p.last_position_seconds, p.duration_seconds AS progress_duration_seconds,
        p.progress_percent, p.completed, p.total_watch_seconds, p.last_watched_at
      FROM videos v
      JOIN categories c ON c.id = v.category_id
      LEFT JOIN progress p ON p.video_id = v.id
      WHERE v.id = ? AND v.source_type = ?
    `).get(id, sourceType);
  }
  return db.prepare(`
    SELECT v.*, c.name AS category_name, c.id AS category_id,
      p.last_position_seconds, p.duration_seconds AS progress_duration_seconds,
      p.progress_percent, p.completed, p.total_watch_seconds, p.last_watched_at
    FROM videos v
    JOIN categories c ON c.id = v.category_id
    LEFT JOIN progress p ON p.video_id = v.id
    WHERE v.id = ?
  `).get(id);
}

function getNextVideoInCategory(videoId) {
  const sortExpr = buildNumericOrderExpr('v.title');
  const currentSortExpr = buildNumericOrderExpr('c.title');
  return db.prepare(`
    WITH current AS (
      SELECT id, category_id, title
      FROM videos
      WHERE id = ?
    )
    SELECT v.id, v.title, v.baidu_file_id, v.source_type, v.source_path, v.size_bytes, v.category_id
    FROM videos v
    JOIN current c ON v.category_id = c.category_id
    WHERE v.deleted = 0 AND (
      (${sortExpr}) > (${currentSortExpr}) OR
      ((${sortExpr}) = (${currentSortExpr}) AND v.title COLLATE NOCASE > c.title COLLATE NOCASE)
    )
    ORDER BY ${sortExpr}, v.title COLLATE NOCASE
    LIMIT 1
  `).get(videoId);
}

function updateProgress({ videoId, positionSeconds, durationSeconds, progressPercent, completed, watchSecondsToAdd }) {
  const existing = db.prepare('SELECT total_watch_seconds FROM progress WHERE video_id = ?').get(videoId);
  const totalWatch = (existing ? existing.total_watch_seconds : 0) + (watchSecondsToAdd || 0);
  const timestamp = now();
  db.prepare(`
    INSERT INTO progress (video_id, last_position_seconds, duration_seconds, progress_percent, completed, total_watch_seconds, last_watched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(video_id) DO UPDATE SET
      last_position_seconds = excluded.last_position_seconds,
      duration_seconds = excluded.duration_seconds,
      progress_percent = excluded.progress_percent,
      completed = excluded.completed,
      total_watch_seconds = ?,
      last_watched_at = excluded.last_watched_at
  `).run(
    videoId,
    positionSeconds || 0,
    durationSeconds || 0,
    progressPercent || 0,
    completed ? 1 : 0,
    totalWatch,
    timestamp,
    totalWatch
  );
}

function addDailyWatchSeconds(date, seconds) {
  if (!seconds || seconds <= 0) return;
  db.prepare(`
    INSERT INTO daily_stats (date, watch_seconds) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET watch_seconds = watch_seconds + excluded.watch_seconds
  `).run(date, seconds);
}

function getSummaryStats({ todayDate, weekDates }) {
  const today = db.prepare('SELECT watch_seconds FROM daily_stats WHERE date = ?').get(todayDate);
  const week = db.prepare(`SELECT SUM(watch_seconds) AS total FROM daily_stats WHERE date IN (${weekDates.map(() => '?').join(',')})`)
    .get(...weekDates);
  return {
    todaySeconds: today ? today.watch_seconds : 0,
    weekSeconds: week && week.total ? week.total : 0
  };
}

function getWatchSecondsForDate(date) {
  const row = db.prepare('SELECT watch_seconds FROM daily_stats WHERE date = ?').get(date);
  return row ? row.watch_seconds : 0;
}

function getRecentVideos(limit = 3, sourceType = null) {
  if (sourceType) {
    return db.prepare(`
      SELECT v.id, v.title, v.thumbnail_url, v.category_id, c.name AS category_name,
        p.last_watched_at, p.progress_percent
      FROM progress p
      JOIN videos v ON v.id = p.video_id
      JOIN categories c ON c.id = v.category_id
      WHERE v.deleted = 0 AND v.source_type = ?
      ORDER BY p.last_watched_at DESC
      LIMIT ?
    `).all(sourceType, limit);
  }
  return db.prepare(`
    SELECT v.id, v.title, v.thumbnail_url, v.category_id, c.name AS category_name,
      p.last_watched_at, p.progress_percent
    FROM progress p
    JOIN videos v ON v.id = p.video_id
    JOIN categories c ON c.id = v.category_id
    WHERE v.deleted = 0
    ORDER BY p.last_watched_at DESC
    LIMIT ?
  `).all(limit);
}

function getTopVideos(limit = 6, sourceType = null) {
  if (sourceType) {
    return db.prepare(`
      SELECT v.id, v.title, v.thumbnail_url, v.category_id, c.name AS category_name,
        p.total_watch_seconds
      FROM progress p
      JOIN videos v ON v.id = p.video_id
      JOIN categories c ON c.id = v.category_id
      WHERE v.deleted = 0 AND v.source_type = ?
      ORDER BY p.total_watch_seconds DESC
      LIMIT ?
    `).all(sourceType, limit);
  }
  return db.prepare(`
    SELECT v.id, v.title, v.thumbnail_url, v.category_id, c.name AS category_name,
      p.total_watch_seconds
    FROM progress p
    JOIN videos v ON v.id = p.video_id
    JOIN categories c ON c.id = v.category_id
    WHERE v.deleted = 0
    ORDER BY p.total_watch_seconds DESC
    LIMIT ?
  `).all(limit);
}

function getCategoryStats(sourceType = null) {
  if (sourceType) {
    return db.prepare(`
      SELECT c.id, c.name, COALESCE(SUM(p.total_watch_seconds), 0) AS watch_seconds
      FROM categories c
      LEFT JOIN videos v ON v.category_id = c.id AND v.deleted = 0
      LEFT JOIN progress p ON p.video_id = v.id
      WHERE c.source_type = ?
      GROUP BY c.id
      ORDER BY watch_seconds DESC, c.name COLLATE NOCASE
    `).all(sourceType);
  }
  return db.prepare(`
    SELECT c.id, c.name, COALESCE(SUM(p.total_watch_seconds), 0) AS watch_seconds
    FROM categories c
    LEFT JOIN videos v ON v.category_id = c.id AND v.deleted = 0
    LEFT JOIN progress p ON p.video_id = v.id
    GROUP BY c.id
    ORDER BY watch_seconds DESC, c.name COLLATE NOCASE
  `).all();
}

function getLogs(limit = 100) {
  return db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit);
}

function getCacheEntry(videoId) {
  return db.prepare('SELECT * FROM cache_files WHERE video_id = ?').get(videoId);
}

function upsertCacheEntry({ video_id, path, size_bytes, completed }) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO cache_files (video_id, path, size_bytes, completed, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(video_id) DO UPDATE SET
      path = excluded.path,
      size_bytes = excluded.size_bytes,
      completed = excluded.completed,
      updated_at = excluded.updated_at
  `).run(
    video_id,
    path,
    size_bytes || 0,
    completed ? 1 : 0,
    timestamp,
    timestamp,
    timestamp
  );
}

function markCacheCompleted(videoId, sizeBytes, path) {
  const timestamp = now();
  db.prepare(`
    UPDATE cache_files
    SET completed = 1, size_bytes = ?, path = ?, updated_at = ?, last_accessed_at = ?
    WHERE video_id = ?
  `).run(sizeBytes || 0, path, timestamp, timestamp, videoId);
}

function touchCacheEntry(videoId) {
  const timestamp = now();
  db.prepare('UPDATE cache_files SET last_accessed_at = ?, updated_at = ? WHERE video_id = ?')
    .run(timestamp, timestamp, videoId);
}

function deleteCacheEntry(videoId) {
  db.prepare('DELETE FROM cache_files WHERE video_id = ?').run(videoId);
}

function listCacheEntries() {
  return db.prepare('SELECT * FROM cache_files').all();
}

function createAdminLoginToken(token) {
  db.prepare('INSERT INTO admin_login_tokens (token, created_at, used) VALUES (?, ?, 0)').run(token, now());
}

function markLoginTokenUsed(token) {
  db.prepare('UPDATE admin_login_tokens SET used = 1 WHERE token = ?').run(token);
}

function isLoginTokenUsed(token) {
  const row = db.prepare('SELECT used FROM admin_login_tokens WHERE token = ?').get(token);
  return row ? row.used === 1 : false;
}

function createAdminSession(token, expiresAt) {
  db.prepare('INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)')
    .run(token, now(), expiresAt);
}

function getAdminSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function clearData() {
  db.prepare('DELETE FROM progress').run();
  db.prepare('DELETE FROM daily_stats').run();
  db.prepare('UPDATE videos SET deleted = 0').run();
}

function exportAll() {
  const tables = ['categories', 'videos', 'progress', 'daily_stats', 'config', 'logs'];
  const output = {};
  tables.forEach((table) => {
    output[table] = db.prepare(`SELECT * FROM ${table}`).all();
  });
  return output;
}

module.exports = {
  db,
  logEvent,
  getConfig,
  getConfigMap,
  setConfig,
  setConfigMany,
  upsertCategory,
  upsertVideo,
  markDeletedVideos,
  listCategories,
  getCategory,
  listVideosByCategory,
  getVideo,
  getNextVideoInCategory,
  updateProgress,
  addDailyWatchSeconds,
  getSummaryStats,
  getWatchSecondsForDate,
  getRecentVideos,
  getTopVideos,
  getCategoryStats,
  getLogs,
  getCacheEntry,
  upsertCacheEntry,
  markCacheCompleted,
  touchCacheEntry,
  deleteCacheEntry,
  listCacheEntries,
  createAdminLoginToken,
  markLoginTokenUsed,
  isLoginTokenUsed,
  createAdminSession,
  getAdminSession,
  clearData,
  exportAll
};
