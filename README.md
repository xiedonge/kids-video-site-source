# Kids Video Site

家庭儿童学习视频网站（Node.js 20 + Express + SQLite）。`install.sh` 适配 Debian/Ubuntu，其他系统请按文档手动安装。

## 功能概览
- 百度网盘目录同步（一级目录=分类，二级文件=视频，支持 mp4/mov/m4v）
- Windows 本地文件夹同步（无公网 IP 可通过反向隧道）
- 服务器本地目录（默认 `/opt/kidvideo`，支持选择子目录）
- 视频后端流式代理播放，支持拖动
- 学习进度与统计（今日/本周/连续天数/分类统计/Top 视频）
- 管理端用户名登录、百度 OAuth 授权、手动同步
- 前台仅展示“当前选择的来源”数据（分类/视频/统计）

## 快速开始（本地目录示例）
1. 把视频放到 `/opt/kidvideo/分类名/视频文件.mp4`（支持 `.mp4/.mov/.m4v`）。
2. 安装依赖并启动：
```
npm install
npm start
```
3. 打开 `http://127.0.0.1:3000/admin.html` 登录管理端。
4. 选择“本地目录”，在“本地目录设置”里填写 `/` 或具体子目录，保存。
5. 点击“立即同步”，回到首页查看分类与视频。

## 目录结构
```
kids-video-site/
├── server/
├── public/
├── data/                # 数据与缓存目录（默认）
├── tools/               # 辅助脚本（Windows 服务/faststart）
├── install.sh
├── package.json
└── README.md
```

## 发布到 GitHub（建议做法）
1. 确保不提交敏感信息：`.env` 已在 `.gitignore` 中，使用 `.env.example` 作为模板。
2. 不提交大文件：`node_modules/`、`data/` 已忽略。
3. 初始化并提交：
```
git init
git add .
git commit -m "init kids-video-site"
```
4. 关联远程仓库并推送：
```
git remote add origin <你的GitHub仓库地址>
git branch -M main
git push -u origin main
```

可选：打包成源码压缩包（不含 `node_modules/`、`data/`、`.env`）：
```
tar --exclude node_modules --exclude data --exclude .env -czf kids-video-site-src.tar.gz .
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
CACHE_MAX_BYTES=
CACHE_DIR=/opt/kids-video-site/data/cache
PREFETCH_NEXT=true
LOCAL_BASE_DIR=/opt/kidvideo
BAIDU_SCOPE=basic,netdisk
BAIDU_OAUTH_BASE=https://openapi.baidu.com/oauth/2.0
BAIDU_PAN_BASE=https://pan.baidu.com/rest/2.0/xpan
PORT=3000
DATA_DIR=/opt/kids-video-site/data
DB_PATH=/opt/kids-video-site/data/kids-video-site.sqlite
```

变量说明：
- `BAIDU_CLIENT_ID` / `BAIDU_CLIENT_SECRET` / `BAIDU_REDIRECT_URI`：百度 OAuth 必填（使用百度网盘来源时需要）。
- `ADMIN_USERNAME`：管理端登录用户名。
- `CACHE_MAX_GB`：缓存上限（单位 GB）。也可用 `CACHE_MAX_BYTES` 以字节为单位精确控制。
- `CACHE_DIR`：缓存目录（建议放 SSD）。
- `PREFETCH_NEXT`：是否预取下一条视频（默认 `true`，设为 `false` 可关闭）。
- `LOCAL_BASE_DIR`：本地目录来源的根目录（只允许访问该目录下内容）。
- `PORT`：服务端口（默认 3000，监听在 `127.0.0.1`）。
- `DATA_DIR` / `DB_PATH`：数据目录与 SQLite 路径。
- `BAIDU_SCOPE` / `BAIDU_OAUTH_BASE` / `BAIDU_PAN_BASE`：百度网盘高级配置，一般不需要改。

