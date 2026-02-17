import { getJSON, formatMinutes, createVideoCard } from './api.js';

const categoryGrid = document.getElementById('category-grid');
const recentGrid = document.getElementById('recent-grid');
const todayTimeEl = document.getElementById('today-time');
const streakDaysEl = document.getElementById('streak-days');

function renderEmpty(container, text) {
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  container.appendChild(div);
}

async function load() {
  const [{ categories }, recent, summary] = await Promise.all([
    getJSON('/api/categories'),
    getJSON('/api/recent'),
    getJSON('/api/stats/summary')
  ]);

  todayTimeEl.textContent = formatMinutes(summary.todaySeconds);
  streakDaysEl.textContent = `${summary.streakDays} 天`;

  categoryGrid.innerHTML = '';
  if (!categories.length) {
    renderEmpty(categoryGrid, '还没有分类，去管理页面同步吧！');
  } else {
    categories.forEach((cat) => {
      const card = document.createElement('a');
      card.className = 'card category-card';
      card.href = `/category.html?id=${cat.id}`;

      const title = document.createElement('div');
      title.className = 'category-title';
      title.textContent = cat.name;

      const meta = document.createElement('div');
      meta.className = 'category-meta';
      meta.textContent = `${cat.video_count} 个视频`;

      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = '开始学习';

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(chip);
      categoryGrid.appendChild(card);
    });
  }

  recentGrid.innerHTML = '';
  if (!recent.videos || !recent.videos.length) {
    renderEmpty(recentGrid, '最近没有观看记录');
  } else {
    recent.videos.forEach((video) => {
      recentGrid.appendChild(createVideoCard(video));
    });
  }
}

load().catch((err) => {
  console.error(err);
  renderEmpty(categoryGrid, '加载失败');
});
