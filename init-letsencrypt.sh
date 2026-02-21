#!/bin/bash
# init-letsencrypt.sh — Obtain initial Let's Encrypt certificate
# Usage: chmod +x init-letsencrypt.sh && ./init-letsencrypt.sh
#
# Make sure .env has DOMAIN and CERTBOT_EMAIL set first.

set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DOMAIN=${DOMAIN:?Please set DOMAIN in .env}
EMAIL=${CERTBOT_EMAIL:?Please set CERTBOT_EMAIL in .env}
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Requesting certificate for: $DOMAIN"
echo "==> Email: $EMAIL"

# Start nginx to serve ACME challenge
$COMPOSE up -d frontend

# Request certificate
$COMPOSE run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "==> Certificate obtained! Restarting services..."

# Restart all services to pick up certs
$COMPOSE down
$COMPOSE up -d

echo "==> Done! Site is live at https://$DOMAIN"
