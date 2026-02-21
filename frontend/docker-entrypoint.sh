#!/bin/sh
set -e

# If DOMAIN is set, process the SSL template
if [ -n "$DOMAIN" ] && [ -f /etc/nginx/nginx-ssl.template ]; then
  echo "[entrypoint] SSL mode: substituting DOMAIN=$DOMAIN"
  envsubst '$DOMAIN' < /etc/nginx/nginx-ssl.template > /etc/nginx/conf.d/default.conf
else
  echo "[entrypoint] Standard HTTP mode"
fi

exec nginx -g 'daemon off;'
