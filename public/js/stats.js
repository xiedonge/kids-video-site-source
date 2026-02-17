import { getJSON, formatMinutes, createVideoCard } from './api.js';

const statToday = document.getElementById('stat-today');
const statWeek = document.getElementById('stat-week');
const statStreak = document.getElementById('stat-streak');
const categoryStats = document.getElementById('category-stats');
const topVideos = document.getElementById('top-videos');
const recentVideos = document.getElementById('recent-videos');

function renderEmpty(container, text) {
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  container.appendChild(div);
}

async function load() {
  const [summary, categoryRes, topRes, recentRes] = await Promise.all([
    getJSON('/api/stats/summary'),
    getJSON('/api/stats/by-category'),
    getJSON('/api/stats/top-videos'),
    getJSON('/api/recent')
  ]);

  statToday.textContent = formatMinutes(summary.todaySeconds);
  statWeek.textContent = formatMinutes(summary.weekSeconds);
  statStreak.textContent = `${summary.streakDays} 天`;

  categoryStats.innerHTML = '';
  if (!categoryRes.categories.length) {
    renderEmpty(categoryStats, '暂无分类统计');
  } else {
    categoryRes.categories.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span>${cat.name}</span><strong>${formatMinutes(cat.watch_seconds)}</strong>`;
      categoryStats.appendChild(row);
    });
  }

  topVideos.innerHTML = '';
  if (!topRes.videos.length) {
    renderEmpty(topVideos, '暂无观看排行');
  } else {
    topRes.videos.forEach((video) => {
      topVideos.appendChild(createVideoCard(video));
    });
  }

  recentVideos.innerHTML = '';
  if (!recentRes.videos.length) {
    renderEmpty(recentVideos, '暂无最近观看');
  } else {
    recentRes.videos.forEach((video) => {
      recentVideos.appendChild(createVideoCard(video));
    });
  }
}

load().catch((err) => {
  console.error(err);
  renderEmpty(categoryStats, '加载失败');
});
