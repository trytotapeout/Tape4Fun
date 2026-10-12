#!/bin/bash

git add .
git ci -am 'save'
git push
scp -r * root@47.86.47.55:/var/www/html/tape4fun/
