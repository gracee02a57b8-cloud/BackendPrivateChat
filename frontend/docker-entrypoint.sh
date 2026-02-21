#!/bin/sh
set -e

if [ -n "$DOMAIN" ] && [ -f /etc/nginx/nginx-ssl.template ]; then
  echo "[entrypoint] SSL mode: DOMAIN=$DOMAIN"
  envsubst '$DOMAIN' < /etc/nginx/nginx-ssl.template > /etc/nginx/conf.d/default.conf
  echo "[entrypoint] SSL config activated for $DOMAIN"
else
  echo "[entrypoint] Standard HTTP mode (no DOMAIN set)"
fi

exec nginx -g 'daemon off;'
