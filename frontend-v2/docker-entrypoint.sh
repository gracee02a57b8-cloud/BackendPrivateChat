#!/bin/sh
set -e
echo "[entrypoint] BarsikChat v2 frontend starting..."
exec nginx -g 'daemon off;'
