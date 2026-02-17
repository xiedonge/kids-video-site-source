import { getJSON, createVideoCard } from './api.js';

const categoryTitle = document.getElementById('category-title');
const videoGrid = document.getElementById('video-grid');

function renderEmpty(text) {
  videoGrid.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  videoGrid.appendChild(div);
}

async function load() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    renderEmpty('缺少分类');
    return;
  }

  const [categoriesRes, videosRes] = await Promise.all([
    getJSON('/api/categories'),
    getJSON(`/api/categories/${id}/videos`)
  ]);

  const category = categoriesRes.categories.find((item) => String(item.id) === String(id));
  categoryTitle.textContent = category ? category.name : '分类';

  if (!videosRes.videos.length) {
    renderEmpty('这个分类还没有视频');
    return;
  }

  videoGrid.innerHTML = '';
  videosRes.videos.forEach((video) => {
    const card = createVideoCard(video);
    const meta = document.createElement('div');
    meta.className = 'category-meta';
    const completed = video.completed ? '已完成' : `进度 ${Math.floor(video.progress_percent || 0)}%`;
    meta.textContent = completed;
    card.appendChild(meta);
    videoGrid.appendChild(card);
  });
}

load().catch((err) => {
  console.error(err);
  renderEmpty('加载失败');
});
