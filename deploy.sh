#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
npm run build

git add .
git ci -am 'save'
git push
scp -r dist/assets dist/releases root@47.86.47.55:/var/www/html/tape4fun/
scp -r dist/en dist/zh-cn root@47.86.47.55:/var/www/html/tape4fun/
scp dist/index.html root@47.86.47.55:/var/www/html/tape4fun/index.html
