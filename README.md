# Kids Video Site

家庭儿童学习视频网站（Debian 13 + Node.js 20 + Express + SQLite）。

## 功能概览
- 百度网盘目录同步（一级目录=分类，二级文件=视频，支持 mp4/mov/m4v）
- Windows 本地文件夹同步（无公网 IP 可通过反向隧道）
- 视频后端流式代理播放，支持拖动
- 学习进度与统计（今日/本周/连续天数/分类统计/Top 视频）
- 管理端用户名登录、百度 OAuth 授权、手动同步

## 目录结构
```
kids-video-site/
├── server/
├── public/
├── install.sh
├── package.json
└── README.md
```

## 环境变量
在 `/opt/kids-video-site/.env` 中配置：
```
BAIDU_CLIENT_ID=你的AppKey
BAIDU_CLIENT_SECRET=你的SecretKey
BAIDU_REDIRECT_URI=https://你的域名/api/admin/baidu/oauth/callback

# 可选
ADMIN_USERNAME=admin
CACHE_MAX_GB=8
CACHE_DIR=/opt/kids-video-site/data/cache
PREFETCH_NEXT=true
BAIDU_SCOPE=basic,netdisk
BAIDU_OAUTH_BASE=https://openapi.baidu.com/oauth/2.0
BAIDU_PAN_BASE=https://pan.baidu.com/rest/2.0/xpan
PORT=3000
DATA_DIR=/opt/kids-video-site/data
DB_PATH=/opt/kids-video-site/data/kids-video-site.sqlite
```

## Windows 来源（无公网 IP）
1. 在 Windows 上准备 Node.js 18+。
2. 拷贝 `tools/win-media-server.js` 到 Windows（或从本仓库获取）。
3. 在 Windows 终端运行：
```
set WIN_MEDIA_ROOT=D:\KidsVideos
set WIN_MEDIA_PORT=18080
set WIN_MEDIA_TOKEN=yourtoken
node win-media-server.js
```
4. 在 Windows 到服务器建立反向隧道（示例）：
```
ssh -N -R 127.0.0.1:19080:127.0.0.1:18080 root@你的服务器IP
```
5. 在管理端设置：
   - 视频来源 = Windows 文件夹
   - Windows Base URL = `http://127.0.0.1:19080`
   - Windows Root Path = `/` 或子目录
   - Windows Token = `yourtoken`
6. 点击“手动同步”。

> Windows 服务默认仅本机访问，通过反向隧道让服务器访问。

## 启动
```
npm install
npm start
```
服务默认监听 `127.0.0.1:3000`。

## Nginx 参考配置
```
server {
  listen 80;
  server_name your.domain;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
  }

  location /api/stream/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_request_buffering off;
  }
}
```

## 安装部署
执行 `install.sh` 可完成系统依赖安装、Node.js 20 安装、服务创建与启动。
