# BarsikChat

Real-time chat application with rooms, private messaging, file sharing, emoji picker, and news board.

## Architecture

```
├── backend/          # Spring Boot 3.3 (Java 21) — REST API + WebSocket
├── frontend/         # React 19 + Vite — SPA with nginx in production
├── docker-compose.yml
├── .env.example      # Environment variables template
└── .env              # Your local secrets (git-ignored)
```

## Quick Start with Docker

```bash
# 1. Copy env template and edit secrets
cp .env.example .env
# Edit .env — at minimum change JWT_SECRET

# 2. Build and run
docker compose up -d --build

# 3. Open in browser
# http://localhost
```

## Development (without Docker)

### Backend
```bash
cd backend
# Set JAVA_HOME to JDK 21
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
- 🗑️ Room deletion
- 👥 Online users & user search