## 管理端使用流程
1. 访问 `http://127.0.0.1:3000/admin.html`。
2. 输入管理员用户名登录（默认 `admin`）。
3. 选择视频来源并填写对应设置。
4. 点击“保存”，再点击“立即同步”。
5. 返回首页或分类页查看内容。

> 切换来源后必须重新同步，前台只展示当前来源数据。

## 管理端安全提示
- 管理端仅校验用户名，不建议直接暴露到公网。
- 建议通过 Nginx 基本认证、IP 白名单、VPN 或内网访问进行保护。

## 视频目录结构
- 一级目录 = 分类
- 二级文件 = 视频（支持 `.mp4/.mov/.m4v`）
- 建议使用简单清晰的命名，避免重复标题

说明：根目录只识别为分类目录，根目录下的直接视频文件不会被同步。

## 来源说明
### 百度网盘
1. 在 `.env` 中配置 `BAIDU_CLIENT_ID` / `BAIDU_CLIENT_SECRET` / `BAIDU_REDIRECT_URI`，修改后重启服务。
2. `BAIDU_REDIRECT_URI` 必须与百度开放平台后台配置的回调地址一致，路径固定为 `/api/admin/baidu/oauth/callback`。
3. 管理端选择“百度网盘”。
4. 点击“开始授权”完成百度 OAuth。
5. 在“百度根目录”填写网盘目录（如 `/学习`），保存。
6. 点击“立即同步”。

### 本地目录（服务器本地）
1. 把视频按“分类/视频文件”的结构放到 `LOCAL_BASE_DIR`（默认 `/opt/kidvideo`）。
2. 管理端选择“本地目录”。
3. 在“本地目录设置”里填写子目录（`/` 代表根目录，`/英语` 代表子目录）并保存。
4. 点击“立即同步”。

说明：只能访问 `LOCAL_BASE_DIR` 之下的目录，超出范围会被拒绝。

### Windows 文件夹（无公网 IP）
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
5. 在管理端设置并保存：视频来源 = Windows 文件夹；Windows Base URL = `http://127.0.0.1:19080`；Windows Root Path 使用 `/` 风格路径（如 `/` 或 `/Kids`）；Windows Token = `yourtoken`。
6. 点击“立即同步”。

说明：Windows 服务默认仅本机访问，通过反向隧道让服务器访问。若要公网访问，请自行加防火墙与访问控制。

## 同步与数据行为
1. “立即同步”会读取当前来源的目录，按“一级目录=分类、二级文件=视频”生成或更新数据。
2. 同步只影响当前来源的数据，其他来源的数据仍保留在数据库中，但前台不会展示。
3. 如果删除或移动了文件，同步会把对应视频标记为删除；文件恢复后再次同步会恢复显示。
4. 切换来源后请重新同步，否则前台仍显示旧来源的数据。
5. 本地/Windows 来源以路径识别分类与视频，重命名会被视为新项；百度网盘以文件 ID 识别，改名不会影响同步关联。

## 启动
```
npm install
npm start
```
服务默认监听 `127.0.0.1:3000`。
如需公网访问，请使用 Nginx 反向代理（见下方配置示例）。

## 播放与缓存
1. 播放接口为 `/api/stream/:id`，支持拖动与分段请求。
2. 本地目录来源直接读取服务器磁盘文件。
3. Windows 来源通过 Windows 文件服务器流式读取。
4. 百度网盘来源使用 dlink 代理流式读取。
5. 缓存机制：启用缓存后，首次播放会后台写入 `CACHE_DIR`，命中缓存后直接从本地读取，播放更稳定。
6. 缓存采用“最近访问优先”，空间不足时会淘汰较旧的缓存文件。
7. 单个文件大于缓存上限时不会进入缓存。
8. `PREFETCH_NEXT=true` 会在播放时预取同分类的下一条视频。

