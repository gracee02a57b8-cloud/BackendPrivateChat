# 🐱 BarsikChat

Защищённый мессенджер с **E2E-шифрованием (Signal Protocol)**, комнатами, личными сообщениями, файлами и новостной лентой.

![Java 21](https://img.shields.io/badge/Java-21-orange) ![Spring Boot 3.3.5](https://img.shields.io/badge/Spring%20Boot-3.3.5-green) ![React 19](https://img.shields.io/badge/React-19-blue) ![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

---

## 🔒 Безопасность

### E2E-шифрование (Signal Protocol)

| Компонент | Реализация |
|---|---|
| Согласование ключей | **X3DH** (Extended Triple Diffie-Hellman) |
| Шифрование сообщений | **Double Ratchet** с PFS на каждое сообщение |
| Кривая | ECDH P-256 + ECDSA P-256 |
| Симметричный шифр | **AES-256-GCM** (AEAD, 12-byte IV) |
| KDF | HKDF-SHA-256 |
| Шифрование файлов | AES-256-GCM (отдельный ключ на файл) |
| Хранение ключей | IndexedDB (клиентская сторона) |
| Верификация | Safety Number (24-значный код) |

- Сервер **не видит** содержимое зашифрованных сообщений (`content: null`)
- E2E включается **автоматически** во всех личных чатах
- 20 One-Time Pre-Keys с автоматическим пополнением

### Транспортная безопасность

- TLS 1.2 / 1.3 (ECDHE + AES-GCM, no session tickets)
- HSTS (2 года, preload-ready)
- Let's Encrypt с автообновлением (certbot)
- OCSP Stapling

### Заголовки безопасности

`Content-Security-Policy` · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy` · `Permissions-Policy` · Server tokens отключены

### Аутентификация

- Регистрация/вход по логину + паролю
- Пароли: **BCrypt** (cost 10)
- JWT (HMAC-SHA256, 24h TTL)
- Rate limiting: 10 запросов/мин на `/api/auth/*` (per-IP)
- WebSocket: JWT-валидация при подключении

---

## ✨ Возможности

### Чат
- 💬 Real-time WebSocket-чат
- 🔐 E2E-шифрование в личных чатах (Signal Protocol)
- 🏠 Комнаты: общий чат, приватные, пользовательские
- 🔗 Приглашения по ссылке
- ✏️ Редактирование и удаление сообщений
- ⏰ Отложенные сообщения
- 📊 Статусы доставки / прочтения
- 🟢 Индикатор онлайн
- ⌨️ Индикатор набора текста

### Файлы и медиа
- 📎 Файлы до 100 МБ (с E2E-шифрованием)
- 😊 Emoji Picker (160 эмодзи)
- 📰 Новостная лента с изображениями

### Управление
- ✅ Задачи (канбан-доска)
- 👥 Поиск пользователей
- 🗑️ Удаление комнат
- 📱 Адаптивный дизайн (мобильные + десктоп)

---

## 🏗️ Архитектура

```
├── backend/                  # Spring Boot 3.3.5 (Java 21)
│   ├── controller/           # 8 контроллеров (REST + WebSocket)
│   │   ├── AuthController        # Регистрация / логин
│   │   ├── ChatWebSocketHandler  # WebSocket чат
│   │   ├── KeyBundleController   # E2E ключи (X3DH)
│   │   ├── RoomController        # Управление комнатами
│   │   ├── FileController        # Загрузка файлов
│   │   ├── NewsController        # Новостная лента
│   │   └── TaskController        # Задачи
│   ├── service/              # 7 сервисов
│   ├── entity/               # 7 JPA-сущностей
│   ├── config/               # Security, WebSocket, CORS, ExceptionHandler
│   └── resources/
│       ├── application.yml
│       └── db/migration/     # Flyway (V1–V3)
├── frontend/                 # React 19 + Vite 7.3
│   ├── src/
│   │   ├── components/       # 13 React-компонентов
│   │   └── crypto/           # 6 модулей E2E-шифрования
│   │       ├── X3DH.js           # Key Agreement
│   │       ├── DoubleRatchet.js  # Forward Secrecy
│   │       ├── E2EManager.js     # Оркестратор
│   │       ├── KeyManager.js     # Управление ключами
│   │       ├── CryptoStore.js    # IndexedDB хранилище
│   │       └── utils.js          # Web Crypto API утилиты
│   ├── Dockerfile            # Multi-stage → nginx:alpine
│   ├── nginx.conf            # Reverse proxy (HTTP)
│   └── nginx-ssl.conf        # Reverse proxy (HTTPS + TLS)
├── docker-compose.yml        # Dev: PostgreSQL + Backend + Frontend
├── docker-compose.prod.yml   # Prod: + HTTPS + certbot
└── .env.example
```

---

## 🚀 Быстрый старт

### Docker (рекомендуется)

```bash
# 1. Настроить переменные окружения
cp .env.example .env
# Обязательно изменить: JWT_SECRET, DB_PASSWORD

# 2. Собрать и запустить
docker compose up -d --build

# 3. Открыть http://localhost
```

### Production (HTTPS)

```bash
# 1. Настроить .env (указать DOMAIN и CERTBOT_EMAIL)
# 2. Запустить с production-оверлеем
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. Получить сертификат (первый раз)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot -d yourdomain.com

# 4. Перезапустить frontend для применения сертификата
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

### Разработка (без Docker)

```bash
# PostgreSQL (через Docker или локально)
docker compose up -d postgres
# Или создать БД: barsikdb, user: barsik, password: barsik

# Backend (Java 21 required)
cd backend
mvn spring-boot:run
# → http://localhost:9001

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173 (proxy → backend)
```

---

## 🐳 Docker-сервисы

| Сервис | Образ | Порт | Описание | Ресурсы |
|---|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 (внутренний) | PostgreSQL с healthcheck | 512M / 1 CPU |
| `backend` | eclipse-temurin:21-jre-alpine | 9001 (внутренний) | Spring Boot API + WebSocket | 768M / 2 CPU |
| `frontend` | nginx:alpine | 80, 443 | React SPA + reverse proxy | 128M / 0.5 CPU |
| `certbot` | certbot/certbot | — | Let's Encrypt автообновление | Только prod |

```bash
# Логи
docker compose logs -f backend

# Перезапуск сервиса
docker compose restart backend

# Полный сброс (с удалением данных)
docker compose down -v
```

---

## ⚙️ Переменные окружения

### Backend

| Переменная | По умолчанию | Описание |
|---|---|---|
| `JWT_SECRET` | *(обязательно)* | Ключ подписи JWT (мин. 32 символа) |
| `JWT_EXPIRATION` | `86400000` | Время жизни токена, мс (24ч) |
| `SERVER_PORT` | `9001` | Порт backend |
| `DB_HOST` | `localhost` | Хост PostgreSQL (`barsik-db` в Docker) |
| `DB_PORT` | `5432` | Порт PostgreSQL |
| `DB_NAME` | `barsikdb` | Имя базы данных |
| `DB_USER` | `barsik` | Пользователь БД |
| `DB_PASSWORD` | `barsik` | Пароль БД |
| `MAX_FILE_SIZE` | `100MB` | Макс. размер файла |
| `UPLOAD_DIR` | `/app/uploads` | Директория загрузок |
| `CORS_ORIGINS` | `http://localhost:*` | Разрешённые CORS-источники |
| `DDL_AUTO` | `validate` | Hibernate DDL (`update` / `validate`) |
| `HIKARI_MAX_POOL` | `10` | Макс. соединений в пуле |
| `LOG_LEVEL` | `INFO` | Уровень логирования |

### Production (HTTPS)

| Переменная | Описание |
|---|---|
| `DOMAIN` | Домен для SSL-сертификата |
| `CERTBOT_EMAIL` | Email для Let's Encrypt |

---

## 🗄️ База данных

**Flyway** автоматически применяет миграции:

| Миграция | Описание |
|---|---|
| `V1__init_schema.sql` | users, messages, rooms, news, tasks |
| `V2__create_key_bundles.sql` | key_bundles + one_time_pre_keys (E2E) |
| `V3__add_encryption_fields.sql` | Поля шифрования в messages (9 колонок) |

---

## 🔌 API Endpoints

### Аутентификация
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |

### Чат
| Метод | Путь | Описание |
|---|---|---|
| WS | `/ws/chat?token=JWT` | WebSocket-подключение |
| GET | `/api/chat/users` | Список онлайн-пользователей |

### Комнаты
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/rooms` | Мои комнаты |
| POST | `/api/rooms/create` | Создать комнату |
| POST | `/api/rooms/private/{username}` | Создать личный чат |
| POST | `/api/rooms/join/{roomId}` | Войти в комнату |
| GET | `/api/rooms/{roomId}/history` | История сообщений |
| DELETE | `/api/rooms/{roomId}` | Удалить комнату |

### E2E ключи (Signal Protocol)
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/keys/bundle` | Загрузить Key Bundle |
| GET | `/api/keys/bundle/{username}` | Получить ключи пользователя |
| POST | `/api/keys/replenish` | Пополнить One-Time Pre-Keys |
| GET | `/api/keys/count` | Количество оставшихся OTK |
| GET | `/api/keys/has-bundle/{username}` | Есть ли E2E у пользователя |

### Файлы, новости, задачи
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/upload` | Загрузить файл |
| GET | `/api/uploads/{filename}` | Скачать файл |
| GET/POST | `/api/news` | Новостная лента |
| GET/POST/PUT | `/api/tasks` | Управление задачами |

---

## 🛠️ Стек технологий

### Backend
- **Java 21** + **Spring Boot 3.3.5**
- Spring Security + JWT (HMAC-SHA256)
- Spring WebSocket
- Spring Data JPA + Hibernate
- PostgreSQL 16 + Flyway
- BCrypt (password hashing)

### Frontend
- **React 19** + **Vite 7.3**
- Web Crypto API (ECDH, ECDSA, AES-GCM, HKDF, HMAC)
- IndexedDB (хранение ключей E2E)
- CSS (адаптивный дизайн)

### Инфраструктура
- **Docker** + Docker Compose
- **nginx** (reverse proxy + TLS termination)
- **Let's Encrypt** (certbot, автообновление)
- Flyway (миграции БД)

---

## 📐 Сравнение с Telegram

| Категория | BarsikChat | Telegram |
|---|---|---|
| Протокол E2E | ✅ Signal (X3DH + Double Ratchet) | ⚠️ MTProto 2.0 (кастомный) |
| E2E по умолчанию | ✅ Авто в личных | ❌ Ручной запуск |
| Forward Secrecy | ✅ Per-message | ⚠️ Per-session |
| Шифр | ✅ AES-256-GCM (AEAD) | ⚠️ AES-256-IGE |
| TLS | ✅ 1.2/1.3 стандарт | Кастомный транспорт |
| Сервер видит сообщения | ❌ Нет | ✅ Cloud Chats |

---

## 📄 Лицензия

MIT