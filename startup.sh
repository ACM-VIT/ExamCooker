#!/bin/sh
set -eu

cd /home/site/wwwroot

if [ -d /home/site/wwwroot/node_modules ]; then
  NODE_MODULES_PATH=/home/site/wwwroot/node_modules
elif [ -d /node_modules ]; then
  NODE_MODULES_PATH=/node_modules
elif [ -f /home/site/wwwroot/node_modules.tar.gz ]; then
  rm -rf /node_modules
  mkdir -p /node_modules
  tar -xzf /home/site/wwwroot/node_modules.tar.gz -C /node_modules
  NODE_MODULES_PATH=/node_modules
else
  echo "Could not find node_modules in /home/site/wwwroot or /node_modules." >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"
export NODE_PATH="${NODE_MODULES_PATH}:/usr/local/lib/node_modules:${NODE_PATH:-}"
export PATH="${NODE_MODULES_PATH}/.bin:${PATH}:/home/site/wwwroot"

if [ -x "${NODE_MODULES_PATH}/.bin/next" ]; then
  exec "${NODE_MODULES_PATH}/.bin/next" start
fi

if [ -f "${NODE_MODULES_PATH}/next/dist/bin/next" ]; then
  exec node "${NODE_MODULES_PATH}/next/dist/bin/next" start
fi

echo "Could not find the Next.js runtime in ${NODE_MODULES_PATH}." >&2
exit 1
