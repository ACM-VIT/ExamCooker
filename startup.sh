#!/bin/sh
set -eu

cd /home/site/wwwroot

export NODE_ENV="${NODE_ENV:-production}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-8080}"

if [ -f /home/site/wwwroot/server.js ]; then
  exec node /home/site/wwwroot/server.js
fi

if [ -f /home/site/wwwroot/.next/standalone/server.js ]; then
  exec node /home/site/wwwroot/.next/standalone/server.js
fi

echo "Could not find the standalone Next.js server entrypoint." >&2
exit 1
