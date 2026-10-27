#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
npm run build:web

git add .
if ! git diff --cached --quiet; then
    git commit -m 'save'
fi
git push
scp -r dist/web/assets root@47.86.47.55:/var/www/html/tape4fun/
scp -r dist/web/en dist/web/zh-cn root@47.86.47.55:/var/www/html/tape4fun/
scp dist/web/index.html root@47.86.47.55:/var/www/html/tape4fun/index.html
scp config/nginx-entry.conf root@47.86.47.55:/etc/nginx/snippets/tape4fun-entry.conf
ssh root@47.86.47.55 'nginx -t && systemctl reload nginx'
