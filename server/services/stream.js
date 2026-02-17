const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getDlink } = require('./baidu');
const { getCachedPath, queueDownload, prefetchNext } = require('./cache');
const windows = require('./windows');

function getContentTypeByExt(ext) {
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4v') return 'video/mp4';
  return 'video/mp4';
}

function streamLocalFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(filePath).toLowerCase();

  res.setHeader('Content-Type', getContentTypeByExt(ext));
  res.setHeader('Accept-Ranges', 'bytes');

  if (!range) {
    res.setHeader('Content-Length', fileSize);
    res.status(200);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const bytes = range.replace(/bytes=/, '').split('-');
  const start = parseInt(bytes[0], 10);
  const end = bytes[1] ? parseInt(bytes[1], 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
    res.end();
    return;
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  res.setHeader('Content-Length', chunkSize);
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

async function streamVideo(req, res, video) {
  const cachedPath = getCachedPath(video.id);
  if (cachedPath) {
    streamLocalFile(req, res, cachedPath);
    return;
  }

  queueDownload(video);
  prefetchNext(video);

  const range = req.headers.range || 'bytes=0-';
  let upstream;
  if (video.source_type === 'windows') {
    upstream = await windows.getFileStream(video.source_path, range);
  } else {
    const dlink = await getDlink(video.baidu_file_id);
    upstream = await axios.get(dlink, {
      responseType: 'stream',
      headers: {
        Range: range,
        'User-Agent': 'netdisk',
        Referer: 'https://pan.baidu.com/',
        Origin: 'https://pan.baidu.com'
      },
      maxRedirects: 5,
      timeout: 0
    });
  }

  res.status(upstream.status);
  const upstreamType = upstream.headers['content-type'];
  const ext = path.extname(video.title || '').toLowerCase();
  res.setHeader('Content-Type', upstreamType || getContentTypeByExt(ext));
  res.setHeader('Accept-Ranges', 'bytes');
  if (upstream.headers['content-range']) {
    res.setHeader('Content-Range', upstream.headers['content-range']);
  }
  if (upstream.headers['content-length']) {
    res.setHeader('Content-Length', upstream.headers['content-length']);
  }

  upstream.data.pipe(res);
}

module.exports = { streamVideo };
