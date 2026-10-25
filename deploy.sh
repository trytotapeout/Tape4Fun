#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
npm run build

git add .
git ci -am 'save'
git push
scp -r dist/releases root@47.86.47.55:/var/www/html/tape4fun/
scp dist/index.html root@47.86.47.55:/var/www/html/tape4fun/index.html
