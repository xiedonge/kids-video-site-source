export async function getJSON(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(data || {})
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}小时${rem}分`;
  }
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

export function formatMinutes(seconds) {
  const mins = Math.floor((seconds || 0) / 60);
  return `${mins} 分钟`;
}

export function createVideoCard(video) {
  const card = document.createElement('a');
  card.className = 'card video-card';
  card.href = `/watch.html?id=${video.id}`;

  const thumb = document.createElement('div');
  thumb.className = 'video-thumb';
  thumb.textContent = video.title ? video.title.slice(0, 1) : 'V';
  card.appendChild(thumb);

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.textContent = video.title;
  card.appendChild(title);

  if (video.progress_percent !== undefined && video.progress_percent !== null) {
    const progressWrap = document.createElement('div');
    progressWrap.className = 'progress-bar';
    const span = document.createElement('span');
    span.style.width = `${Math.min(100, Math.floor(video.progress_percent || 0))}%`;
    progressWrap.appendChild(span);
    card.appendChild(progressWrap);
  }

  return card;
}
