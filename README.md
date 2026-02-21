# BarsikChat

Real-time chat application with rooms, private messaging, file sharing, emoji picker, and news board.

## Architecture

```
├── backend/           # Spring Boot 3.3 (Java 21) — REST API + WebSocket + JPA
│   ├── Dockerfile     # Multi-stage: Maven build → Alpine JRE runtime
│   ├── pom.xml
│   └── src/
├── frontend/          # React 19 + Vite — SPA with nginx in production
│   ├── Dockerfile     # Multi-stage: Node build → Nginx runtime
│   ├── nginx.conf     # Reverse proxy: /api/ & /ws/ → backend
│   └── src/
├── docker-compose.yml # PostgreSQL + Backend + Frontend
├── .env.example       # Environment variables template
└── .env               # Your local secrets (git-ignored)
```

## Quick Start with Docker

```bash
# 1. Copy env template and edit secrets
cp .env.example .env
# Edit .env — at minimum change JWT_SECRET and DB_PASSWORD

# 2. Build and run all services (postgres + backend + frontend)
docker compose up -d --build

# 3. Open in browser
# http://localhost
```

### Docker Services

| Service     | Image                      | Port  | Description                    |
|-------------|----------------------------|-------|--------------------------------|
| `postgres`  | postgres:16-alpine         | 5432  | PostgreSQL database            |
| `backend`   | eclipse-temurin:21-jre-alpine | 9001  | Spring Boot API + WebSocket |
| `frontend`  | nginx:alpine               | 80    | React SPA + reverse proxy      |

### Useful Docker Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f postgres

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove data volumes (full reset)
docker compose down -v
```

## Development (without Docker)

### PostgreSQL
```bash
# Option 1: Use Docker for DB only
docker compose up -d postgres

# Option 2: Local PostgreSQL
# Create database: barsikdb, user: barsik, password: barsik
```

### Backend
```bash
cd backend
# Set JAVA_HOME to JDK 21
# Set env vars: DB_HOST=localhost DB_PORT=5432 DB_NAME=barsikdb DB_USER=barsik DB_PASSWORD=barsik
mvn spring-boot:run
# Runs on http://localhost:9001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173 with proxy to backend
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(required)* | JWT signing key (min 32 chars) |
| `JWT_EXPIRATION` | `86400000` | Token expiry in ms (24h) |
| `SERVER_PORT` | `9001` | Backend port |
| `DB_HOST` | `localhost` | PostgreSQL host (Docker: `barsik-db`) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `barsikdb` | Database name |
| `DB_USER` | `barsik` | Database user |
| `DB_PASSWORD` | `barsik` | Database password |
| `MAX_FILE_SIZE` | `100MB` | Max upload file size |
| `MAX_REQUEST_SIZE` | `100MB` | Max HTTP request size |
| `UPLOAD_DIR` | `/app/uploads` | File upload directory |
| `CORS_ORIGINS` | `http://localhost:*` | Allowed CORS origins |
| `LOG_LEVEL` | `INFO` | Root log level |
| `APP_LOG_LEVEL` | `DEBUG` | Application log level |

## Features

- 🔐 JWT authentication
- 💬 Real-time WebSocket chat
- 🏠 Rooms (general, private, custom)
- 🔗 Join rooms by invite link
- 📎 File attachments (up to 100MB)
- 😊 Emoji picker (160 emojis)
- 📰 News board with images (up to 20MB)
- ✏️ Message edit & delete
- ⏰ Scheduled messages
- ✅ Task management (kanban)
- 📊 Read/delivery status
- 🟢 Online indicators
- ⌨️ Typing indicators
- 🗑️ Room deletion
- 👥 Online users & user search
- 🐘 PostgreSQL persistent storage