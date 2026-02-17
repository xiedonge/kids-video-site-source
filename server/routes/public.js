const express = require('express');
const {
  listCategories,
  listVideosByCategory,
  getVideo,
  getCategory,
  updateProgress,
  addDailyWatchSeconds,
  getRecentVideos,
  getTopVideos,
  getCategoryStats,
  getConfig
} = require('../db/database');
const { getShanghaiDateString } = require('../utils/time');
const { buildSummary } = require('../services/stats');
const { streamVideo } = require('../services/stream');

const router = express.Router();

router.get('/categories', (req, res) => {
  const sourceType = getConfig('source_type') || 'baidu';
  const categories = listCategories(sourceType);
  res.json({ categories });
});

router.get('/categories/:id/videos', (req, res) => {
  const categoryId = Number(req.params.id);
  const sourceType = getConfig('source_type') || 'baidu';
  const category = getCategory(categoryId);
  if (!category || category.source_type !== sourceType) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const videos = listVideosByCategory(categoryId, sourceType);
  res.json({ videos });
});

router.get('/videos/:id', (req, res) => {
  const videoId = Number(req.params.id);
  const sourceType = getConfig('source_type') || 'baidu';
  const video = getVideo(videoId, sourceType);
  if (!video) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  return res.json({ video });
});

router.get('/stream/:id', async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const sourceType = getConfig('source_type') || 'baidu';
    const video = getVideo(videoId, sourceType);
    if (!video) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    await streamVideo(req, res, video);
    return undefined;
  } catch (error) {
    return res.status(500).json({ error: 'STREAM_FAILED', message: error.message });
  }
});

router.post('/progress/heartbeat', (req, res) => {
  const {
    videoId,
    positionSeconds,
    durationSeconds,
    isPlaying,
    isVisible,
    deltaSeconds
  } = req.body || {};

  if (!videoId) {
    return res.status(400).json({ error: 'MISSING_VIDEO' });
  }

  const sourceType = getConfig('source_type') || 'baidu';
  const existing = getVideo(Number(videoId), sourceType);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  const position = Number(positionSeconds) || 0;
  const duration = Number(durationSeconds) || 0;
  const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const completed = percent >= 90;
  const watchSeconds = isPlaying && isVisible ? (Number(deltaSeconds) || 5) : 0;

  updateProgress({
    videoId: Number(videoId),
    positionSeconds: position,
    durationSeconds: duration,
    progressPercent: percent,
    completed,
    watchSecondsToAdd: watchSeconds
  });

  if (watchSeconds > 0) {
    const date = getShanghaiDateString();
    addDailyWatchSeconds(date, watchSeconds);
  }

  return res.json({ ok: true, progressPercent: percent, completed });
});

router.get('/stats/summary', (req, res) => {
  res.json(buildSummary());
});

router.get('/stats/by-category', (req, res) => {
  const sourceType = getConfig('source_type') || 'baidu';
  const categories = getCategoryStats(sourceType);
  res.json({ categories });
});

router.get('/stats/top-videos', (req, res) => {
  const sourceType = getConfig('source_type') || 'baidu';
  const videos = getTopVideos(6, sourceType);
  res.json({ videos });
});

router.get('/recent', (req, res) => {
  const sourceType = getConfig('source_type') || 'baidu';
  const videos = getRecentVideos(3, sourceType);
  res.json({ videos });
});

module.exports = router;
