import { getJSON, postJSON } from './api.js';

const videoEl = document.getElementById('video-player');
const titleEl = document.getElementById('video-title');
const progressText = document.getElementById('progress-text');
const completedBadge = document.getElementById('completed-badge');
const nextVideoEl = document.getElementById('next-video');
const fullscreenBtn = document.getElementById('fullscreen-btn');

let currentVideo = null;
let categoryVideos = [];
let heartbeatTimer = null;

function updateProgressDisplay() {
  const duration = videoEl.duration || currentVideo?.duration_seconds || 0;
  const percent = duration ? Math.min(100, (videoEl.currentTime / duration) * 100) : 0;
  progressText.textContent = `进度 ${Math.floor(percent)}%`;
  if (percent >= 90) {
    completedBadge.style.display = 'inline-flex';
  } else {
    completedBadge.style.display = 'none';
  }
}

function renderNextVideo() {
  if (!currentVideo) return;
  const currentIndex = categoryVideos.findIndex((v) => String(v.id) === String(currentVideo.id));
  const next = categoryVideos[currentIndex + 1];
  if (!next) {
    nextVideoEl.textContent = '已经是最后一集啦！';
    return;
  }
  nextVideoEl.innerHTML = '';
  const link = document.createElement('a');
  link.className = 'video-card';
  link.href = `/watch.html?id=${next.id}`;
  const thumb = document.createElement('div');
  thumb.className = 'video-thumb';
  thumb.textContent = next.title.slice(0, 1);
  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.textContent = next.title;
  link.appendChild(thumb);
  link.appendChild(title);
  nextVideoEl.appendChild(link);
}

async function sendHeartbeat(isPlaying, isVisible) {
  if (!currentVideo) return;
  const duration = Number(videoEl.duration || currentVideo.duration_seconds || 0);
  await postJSON('/api/progress/heartbeat', {
    videoId: currentVideo.id,
    positionSeconds: Number(videoEl.currentTime || 0),
    durationSeconds: duration,
    isPlaying,
    isVisible,
    deltaSeconds: 5
  });
}

async function load() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    nextVideoEl.textContent = '缺少视频 ID';
    return;
  }

  const { video } = await getJSON(`/api/videos/${id}`);
  currentVideo = video;
  titleEl.textContent = video.title;
  document.title = video.title;

  videoEl.src = `/api/stream/${video.id}`;

  const videosRes = await getJSON(`/api/categories/${video.category_id}/videos`);
  categoryVideos = videosRes.videos;
  renderNextVideo();

  videoEl.addEventListener('loadedmetadata', () => {
    if (video.last_position_seconds && video.last_position_seconds < videoEl.duration) {
      videoEl.currentTime = video.last_position_seconds;
    }
    updateProgressDisplay();
  });

  videoEl.addEventListener('timeupdate', updateProgressDisplay);

  videoEl.addEventListener('ended', async () => {
    await sendHeartbeat(false, document.visibilityState === 'visible');
    const currentIndex = categoryVideos.findIndex((v) => String(v.id) === String(currentVideo.id));
    const next = categoryVideos[currentIndex + 1];
    if (next) {
      window.location.href = `/watch.html?id=${next.id}`;
    }
  });

  videoEl.addEventListener('pause', () => {
    sendHeartbeat(false, document.visibilityState === 'visible').catch(() => {});
  });

  heartbeatTimer = setInterval(() => {
    const playing = !videoEl.paused && !videoEl.ended;
    const visible = document.visibilityState === 'visible';
    if (playing && visible) {
      sendHeartbeat(true, true).catch(() => {});
    }
  }, 5000);
}

fullscreenBtn.addEventListener('click', () => {
  if (videoEl.requestFullscreen) {
    videoEl.requestFullscreen();
  } else if (videoEl.webkitRequestFullscreen) {
    videoEl.webkitRequestFullscreen();
  }
});

window.addEventListener('beforeunload', () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
});

load().catch((err) => {
  console.error(err);
  nextVideoEl.textContent = '加载失败';
});