## 本地源卡顿优化
- 本地源也支持缓存：首次播放会写入 `CACHE_DIR`，后续命中缓存会更稳定。
- 如果有 SSD，建议把 `CACHE_DIR` 指向 SSD，并保持 `CACHE_MAX_GB` 有足够空间。
- 机械盘上缓存收益有限，建议先做 faststart 或降码率。
- 使用 `tools/faststart.sh` 处理本地视频，让 mp4/moov 元数据前置，降低首播卡顿。

注意：faststart/转码会在同目录生成临时文件和备份，需预留足够空间（通常至少 1~2 倍文件大小）。

示例（就地处理并备份）：
```bash
tools/faststart.sh --root /opt/kidvideo --in-place --backup
```

faststart 处理完成后建议在管理端重新“同步”。

参数说明：
- `--root` 指定根目录
- `--in-place` 就地覆盖原文件
- `--backup` 保留 `.bak` 备份
- `--dry-run` 仅打印命令不执行

不使用 `--in-place` 时会在同目录生成 `*.faststart.ext` 文件，不会覆盖原文件。

## 降码率转码（推荐）
机械盘或网络盘建议把视频转成更低码率，减少随机读取压力。

单文件示例（输出 720p H.264 + AAC，适合大多数儿童视频）：
```bash
ffmpeg -i "input.mp4" -vf "scale=-2:720" -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 128k -movflags +faststart "output-720p.mp4"
```

批量示例（就地替换并备份）：
```bash
find /opt/kidvideo -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) -print0 | \
  while IFS= read -r -d '' file; do \
    dir="$(dirname "$file")"; base="$(basename "$file")"; ext="${base##*.}"; name="${base%.*}"; \
    out="${dir}/${name}.recode.${ext}"; \
    ffmpeg -nostdin -hide_banner -loglevel error -y -i "$file" -vf "scale=-2:720" \
      -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 128k -movflags +faststart "$out"; \
    mv "$file" "${file}.bak"; \
    mv "$out" "$file"; \
  done
```

建议转码后在管理端重新“同步”，以更新文件大小与缓存策略。

说明：转码非常耗时且占用 CPU，建议分批处理或在低峰期执行。

清理备份示例（确认无误后再执行）：
```bash
find /opt/kidvideo -type f -name '*.bak' -delete
```

## 日常维护
查看日志：
1. 管理端“操作日志”会显示最近 100 条操作记录。
2. 服务运行日志通常来自进程输出（例如使用 `nohup` 或 systemd）。

数据导出与清空：
1. 管理端“导出数据”可下载全量 JSON。
2. 管理端“清空进度”只会清空学习进度与统计，不会删除视频列表。
3. 也可以直接备份数据库文件 `DB_PATH`（建议在服务停止后复制）。

清理缓存（释放空间）：
1. 停止服务。
2. 删除 `CACHE_DIR` 下的文件。
3. 重启服务。旧的缓存记录会在下次播放时自动清理。

重启服务：
1. 使用 `install.sh` 安装的 systemd 服务可执行：`systemctl restart kids-video`。
2. 手动运行的进程可直接停止后重新 `npm start`。

## ffmpeg 安装（faststart 需要）
AlmaLinux / RHEL 9（示例）：
```bash
dnf -y install https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-9.noarch.rpm
crb enable
dnf -y install ffmpeg
```

Debian / Ubuntu（示例）：
```bash
apt-get update
apt-get install -y ffmpeg
```

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
`install.sh`（Debian/Ubuntu）会完成以下事情：
1. 安装系统依赖（nginx、sqlite3、build-essential 等）。
2. 安装 Node.js 20。
3. 创建运行用户 `kidsapp`，并把项目复制到 `/opt/kids-video-site`。
4. 初始化数据库并创建 systemd 服务 `kids-video`。

其他系统请手动安装 Node.js 20 与依赖，按以下步骤启动：
1. `npm install`
2. 配置 `.env`
3. `npm start`
