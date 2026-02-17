import { getJSON, postJSON } from './api.js';

const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const logsSection = document.getElementById('logs-section');
const loginStatus = document.getElementById('login-status');
const usernameInput = document.getElementById('admin-username');
const loginBtn = document.getElementById('login-btn');
const oauthBtn = document.getElementById('oauth-btn');
const rootPathInput = document.getElementById('root-path');
const saveRootBtn = document.getElementById('save-root');
const sourceTypeSelect = document.getElementById('source-type');
const winBaseUrlInput = document.getElementById('win-base-url');
const winRootPathInput = document.getElementById('win-root-path');
const winTokenInput = document.getElementById('win-token');
const saveWinBtn = document.getElementById('save-win');
const baiduCard = document.getElementById('baidu-card');
const baiduRootCard = document.getElementById('baidu-root-card');
const windowsCard = document.getElementById('windows-card');
const localCard = document.getElementById('local-card');
const localRootPathInput = document.getElementById('local-root-path');
const saveLocalBtn = document.getElementById('save-local');
const syncBtn = document.getElementById('sync-btn');
const syncResult = document.getElementById('sync-result');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');
const logList = document.getElementById('log-list');

function showAdmin() {
  loginSection.style.display = 'none';
  adminSection.style.display = 'block';
  logsSection.style.display = 'block';
}

function showLogin() {
  loginSection.style.display = 'block';
  adminSection.style.display = 'none';
  logsSection.style.display = 'none';
}

async function loadLogs() {
  const { logs } = await getJSON('/api/admin/logs');
  logList.innerHTML = '';
  if (!logs.length) {
    logList.innerHTML = '<div class="empty">暂无日志</div>';
    return;
  }
  logs.forEach((log) => {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.textContent = `[${log.created_at}] ${log.type} - ${log.message}`;
    logList.appendChild(item);
  });
}

async function loadConfig() {
  const {
    rootPath,
    sourceType,
    winBaseUrl,
    winRootPath,
    winToken,
    localRootPath
  } = await getJSON('/api/admin/config');
  rootPathInput.value = rootPath || '/';
  sourceTypeSelect.value = sourceType || 'baidu';
  winBaseUrlInput.value = winBaseUrl || '';
  winRootPathInput.value = winRootPath || '/';
  winTokenInput.value = winToken || '';
  localRootPathInput.value = localRootPath || '/';
  updateSourceUI(sourceType || 'baidu');
}

function updateSourceUI(sourceType) {
  const isWindows = sourceType === 'windows';
  const isLocal = sourceType === 'local';
  baiduCard.style.display = isWindows || isLocal ? 'none' : 'block';
  baiduRootCard.style.display = isWindows || isLocal ? 'none' : 'block';
  windowsCard.style.display = isWindows ? 'block' : 'none';
  localCard.style.display = isLocal ? 'block' : 'none';
}

async function saveConfig() {
  const payload = {
    rootPath: rootPathInput.value,
    sourceType: sourceTypeSelect.value,
    winBaseUrl: winBaseUrlInput.value,
    winRootPath: winRootPathInput.value,
    winToken: winTokenInput.value,
    localRootPath: localRootPathInput.value
  };
  await postJSON('/api/admin/config', payload);
  await loadLogs();
}

async function doLogin() {
  const username = usernameInput.value.trim();
  if (!username) {
    loginStatus.textContent = '请输入用户名';
    return;
  }
  try {
    loginStatus.textContent = '登录中...';
    await postJSON('/api/admin/login', { username });
    showAdmin();
    await loadConfig();
    await loadLogs();
  } catch (err) {
    loginStatus.textContent = `登录失败：${err.message}`;
  }
}

async function checkSession() {
  try {
    const status = await getJSON('/api/admin/status');
    if (status.ok) {
      showAdmin();
      await loadConfig();
      await loadLogs();
      return;
    }
  } catch (err) {
    // ignored
  }
  showLogin();
  loginStatus.textContent = '请输入用户名';
}

loginBtn.addEventListener('click', () => {
  doLogin().catch((err) => console.error(err));
});

usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    doLogin().catch((err) => console.error(err));
  }
});

syncBtn.addEventListener('click', async () => {
  syncResult.textContent = '同步中...';
  try {
    const res = await postJSON('/api/admin/sync');
    syncResult.textContent = `完成：${res.categories} 个分类，${res.videos} 个视频`;
    await loadLogs();
  } catch (err) {
    syncResult.textContent = `同步失败：${err.message}`;
  }
});

oauthBtn.addEventListener('click', async () => {
  try {
    const res = await postJSON('/api/admin/baidu/oauth/start');
    window.location.href = res.url;
  } catch (err) {
    alert(`无法开始授权：${err.message}`);
  }
});

saveRootBtn.addEventListener('click', async () => {
  try {
    await saveConfig();
    alert('保存成功');
  } catch (err) {
    alert(`保存失败：${err.message}`);
  }
});

saveWinBtn.addEventListener('click', async () => {
  try {
    await saveConfig();
    alert('保存成功');
  } catch (err) {
    alert(`保存失败：${err.message}`);
  }
});

saveLocalBtn.addEventListener('click', async () => {
  try {
    await saveConfig();
    alert('保存成功');
  } catch (err) {
    alert(`保存失败：${err.message}`);
  }
});

sourceTypeSelect.addEventListener('change', () => {
  updateSourceUI(sourceTypeSelect.value);
});

exportBtn.addEventListener('click', async () => {
  try {
    const res = await getJSON('/api/admin/export');
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kids-video-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`导出失败：${err.message}`);
  }
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定要清空进度和统计数据吗？')) return;
  try {
    await postJSON('/api/admin/clear');
    await loadLogs();
    alert('已清空');
  } catch (err) {
    alert(`清空失败：${err.message}`);
  }
});

checkSession().catch((err) => {
  console.error(err);
});
