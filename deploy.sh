#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  BarsikChat — Zero-Downtime Deploy Script
#  Usage:  ./deploy.sh [frontend|backend|all]
# ═══════════════════════════════════════════════════════════
set -euo pipefail

SERVICE="${1:-frontend}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ─── Frontend: Blue-Green via docker rename ───
deploy_frontend() {
  log "🔨 Building new frontend image..."
  $COMPOSE build frontend

  OLD_ID=$(docker ps -q -f name=barsik-frontend 2>/dev/null || true)

  if [ -n "$OLD_ID" ]; then
    log "🔄 Renaming old container → barsik-frontend-old"
    docker rename barsik-frontend barsik-frontend-old 2>/dev/null || true

    log "🚀 Starting new frontend container..."
    $COMPOSE up -d --no-deps --no-build frontend

    # Wait for new container to be healthy
    log "⏳ Waiting for new container to be ready..."
    for i in $(seq 1 30); do
      if docker exec barsik-frontend nginx -t &>/dev/null 2>&1; then
        log "✅ New frontend is healthy!"
        break
      fi
      if [ "$i" -eq 30 ]; then
        err "❌ New container failed health check! Rolling back..."
        docker rm -f barsik-frontend 2>/dev/null || true
        docker rename barsik-frontend-old barsik-frontend
        docker start barsik-frontend
        exit 1
      fi
      sleep 1
    done

    log "🧹 Removing old container..."
    docker rm -f barsik-frontend-old 2>/dev/null || true
  else
    log "🚀 No existing container, starting fresh..."
    $COMPOSE up -d --no-deps frontend
  fi

  log "✅ Frontend deployed with zero downtime!"
}

# ─── Backend: Graceful restart (Spring Boot shutdown) ───
deploy_backend() {
  log "🔨 Building new backend image..."
  $COMPOSE build backend

  OLD_ID=$(docker ps -q -f name=barsik-backend 2>/dev/null || true)

  if [ -n "$OLD_ID" ]; then
    log "🔄 Renaming old container → barsik-backend-old"
    docker rename barsik-backend barsik-backend-old 2>/dev/null || true

    log "🚀 Starting new backend container..."
    $COMPOSE up -d --no-deps --no-build backend

    # Wait for Spring Boot to be healthy
    log "⏳ Waiting for backend health check..."
    for i in $(seq 1 120); do
      HTTP_CODE=$(docker exec barsik-frontend curl -s -o /dev/null -w "%{http_code}" http://backend:9001/actuator/health 2>/dev/null || echo "000")
      if [ "$HTTP_CODE" = "200" ]; then
        log "✅ New backend is healthy!"
        break
      fi
      if [ "$i" -eq 120 ]; then
        err "❌ Backend failed health check! Rolling back..."
        docker rm -f barsik-backend 2>/dev/null || true
        docker rename barsik-backend-old barsik-backend
        docker start barsik-backend
        exit 1
      fi
      sleep 2
    done

    log "🧹 Removing old backend container..."
    docker rm -f barsik-backend-old 2>/dev/null || true
  else
    log "🚀 Starting fresh backend..."
    $COMPOSE up -d --no-deps backend
  fi

  log "✅ Backend deployed with zero downtime!"
}

# ─── Main ───
cd "$(dirname "$0")"
log "Starting zero-downtime deploy: $SERVICE"

case "$SERVICE" in
  frontend)
    git pull origin main
    deploy_frontend
    ;;
  backend)
    git pull origin main
    deploy_backend
    ;;
  all)
    git pull origin main
    deploy_backend
    deploy_frontend
    ;;
  *)
    err "Usage: $0 [frontend|backend|all]"
    exit 1
    ;;
esac

# Clean up dangling images
docker image prune -f &>/dev/null || true
log "🎉 Deploy complete!"
