# 🔍 BarsikChat Backend — Comprehensive Code Audit Report

**Дата:** Июль 2025  
**Версия:** 2.0 (полный аудит каждого файла)  
**Стек:** Spring Boot 3.3.5 (Java 21) + PostgreSQL  
**Scope:** Все Java-файлы, конфигурация, Docker, SQL-миграции

---

## Содержание

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Структура проекта](#3-структура-проекта)
4. [Файл-по-файлу: Configuration Layer](#4-configuration-layer)
5. [Файл-по-файлу: Controller Layer](#5-controller-layer)
6. [Файл-по-файлу: Service Layer](#6-service-layer)
7. [Файл-по-файлу: Entity Layer](#7-entity-layer)
8. [Файл-по-файлу: Repository Layer](#8-repository-layer)
9. [Файл-по-файлу: DTO Layer](#9-dto-layer)
10. [Infrastructure (Docker, SQL, Tests)](#10-infrastructure)
11. [🔴 CRITICAL Security Issues](#11-critical-security-issues)
12. [🟠 Security Concerns](#12-security-concerns)
13. [🟡 Performance Issues](#13-performance-issues)
14. [🔵 Architecture & Design Issues](#14-architecture-design-issues)
15. [⚪ Code Quality & Maintainability](#15-code-quality)
16. [Testing Gaps](#16-testing-gaps)
17. [Scalability Concerns](#17-scalability-concerns)
18. [Приоритизированные рекомендации](#18-приоритизированные-рекомендации)
19. [Предыдущий аудит (v1.0.4)](#19-предыдущий-аудит-v104)

---

## 1. Executive Summary

BarsikChat backend — **монолитное** Spring Boot 3.3.5 приложение для real-time чата с WebSocket-сообщениями, WebRTC-звонками, stories, polls, tasks, news, push-уведомлениями и admin-панелью. Кодовая база включает **88 Java-файлов**, **22 Flyway-миграции**, Docker/Nginx-инфраструктуру.

### Ключевые метрики
| Метрика | Значение |
|---------|----------|
| Java-файлов (main) | 88 |
| Controllers | 18 |
| Services | 17 |
| Entities | 19 |
| Repositories | 18 |
| DTOs | 9 (+inner classes) |
| Миграций | 22 (V1–V22) |
| Крупнейший файл | `ChatWebSocketHandler.java` — **1 319 строк** |
| Примерно строк Java | ~7 500 |

### Severity Tally
| Severity | Кол-во |
|----------|--------|
| 🔴 Critical | 3 |
| 🟠 High | 8 |
| 🟡 Medium | 14 |
| 🔵 Low / Design | 12 |
| ⚪ Code quality | 10+ |

---

## 2. Technology Stack

| Компонент | Версия / Детали |
|-----------|-----------------|
| Java | 21 (Temurin) |
| Spring Boot | 3.3.5 |
| Spring Security | Stateless JWT, BCrypt |
| WebSocket | Raw `TextWebSocketHandler` (НЕ STOMP) |
| JPA / Hibernate | via Spring Data JPA |
| Database | PostgreSQL (prod), H2 (test) |
| Migrations | Flyway |
| JWT | `io.jsonwebtoken:jjwt` 0.11.5 |
| Connection pool | HikariCP (max 10, min 2, leak detection 30s) |
| Build | Maven, Docker multi-stage (JDK → JRE Alpine) |
| Web Push | Кастомная RFC 8291/VAPID реализация (без библиотеки) |
| Observability | Spring Actuator (`/health` only) |

---

## 3. Структура проекта

```
com.example.webrtcchat
├── WebrtcChatBackendApplication.java   (main)
├── config/
│   ├── SecurityConfig.java
│   ├── WebSocketConfig.java
│   ├── GlobalExceptionHandler.java
│   └── AdminUserInitializer.java
├── controller/    (18 контроллеров)
├── service/       (17 сервисов)
├── entity/        (19 сущностей)
├── repository/    (18 репозиториев)
├── dto/           (9 DTO)
└── types/
    ├── MessageType.java
    └── RoomType.java
```

---

## 4. Configuration Layer

---

### `config/SecurityConfig.java`
**Назначение:** Spring Security filter chain, CORS, rate limiting, JWT-аутентификация.

**Что делает:**
- Отключает CSRF (корректно для stateless JWT API).
- `permitAll` для `/api/auth/**`, `/ws/**`, actuator health; `/api/admin/**` → `hasRole('ADMIN')`.
- In-memory `ConcurrentHashMap` rate limiter (10 req/min per IP на auth-эндпоинтах).
- Inline `OncePerRequestFilter` для JWT extraction → `UsernamePasswordAuthenticationToken`.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **Rate limiter memory leak** — `requestCounts` растёт бесконтрольно; cleanup при `size > 1000` с race condition. Под DDoS от вращающихся IP → OOM. |
| 2 | 🟡 Medium | **Rate limit только на `/api/auth/**`** — файл-аплоад, создание комнат, отправка сообщений — без ограничений. |
| 3 | 🟡 Medium | **Нет token blacklist / revocation** — JWT нельзя отозвать (logout, смена пароля, бан). |
| 4 | 🔵 Low | `/ws/**` → `permitAll`; аутентификация проверяется позже в `ChatWebSocketHandler.afterConnectionEstablished()`, но соединение уже установлено. |

**Рекомендации:** Bucket4j или Redis-based rate limiter; rate limit на upload/room/message; token blacklist через Redis или refresh tokens.

---

### `config/WebSocketConfig.java`
**Назначение:** Регистрация WebSocket-эндпоинта `/ws/chat`.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **`setAllowedOrigins("*")`** — любой origin может открыть WS-соединение → Cross-Site WebSocket Hijacking (CSWSH). |
| 2 | 🟡 Medium | 64 KB text buffer — мало для сообщений с Base64-thumbnails. |

**Рекомендация:** Ограничить origins реальными доменами.

---

### `config/GlobalExceptionHandler.java`
**Назначение:** `@RestControllerAdvice` — перехват и форматирование ошибок.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | ⚪ Info | Русские сообщения об ошибках — не i18n-ready. |
| 2 | ⚪ Info | Нет обработчиков для `AccessDeniedException`, `AuthenticationException`. |

---

### `config/AdminUserInitializer.java`
**Назначение:** `ApplicationRunner` — создаёт/сбрасывает admin-пользователя при каждом старте.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔴 **CRITICAL** | **Хардкод пароля** `"BarsikAdmin2026!"` в исходном коде. Любой с доступом к репо знает пароль админа. Пароль **сбрасывается** на каждом перезапуске. |
| 2 | 🟠 High | Admin-пароль перезаписывается при рестарте — смена через UI бесполезна. |

**Рекомендация:** Пароль из env-переменной `ADMIN_PASSWORD`. Создавать admin только если не существует, НИКОГДА не перезаписывать.

---

## 5. Controller Layer

---

### `controller/AuthController.java`
**Назначение:** `/api/auth/register`, `/api/auth/login`.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Ручная валидация** (if/else) — нет `@Valid`/`@NotBlank`. |
| 2 | 🟡 Medium | **User enumeration** — разные ошибки для "user not found" vs "wrong password". |
| 3 | 🟡 Medium | Нет CAPTCHA/email-верификации при регистрации. |
| 4 | 🔵 Low | `UserDto` содержит поле `password` — без `@JsonIgnore` и без отдельного DTO. |

---

### `controller/ChatWebSocketHandler.java` (1 319 строк)
**Назначение:** ЦЕНТРАЛЬНЫЙ ХАБ всего real-time — чат, typing, звонки, конференции, reactions, polls, pins, edits, deletes, scheduled messages, stories, group invites, presence.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔴 **CRITICAL** | **God class — 1 319 строк, 30+ типов сообщений** — нарушение SRP. Нетестируемо, неподдерживаемо. |
| 2 | 🟠 High | **Всё состояние in-memory** (`ConcurrentHashMap`) — `userSessions`, `callOffers`, `activeCallParticipants`, `blockedPairs`. Рестарт = потеря всех активных звонков и сессий. |
| 3 | 🟠 High | **Нет валидации WS-сообщений** — malformed JSON → NullPointerException или abuse. |
| 4 | 🟠 High | **Нет rate limiting на WS** — клиент может флудить тысячами сообщений/сек. |
| 5 | 🟡 Medium | `blockedPairs` загружается один раз при подключении — не обновляется при добавлении/удалении блока. |
| 6 | 🟡 Medium | Push-отправка синхронна в `sendToUser()` — блокирует WS-поток. |
| 7 | 🟡 Medium | Scheduled messages в `SchedulerService` (in-memory) — теряются при рестарте. |
| 8 | 🔵 Low | JWT в URL query param — попадает в логи, browser history. |

**Рекомендации:** Декомпозиция: `ChatMessageHandler`, `CallSignalingHandler`, `ConferenceHandler`, `PollHandler`, `ReactionHandler`. Диспетчер-паттерн. Redis для state. Per-user WS rate limiting.

---

### `controller/RoomController.java` (372 строки)
**Назначение:** CRUD комнат, история, поиск, mute, disappearing messages, link preview, media stats.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Нет проверки авторизации** — любой аутентифицированный пользователь может читать историю ЛЮБОЙ комнаты. |
| 2 | 🟡 Medium | Pagination по string-timestamp — хрупко. |

---

### `controller/FileController.java`
**Назначение:** Загрузка файлов/изображений.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **Content-type по расширению** — .jpg с HTML/SVG payload будет отдан как image. Нет проверки magic bytes. |
| 2 | 🟡 Medium | Path traversal check неполный (не проверяет URL-encoded варианты). UUID-rename смягчает. |
| 3 | 🟡 Medium | Нет virus/malware scanning. |
| 4 | 🔵 Low | Дублирование `getExtension()`/`detectContentType()` с `ProfileController`. |

---

### `controller/ContactBlockController.java` (214 строк)
**Назначение:** Контакты и блокировки.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **Manual JWT extraction** из `Authorization` header — обходит Spring Security context. |
| 2 | 🟡 Medium | `getUserProfile` — отдаёт данные без проверки блокировки. |
| 3 | ⚪ Info | `addContact` не проверяет существование target user. |

---

### `controller/ProfileController.java`
**Назначение:** Профиль пользователя, аватар.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | Дублирование file-utility кода с `FileController`. |

---

### `controller/WebRtcController.java`
**Назначение:** Генерация TURN-credentials (HMAC-SHA1, 24h TTL).

✅ **Чистая реализация**, одна из лучших в проекте. Следует стандартному coturn-паттерну.

---

### `controller/TaskController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Нет авторизации** — любой может создать/удалить task в любой комнате. |
| 2 | 🔵 Low | Task status — свободная строка, а не enum. |

---

### `controller/NewsController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | Push ВСЕМ подписчикам на каждую новость — нет opt-in/opt-out. |
| 2 | 🔵 Low | Нет пагинации комментариев. |

---

### `controller/StoryController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | Max 5 stories — hardcoded. |
| 2 | ⚪ Info | `groupByAuthor` → `Map` без гарантии порядка. |

---

### `controller/PollController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | Нет проверки membership в комнате при голосовании. |

---

### `controller/PushController.java`
✅ Чисто, без замечаний.

---

### `controller/ReactionController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | N+1 в `getReactionsForMessages` — см. Service layer. |

---

### `controller/CallLogController.java`
✅ Чисто. Использует `Pageable`.

---

### `controller/ConferenceController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | Всё состояние in-memory — теряется при рестарте. |

---

### `controller/ChatFolderController.java`
✅ Чисто. Max 20 folders.

---

### `controller/ChatController.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **`/api/chat/history` отдаёт ВСЕ сообщения** из БД без фильтра по комнате и без пагинации — утечка данных + performance bomb. |
| 2 | 🟡 Medium | Online users endpoint показывает всех подключённых пользователей. |

---

### `controller/AdminController.java`
✅ Чисто. Защищён `hasRole('ADMIN')`.

---

## 6. Service Layer

---

### `service/ChatService.java`
**Назначение:** Сообщения, пользователи, online-tracking.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **`getAllUsers()` загружает ВСЮ таблицу** — без пагинации. |
| 2 | 🟡 Medium | Online-tracking in-memory — не шарится между инстансами. |
| 3 | 🔵 Low | Timestamps как `String` (`Instant.now().toString()` → VARCHAR). |

---

### `service/JwtService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Deprecated API** — `SignatureAlgorithm.HS256` (jjwt 0.11.x). |
| 2 | 🟡 Medium | Единый signing key без ротации. |
| 3 | 🔵 Low | `extractRole()` молча возвращает `"USER"` при любой ошибке. |

---

### `service/RoomService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Нет лимита участников** — группы без ограничения → broadcast storms. |
| 2 | 🔵 Low | Private room ID содержит usernames → утечка информации. |

---

### `service/ConferenceService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **Всё в памяти** — конференции теряются при рестарте. |
| 2 | 🟡 Medium | Нет cleanup для orphaned conferences. |

---

### `service/SchedulerService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **In-memory scheduling** — scheduled messages теряются при рестарте. |
| 2 | 🔵 Low | Всего 2 потока — bottleneck при нагрузке. |

---

### `service/WebPushService.java` (397 строк)
**Назначение:** Web Push (RFC 8291 + VAPID) — кастомная реализация без библиотеки.

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Кастомная криптография** — RFC-compliant, но одна ошибка в ECDH/HKDF/AES-GCM pipeline → всё ломается. Рассмотреть `web-push` библиотеку. |
| 2 | 🔵 Low | Push executor 4 потока — достаточно для текущего масштаба. |

---

### `service/LinkPreviewService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔴 **CRITICAL** | **SSRF уязвимость** — `fetchPreview(url)` принимает любой URL без валидации. Можно обратиться к `http://169.254.169.254/latest/meta-data/` (AWS), `http://localhost:8080/api/admin/stats`, `http://10.0.0.1/internal-api`. |
| 2 | 🟡 Medium | **Unbounded cache** — `ConcurrentHashMap` растёт без ограничений. |
| 3 | 🔵 Low | Нет лимита redirect-ов — SSRF через redirect chains. |

**Рекомендация:** НЕМЕДЛЕННО: блокировать private IP (10.x, 172.16-31.x, 192.168.x, 169.254.x, 127.x), проверять resolved IP, Caffeine cache с max size + TTL.

---

### `service/StoryService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | Удаление файла при истечении story — если файл используется ещё где-то → dangling reference. |

---

### `service/PollService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | `@OneToMany(EAGER)` для options — обычно OK для polls. |

---

### `service/ReactionService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **N+1 query** — `getReactionsForMessages` цикл по message IDs, отдельный запрос на каждый. Нужен `findByMessageIdIn()`. |

---

### `service/ReadReceiptService.java`
✅ Чисто.

---

### `service/RoomMuteService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | String-based сравнение timestamps для mute expiry. |

---

### `service/DisappearingMessageScheduler.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | String-based timestamp comparison в `@Query`. |
| 2 | 🔵 Low | Broadcast отдельных DELETE для каждого сообщения — не batch. |

---

### `service/TaskService.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | Hardcoded timezone `"Europe/Moscow"`. |

---

### `service/AdminService.java`, `NewsService.java`, `ChatFolderService.java`
✅ Чисто, без серьёзных замечаний.

---

## 7. Entity Layer

---

### `entity/UserEntity.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **`password` без `@JsonIgnore`** — при случайной сериализации (лог, ошибка) утекает BCrypt hash. |
| 2 | 🔵 Low | `lastSeen`, `createdAt` — String вместо `Instant`/`LocalDateTime`. |

---

### `entity/RoomEntity.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **`@ElementCollection(fetch = EAGER)` для `members`** — КАЖДАЯ загрузка RoomEntity → отдельный SELECT для всех members. Для комнат с сотнями участников — disaster. |
| 2 | 🟡 Medium | `CopyOnWriteArraySet<String> members` — тяжело для JPA, каждая модификация создаёт копию. |

---

### `entity/MessageEntity.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Денормализация** — `senderDisplayName`, `senderAvatarUrl` per message. При смене профиля — stale data в старых сообщениях. |
| 2 | 🟡 Medium | `mentions` — JSON string в TEXT колонке, нет DB-level querying. |
| 3 | 🔵 Low | `timestamp` — String. |

---

### `entity/TaskEntity.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | `status` — String, `deadline` — String. Должны быть enum и temporal type. |

---

### `entity/PollEntity.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | `@OneToMany(fetch = EAGER)` для options. |

---

### Остальные entities:
`ContactEntity`, `BlockedUserEntity`, `CallLogEntity`, `PollOptionEntity`, `PollVoteEntity`, `ReactionEntity`, `ReadReceiptEntity`, `RoomMuteEntity`, `ChatFolderEntity`, `NewsEntity`, `NewsCommentEntity`, `StoryEntity`, `StoryViewEntity`, `PushSubscriptionEntity` — **без критических замечаний**.

---

## 8. Repository Layer

Все repositories — стандартные `JpaRepository`. Highlights:

### `repository/MessageRepository.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Search через `LIKE %query%`** — не может использовать B-tree index → full scan. V22 добавляет pg_trgm GIN, но JPA query использует `LIKE`, а не trgm операторы. |

### `repository/RoomRepository.java`
- `SELECT r FROM RoomEntity r WHERE :member MEMBER OF r.members` — subquery к element collection.

Остальные 16 репозиториев — стандартные, без критических проблем.

---

## 9. DTO Layer

---

### `dto/UserDto.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Содержит поле `password`** — DTO не должен переносить пароли. Нужен отдельный `RegisterRequest`. |
| 2 | 🔵 Low | 5 конструкторов (telescoping pattern). |

### `dto/AuthResponse.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | **6 telescoping конструкторов** — хрупко. Builder pattern. |

### `dto/RoomDto.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | `CopyOnWriteArraySet<String> members` — overkill для DTO. |

### `dto/MessageDto.java`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🔵 Low | **Java 21 доступна** — `record` типы для immutable DTOs. |
| 2 | 🔵 Low | Нет `@NotBlank`/`@Size`/`@Valid` annotations. |

### Остальные DTOs:
`TaskDto`, `NewsDto`, `NewsCommentDto`, `StoryDto`, `AdminStatsDto` — чистые, без серьёзных замечаний.

---

## 10. Infrastructure

---

### `pom.xml`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **jjwt 0.11.5 устарел** — Latest 0.12.6. Deprecated API. |
| 2 | 🔵 Low | Lombok dependency объявлена, но не используется — удалить. |

### `application.yml`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **`max-pool-size: 10`** — может быть мало при WS + REST нагрузке. |
| 2 | ⚪ Info | `logging.level.org.hibernate.SQL: DEBUG` — убрать в production. |
| 3 | ✅ Good | `open-in-view: false` — корректно. |
| 4 | ✅ Good | `ddl-auto: validate` — полагается на Flyway. |

### `Dockerfile`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | ⚪ Info | Нет `HEALTHCHECK`. |
| 2 | 🔵 Low | Нет JVM memory flags (`-Xmx`, `-XX:MaxRAMPercentage`). |
| 3 | ✅ Good | Non-root user `appuser`. Multi-stage build. |

### `docker-compose.yml`
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟠 High | **`DDL_AUTO: update`** — опасно если случайно используется в production. |
| 2 | 🟡 Medium | PostgreSQL пароль plaintext в compose файле. |

### SQL Migrations (V1–V22)

| Migration | Назначение | Заметки |
|-----------|------------|---------|
| V1 | Init schema | VARCHAR(30) для timestamps |
| V2 | E2E key bundles | ❌ Удалено в V21 |
| V3 | E2E message fields | ❌ Удалено в V21 |
| V4 | Reply-to, mentions | |
| V5 | User role | |
| V6 | Last seen | |
| V7 | Voice fields | |
| V8 | Video circle | |
| V9 | Avatar URL | |
| V10 | Group encrypted | ❌ Удалено в V21 |
| V11 | Profile fields | |
| V12 | Call logs | |
| V13 | Room description/avatar | |
| V14 | Push subscriptions | |
| V15 | Contacts & blocks | |
| V16 | Stories | |
| V17 | User tag (unique) | |
| V18 | Pinned messages | |
| V19 | Reactions, polls, folders, mutes, receipts, disappearing | **Крупнейшая** |
| V20 | disappears_at + partial index | |
| V21 | Drop E2E tables & columns | Cleanup V2/V3/V10 |
| V22 | Missing indexes + pg_trgm GIN | |

| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **Dead migrations** — V2/V3/V10 создают то, что V21 удаляет. На свежих установках — бесполезная работа. |
| 2 | 🟡 Medium | **VARCHAR timestamps** — V1 использует `VARCHAR(30)` для дат. Не позволяет DB-level temporal операции. |
| 3 | 🔵 Low | Нет foreign key между `messages` и `rooms` — orphaned messages возможны. |

### Test Config (`application-test.yml`)
| # | Severity | Проблема |
|---|----------|----------|
| 1 | 🟡 Medium | **H2 vs PostgreSQL** — SQL-различия (pg_trgm, ILIKE) не тестируются. Нужен Testcontainers. |
| 2 | 🟡 Medium | **Flyway отключён** — миграции не тестируются. Schema drift возможен. |

---

## 11. 🔴 CRITICAL Security Issues

### CRIT-1: Hardcoded Admin Password
- **Файл:** `config/AdminUserInitializer.java`
- **Пароль:** `"BarsikAdmin2026!"` — в source code, в Git
- **Усугубление:** Пароль **сбрасывается** при каждом рестарте
- **Impact:** Любой с доступом к репо → admin access
- **Fix:** Env variable `ADMIN_PASSWORD`. Создавать ТОЛЬКО если не существует.

### CRIT-2: SSRF в Link Preview
- **Файл:** `service/LinkPreviewService.java`
- **Проблема:** `fetchPreview(url)` → HTTP request к любому URL пользователя
- **Exploits:** `http://169.254.169.254/`, `http://localhost:8080/api/admin/stats`, `http://10.0.0.1/internal`
- **Impact:** Information disclosure, internal service scanning, potential RCE
- **Fix:** Block private IPs, validate scheme, resolve DNS before connecting

### CRIT-3: God Class WebSocket Handler
- **Файл:** `controller/ChatWebSocketHandler.java` (1 319 строк)
- **30+ типов сообщений** в одном классе
- **Impact:** Невозможно безопасно вносить изменения, тестировать, ревьюить
- **Fix:** Декомпозиция с dispatcher pattern

---

## 12. 🟠 Security Concerns

| ID | Проблема | Файл | Fix |
|----|----------|------|-----|
| SEC-1 | WebSocket `*` origin | `WebSocketConfig.java` | Restrict to prod domains |
| SEC-2 | No JWT revocation | `SecurityConfig`, `JwtService` | Redis blacklist / refresh tokens |
| SEC-3 | Rate limiter unbounded + racy | `SecurityConfig.java` | Bucket4j / Redis |
| SEC-4 | Manual JWT extraction | `ContactBlockController.java` | `Principal` / `@AuthenticationPrincipal` |
| SEC-5 | No file content validation | `FileController.java` | Validate magic bytes |
| SEC-6 | No room authorization | `RoomController.java` | Check membership |
| SEC-7 | Global history endpoint | `ChatController.java` | Remove / restrict |
| SEC-8 | User enumeration | `AuthController.java` | Generic "Invalid credentials" |

---

## 13. 🟡 Performance Issues

| ID | Проблема | Файл | Fix |
|----|----------|------|-----|
| PERF-1 | `@ElementCollection(EAGER)` на members | `RoomEntity.java` | `LAZY` или join entity |
| PERF-2 | N+1 в ReactionService | `ReactionService.java` | `findByMessageIdIn()` |
| PERF-3 | `getAllUsers()` без пагинации | `ChatService.java` | `Pageable` |
| PERF-4 | LinkPreview cache unbounded | `LinkPreviewService.java` | Caffeine + TTL |
| PERF-5 | `LIKE %query%` search | `MessageRepository.java` | pg_trgm / full-text search |
| PERF-6 | String timestamps | Все entities | Migrate to TIMESTAMP/Instant |
| PERF-7 | HikariCP max 10 | `application.yml` | Monitor & tune |
| PERF-8 | 5× `getRoomById()` per message | `ChatWebSocketHandler.java` | Cache room per message |
| PERF-9 | N+1 в `getContacts()` | `ContactBlockController.java` | Batch query `findByUsernameIn()` |

---

## 14. 🔵 Architecture & Design Issues

| ID | Проблема | Описание |
|----|----------|----------|
| ARCH-1 | All state in-memory | Sessions, conferences, calls, scheduled msgs — lost on restart, no horizontal scaling |
| ARCH-2 | String timestamps | 19 entities use VARCHAR(30) for dates |
| ARCH-3 | No DTO validation | Zero `@Valid` / `@NotBlank` annotations |
| ARCH-4 | Monolithic WS handler | 1 319 lines in one class |
| ARCH-5 | Mixed auth patterns | Some controllers use `Principal`, others manually parse JWT |
| ARCH-6 | No domain events | Direct service coupling + WS broadcasts |
| ARCH-7 | Denormalised sender info | `senderDisplayName`, `senderAvatarUrl` per message — stale on profile update |
| ARCH-8 | Dead E2E migrations | V2/V3/V10 create → V21 drops |

---

## 15. ⚪ Code Quality

| ID | Проблема | Файл(ы) |
|----|----------|---------|
| CQ-1 | Telescoping constructors (5–6) | `AuthResponse`, `UserDto` |
| CQ-2 | Duplicate `getExtension()`/`detectContentType()` | `FileController`, `ProfileController` |
| CQ-3 | No Lombok or records for DTOs | All DTOs — verbose POJOs |
| CQ-4 | `CopyOnWriteArraySet` in DTOs | `RoomDto` |
| CQ-5 | String task status | `TaskEntity` |
| CQ-6 | Hardcoded "Europe/Moscow" | `TaskService` |
| CQ-7 | `password` field in UserDto | Leak risk |
| CQ-8 | Russian error messages hardcoded | `GlobalExceptionHandler` |
| CQ-9 | `extractRole()` silent fallback | `JwtService` |
| CQ-10 | Package `com.example.webrtcchat` | Default — rename to org/company |

---

## 16. Testing Gaps

- **H2 vs PostgreSQL** — SQL-специфика production не тестируется
- **Flyway отключён в тестах** — миграции не покрыты
- **ChatWebSocketHandler** — god class практически нетестируем
- **Нет integration tests с реальной БД** — Testcontainers решит
- **Нет load/stress tests** (кроме ручного `ultimate-load-test.js`)
- **Нет security testing** (OWASP ZAP, dependency scanning)

---

## 17. Scalability Concerns

| Concern | Детали | Решение |
|---------|--------|---------|
| Horizontal scaling невозможно | In-memory state | Redis |
| DB bottleneck | 10 connections, no read replicas, no cache | Redis cache, increase pool, read replica |
| WS single-node | All connections on one server | Redis Pub/Sub для cross-node |
| File storage local | Container filesystem | S3/MinIO + CDN |
| No message queue | Synchronous processing | RabbitMQ/Kafka для async |
| Search | LIKE %% = O(n) | Elasticsearch / PG full-text |

---

## 18. Приоритизированные рекомендации

### 🔴 P0 — Исправить немедленно (безопасность)

1. **Убрать hardcoded admin password** → env var `ADMIN_PASSWORD`. Создавать только если не существует.
2. **Исправить SSRF в LinkPreviewService** → блокировать private IPs, validate scheme, resolve DNS.
3. **Ограничить WebSocket origins** → заменить `"*"` на реальные домены.

### 🟠 P1 — Исправить скоро (безопасность & надёжность)

4. **Room authorization** — проверка membership.
5. **Убрать/ограничить `/api/chat/history`**.
6. **Заменить rate limiter** → Bucket4j или Redis.
7. **JWT revocation** — short-lived access tokens + refresh, или Redis blacklist.
8. **DDL_AUTO: validate** в docker-compose.yml.
9. **Стандартизировать auth** — `Principal` / `@AuthenticationPrincipal` везде.
10. **Generic login errors** — убрать user enumeration.

### 🟡 P2 — Следующий спринт (performance & quality)

11. **Декомпозиция ChatWebSocketHandler** — Chat, Call, Conference, Poll, Reaction handlers.
12. **Fix N+1 в ReactionService** → `findByMessageIdIn()`.
13. **RoomEntity members → LAZY**.
14. **DTO validation** → Jakarta `@Valid`, `@NotBlank`, `@Size`.
15. **LinkPreview cache** → Caffeine с max size + TTL.
16. **Paginate `getAllUsers()`**.
17. **Upgrade jjwt → 0.12+**.
18. **Testcontainers** для тестов с PostgreSQL.

### 🔵 P3 — Постепенно (архитектура & масштабируемость)

19. **Timestamps → `TIMESTAMP WITH TIME ZONE`** — миграция VARCHAR → temporal.
20. **In-memory state → Redis** — sessions, conferences, calls, scheduled messages.
21. **Extract file utility** — общий `FileUtils` class.
22. **Java records для DTOs** (Java 21).
23. **WS message rate limiting** — per-user throttling.
24. **File content validation** — magic bytes.
25. **Object storage (S3/MinIO)** для файлов.
26. **Full-text search** — PG tsvector или Elasticsearch.
27. **Domain events** → `ApplicationEventPublisher`.
28. **Rename package** `com.example.webrtcchat` → proper domain.

---

## 19. Предыдущий аудит (v1.0.4)

Предыдущий аудит выявил следующие проблемы (для reference):

- Мёртвый код E2E (6 файлов) — **подтверждено**: V21 уже удалил таблицы, но entity/controller/service всё ещё в кодовой базе если не удалены
- N+1 в `getContacts()` — **подтверждено**, по-прежнему актуально
- 5× `getRoomById()` per WS message — **подтверждено**, по-прежнему актуально
- Отсутствие индексов — **частично исправлено**: V22 добавил индексы, но не все
- Мёртвый фронтенд-код — **не в scope этого аудита** (backend only)
- Lombok в pom.xml без использования — **подтверждено**

---

## Приложение: Полный инвентарь файлов

<details>
<summary>Все 88+ main Java файлов</summary>

### Config (4)
1. `config/SecurityConfig.java`
2. `config/WebSocketConfig.java`
3. `config/GlobalExceptionHandler.java`
4. `config/AdminUserInitializer.java`

### Controllers (18)
5. `controller/AuthController.java`
6. `controller/ChatWebSocketHandler.java`
7. `controller/RoomController.java`
8. `controller/FileController.java`
9. `controller/ContactBlockController.java`
10. `controller/ProfileController.java`
11. `controller/WebRtcController.java`
12. `controller/TaskController.java`
13. `controller/NewsController.java`
14. `controller/StoryController.java`
15. `controller/PollController.java`
16. `controller/PushController.java`
17. `controller/ReactionController.java`
18. `controller/CallLogController.java`
19. `controller/ConferenceController.java`
20. `controller/ChatFolderController.java`
21. `controller/ChatController.java`
22. `controller/AdminController.java`

### Services (17)
23. `service/ChatService.java`
24. `service/JwtService.java`
25. `service/RoomService.java`
26. `service/ConferenceService.java`
27. `service/SchedulerService.java`
28. `service/WebPushService.java`
29. `service/LinkPreviewService.java`
30. `service/StoryService.java`
31. `service/PollService.java`
32. `service/ReactionService.java`
33. `service/ReadReceiptService.java`
34. `service/RoomMuteService.java`
35. `service/DisappearingMessageScheduler.java`
36. `service/TaskService.java`
37. `service/AdminService.java`
38. `service/NewsService.java`
39. `service/ChatFolderService.java`

### Entities (19)
40. `entity/UserEntity.java`
41. `entity/RoomEntity.java`
42. `entity/MessageEntity.java`
43. `entity/ContactEntity.java`
44. `entity/BlockedUserEntity.java`
45. `entity/TaskEntity.java`
46. `entity/CallLogEntity.java`
47. `entity/PollEntity.java`
48. `entity/PollOptionEntity.java`
49. `entity/PollVoteEntity.java`
50. `entity/ReactionEntity.java`
51. `entity/ReadReceiptEntity.java`
52. `entity/RoomMuteEntity.java`
53. `entity/ChatFolderEntity.java`
54. `entity/NewsEntity.java`
55. `entity/NewsCommentEntity.java`
56. `entity/StoryEntity.java`
57. `entity/StoryViewEntity.java`
58. `entity/PushSubscriptionEntity.java`

### Repositories (18)
59. `repository/UserRepository.java`
60. `repository/RoomRepository.java`
61. `repository/MessageRepository.java`
62. `repository/ContactRepository.java`
63. `repository/BlockedUserRepository.java`
64. `repository/TaskRepository.java`
65. `repository/CallLogRepository.java`
66. `repository/PollRepository.java`
67. `repository/PollOptionRepository.java`
68. `repository/PollVoteRepository.java`
69. `repository/ReactionRepository.java`
70. `repository/ReadReceiptRepository.java`
71. `repository/RoomMuteRepository.java`
72. `repository/ChatFolderRepository.java`
73. `repository/NewsRepository.java`
74. `repository/NewsCommentRepository.java`
75. `repository/StoryRepository.java`
76. `repository/StoryViewRepository.java`
77. `repository/PushSubscriptionRepository.java`

### DTOs (9 + inner classes)
78. `dto/MessageDto.java`
79. `dto/UserDto.java`
80. `dto/RoomDto.java`
81. `dto/AuthResponse.java`
82. `dto/TaskDto.java`
83. `dto/NewsDto.java`
84. `dto/NewsCommentDto.java`
85. `dto/StoryDto.java` (+ inner `StoryViewDto`)
86. `dto/AdminStatsDto.java`

### Types (2)
87. `types/MessageType.java`
88. `types/RoomType.java`

### Main (1)
89. `WebrtcChatBackendApplication.java`

</details>

---

*Отчёт v2.0 — полный файл-по-файлу аудит backend-кодовой базы. Все выводы подтверждены прямым чтением исходного кода.*
