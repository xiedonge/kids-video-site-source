#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-/tmp/kids-video-site.tar.gz}"
WORKDIR="/tmp/kids-video-site-update"
APP_DIR="/opt/kids-video-site"
APP_USER="kidsapp"

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

tar -xzf "$ARCHIVE" -C "$WORKDIR"

if [ ! -d "$WORKDIR/kids-video-site" ]; then
  echo "Archive missing kids-video-site directory" >&2
  exit 1
fi

rsync -a --delete \
  --exclude node_modules \
  --exclude data \
  --exclude .env \
  "$WORKDIR/kids-video-site/" "$APP_DIR/"

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

su -s /bin/bash -c "cd $APP_DIR && npm install --omit=dev" "$APP_USER"

systemctl restart kids-video

echo "Update complete."
