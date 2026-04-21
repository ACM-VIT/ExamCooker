#!/bin/sh
set -eu

if [ ! -x /node_modules/.bin/next ] && [ -f /home/site/wwwroot/node_modules.tar.gz ]; then
  rm -rf /node_modules
  mkdir -p /node_modules
  tar -xzf /home/site/wwwroot/node_modules.tar.gz -C /node_modules
fi

export NODE_PATH=/node_modules:/usr/local/lib/node_modules:${NODE_PATH:-}
export PATH=/node_modules/.bin:${PATH}:/home/site/wwwroot

cd /home/site/wwwroot
npm run start
