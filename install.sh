#!/usr/bin/env bash
set -e

APP_DIR="/opt/kids-video-site"
APP_USER="kidsapp"

apt update
apt install -y curl git nginx sqlite3 build-essential

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR"

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
  cp -a "$SCRIPT_DIR"/. "$APP_DIR"/
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  cat <<ENV > "$APP_DIR/.env"
BAIDU_CLIENT_ID=
BAIDU_CLIENT_SECRET=
BAIDU_REDIRECT_URI=
ADMIN_USERNAME=admin
CACHE_MAX_GB=8
PREFETCH_NEXT=true
ENV
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
fi

su -s /bin/bash -c "cd $APP_DIR && npm install --omit=dev" "$APP_USER"

su -s /bin/bash -c "cd $APP_DIR && node -e \"require('./server/db/database')\"" "$APP_USER"

cat <<'SERVICE' > /etc/systemd/system/kids-video.service
[Unit]
Description=Kids Video Site
After=network.target

[Service]
User=kidsapp
WorkingDirectory=/opt/kids-video-site
ExecStart=/usr/bin/node server/app.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable kids-video
systemctl start kids-video

echo "Install complete. Configure Nginx to proxy to 127.0.0.1:3000"
