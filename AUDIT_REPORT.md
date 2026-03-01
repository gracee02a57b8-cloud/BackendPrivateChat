# 🔍 Аудит системы BarsikChat

**Дата:** Июль 2025  
**Версия:** 1.0.4  
**Стек:** Spring Boot 3.3.5 (Java 21) + React 18.2 (Vite 4.4.5) + PostgreSQL

---

## Содержание

1. [Мёртвый и неиспользуемый код — Backend](#1-мёртвый-и-неиспользуемый-код--backend)
2. [Мёртвый и неиспользуемый код — Frontend](#2-мёртвый-и-неиспользуемый-код--frontend)
3. [Проблемы производительности](#3-проблемы-производительности)
4. [Проблемы конфигурации](#4-проблемы-конфигурации)
5. [Рекомендации по улучшению (приоритезированные)](#5-рекомендации-по-улучшению)
6. [Сводная таблица](#6-сводная-таблица)

---

## 1. Мёртвый и неиспользуемый код — Backend

### 1.1 🗑️ Подсистема E2E-шифрования (6 файлов — можно удалить целиком)

Фронтенд **не содержит ни одного вызова** к API `/api/key-bundle/*`. Вся подсистема — мёртвый код:

| Файл | Тип | Описание |
|---|---|---|
| `KeyBundleController.java` | Controller | 6 эндпоинтов — ни один не вызывается |
| `KeyBundleService.java` | Service | Логика подписания/выдачи ключей |
| `KeyBundleEntity.java` | Entity | Таблица `key_bundles` в БД |
| `OneTimePreKeyEntity.java` | Entity | Таблица `one_time_pre_keys` в БД |
| `KeyBundleRepository.java` | Repository | JPA-репозиторий |
| `OneTimePreKeyRepository.java` | Repository | JPA-репозиторий |

**Дополнительно:** В `ChatWebSocketHandler.java` (строки 288–297) на **каждое** сообщение выполняется 10 `setter`-вызовов для зануления E2E-полей:

```java
incoming.setEncrypted(false);
incoming.setGroupEncrypted(false);
incoming.setEncryptedContent(null);
incoming.setIv(null);
incoming.setRatchetKey(null);
incoming.setMessageNumber(null);
incoming.setPreviousChainLength(null);
incoming.setEphemeralKey(null);
incoming.setSenderIdentityKey(null);
incoming.setOneTimeKeyId(null);
```

### 1.2 🗑️ E2E-колонки в `MessageEntity.java`

В таблице `messages` 10 колонок, которые **всегда NULL/false** (шифрование отключено):

`encrypted`, `group_encrypted`, `encrypted_content`, `iv`, `ratchet_key`, `message_number`, `previous_chain_length`, `ephemeral_key`, `sender_identity_key`, `one_time_key_id`

**Влияние:** лишний расход хранилища и пропускной способности при каждом SELECT/INSERT.

### 1.3 🗑️ Lombok в `pom.xml`

Зависимость `lombok` объявлена в `pom.xml`, но **ни один файл** в проекте не содержит `import lombok`. Все entity используют ручные getter/setter. Зависимость можно удалить.

---

## 2. Мёртвый и неиспользуемый код — Frontend

### 2.1 🗑️ Компоненты без маршрутов (6 файлов)

Эти компоненты **не имеют маршрутов** в `App.jsx` и недоступны пользователю:

| Файл | Причина |
|---|---|
| `AccountConfirmation.jsx` | Нигде не импортируется, нет маршрута |
| `EmailConfirmation.jsx` | Нигде не импортируется, нет маршрута |
| `ResetPasswordPage.jsx` | Не имеет маршрута в `App.jsx`, нет навигации к нему |
| `NewPasswordPage.jsx` | Не имеет маршрута в `App.jsx`, нет навигации к нему |
| `RecoveryEmailSent.jsx` | Импортируется только мёртвым `ResetPasswordPage` |
| `ResetLinkExpired.jsx` | Импортируется только мёртвым `NewPasswordPage` |

### 2.2 🗑️ Неиспользуемый импорт `LandingPage`

В `App.jsx` (строка 20) импортирован `LandingPage`, но **нет соответствующего `<Route>`** — компонент не отображается нигде.

### 2.3 🗑️ Capacitor — 3 пакета без единого использования

В `package.json` объявлены:
- `@capacitor/android` ^8.1.0
- `@capacitor/cli` ^8.1.0
- `@capacitor/core` ^8.1.0

**Ни один файл** в `src/` не содержит `import` из `@capacitor/*`. Пакеты увеличивают `node_modules` и время `npm install` без пользы.

### 2.4 ⚠️ `react-query-devtools` в продакшн-бандле

В `App.jsx` (строка 8):
```jsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
```

Пакет devtools **импортируется безусловно** и попадает в продакшн-бандл. Это увеличивает размер бандла и отдаёт инструменты отладки конечным пользователям.

---

## 3. Проблемы производительности

### 🔴 3.1 CRITICAL — Множественные вызовы `getRoomById()` на одно WS-сообщение

**Файл:** `ChatWebSocketHandler.java`

При обработке **одного** CHAT-сообщения `roomService.getRoomById(roomId)` вызывается **до 5 раз**:

| Место | Строка | Цель |
|---|---|---|
| `isUserInRoom()` | 324 | Проверка членства |
| Проверка блокировки | 271 | Получение типа комнаты |
| `broadcastToRoom()` | 1165 | Получение списка участников |
| `sendPushToOfflineMembers()` | 1184 | Получение списка участников |
| `sendDeliveryStatus()` | ~305 | Повторная проверка комнаты |

Каждый вызов — это `roomRepository.findById()` → SQL запрос к PostgreSQL. **Для 100 сообщений/сек = 500 SELECT'ов к таблице rooms.**

**Рекомендация:** Загрузить `RoomDto` один раз в начале обработки и передать по цепочке:

```java
RoomDto room = roomService.getRoomById(roomId);
if (room == null) return;
if (!isUserInRoom(username, room)) return;  // принимает RoomDto
broadcastToRoom(room, message);             // принимает RoomDto
sendPushToOfflineMembers(username, room);   // принимает RoomDto
```

---

### 🔴 3.2 CRITICAL — N+1 запрос в `getContacts()`

**Файл:** `ContactBlockController.java`, строка 62

```java
contacts.stream().map(c -> {
    userRepository.findByUsername(c.getContact()).ifPresent(u -> { ... });
    // ↑ SQL SELECT для КАЖДОГО контакта
    map.put("online", chatService.isUserOnline(c.getContact()));
    map.put("lastSeen", chatService.getLastSeen(c.getContact()));
}).collect(Collectors.toList());
```

**Для 50 контактов = 50 отдельных SELECT'ов** вместо одного.

**Рекомендация:** Один batch-запрос:

```java
List<String> usernames = contacts.stream().map(ContactEntity::getContact).toList();
Map<String, UserEntity> usersMap = userRepository.findByUsernameIn(usernames)
    .stream().collect(Collectors.toMap(UserEntity::getUsername, u -> u));
```

---

### 🔴 3.3 CRITICAL — Отсутствие индексов на 10+ таблицах

Проверены все `@Table` аннотации. Таблицы **без единого индекса** (кроме PK):

| Таблица | Частые запросы без индекса |
|---|---|
| `rooms` | `findUserRooms` (LEFT JOIN по members) |
| `reactions` | по `messageId` |
| `polls` | по `roomId`, `messageId` |
| `poll_votes` | по `pollId` + `username` |
| `user_contacts` | по `owner` |
| `blocked_users` | по `blocker`, `blocked` |
| `read_receipts` | по `roomId` + `username` |
| `room_mutes` | по `username` + `roomId` |
| `news` / `news_comments` | по `createdAt`, `newsId` |
| `chat_folders` | по `username` |
| `tasks` | по `roomId`, `assignedTo` |

**Также:** Таблица `messages` имеет индекс только на `roomId`. Отсутствуют индексы на:
- `timestamp` (используется в ORDER BY в каждом запросе истории)
- `disappears_at` (используется в `findExpiredDisappearingMessages` каждые 10 сек)
- `sender` (используется в поиске непрочитанных)
- `pinned` (используется в `findByRoomIdAndPinnedTrue`)

---

### 🟡 3.4 MEDIUM — Поиск сообщений через LIKE '%query%'

**Файл:** `MessageRepository.java`, строки 55–60

```sql
WHERE LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%'))
```

`LIKE '%...'` **не может использовать B-tree индекс** → full table scan на каждый поиск.

**Рекомендация:** Для PostgreSQL — `pg_trgm` + GIN-индекс:

```sql
CREATE INDEX idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);
```

---

### 🟡 3.5 MEDIUM — Push-уведомления на `ForkJoinPool.commonPool()`

**Файл:** `WebPushService.java`, строки 154, 164

```java
CompletableFuture.runAsync(() -> sendPushToUser(...));
```

`runAsync()` без указания `Executor` использует `ForkJoinPool.commonPool()` — общий пул с количеством потоков = CPU cores - 1. При большом количестве push-уведомлений это блокирует другие задачи, использующие commonPool (параллельные стримы, и т.д.).

**Рекомендация:** Выделенный `ExecutorService`:

```java
private static final ExecutorService PUSH_EXECUTOR = 
    Executors.newFixedThreadPool(4, r -> new Thread(r, "push-sender"));

CompletableFuture.runAsync(() -> sendPushToUser(...), PUSH_EXECUTOR);
```

---

### 🟡 3.6 MEDIUM — `DisappearingMessageScheduler` каждые 10 секунд

**Файл:** `DisappearingMessageScheduler.java`, строка 38

```java
@Scheduled(fixedRate = 10_000)
```

Запрос `findExpiredDisappearingMessages` выполняется **каждые 10 секунд** даже когда нет исчезающих сообщений. При отсутствии индекса на `disappears_at` — это full scan.

**Рекомендация:**
1. Добавить индекс на `disappears_at`
2. Увеличить интервал до 30–60 секунд (пользователь не заметит разницу)
3. Или использовать event-driven подход: планировать проверку только при создании disappearing-сообщения

---

### 🟡 3.7 MEDIUM — `findUserRooms` с LEFT JOIN

**Файл:** `RoomRepository.java`, строка 13

```java
@Query("SELECT DISTINCT r FROM RoomEntity r LEFT JOIN r.members m WHERE ...")
```

LEFT JOIN загружает коллекцию `members` для каждой комнаты. При большом количестве комнат и участников — значительный объём данных.

---

### 🟢 3.8 LOW — Нет code splitting / build оптимизаций в Vite

**Файл:** `vite.config.js`

Конфигурация не содержит:
- `build.rollupOptions.output.manualChunks` — нет code splitting
- Нет отделения vendor-библиотек (react, react-dom, react-router)
- Нет terser minification конфигурации

**Рекомендация:**

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        query: ['@tanstack/react-query'],
      }
    }
  }
}
```

---

## 4. Проблемы конфигурации

### 4.1 ⚠️ OSIV (Open Session In View) включён по умолчанию

В `application.yml` **нет** `spring.jpa.open-in-view: false`. Spring Boot по умолчанию включает OSIV, что:
- Держит Hibernate-сессию открытой на всё время HTTP-запроса
- Разрешает lazy loading в контроллерах (маскирует N+1 проблемы)
- Занимает пул соединений БД дольше необходимого

**Рекомендация:** Добавить в `application.yml`:
```yaml
spring:
  jpa:
    open-in-view: false
```

### 4.2 ⚠️ HikariCP без валидации соединений

Текущая конфигурация:
```yaml
hikari:
  maximum-pool-size: 10
  minimum-idle: 2
  idle-timeout: 300000
  connection-timeout: 20000
  max-lifetime: 1200000
```

Отсутствует `connection-test-query` или `validation-timeout`. Если PostgreSQL разрывает idle-соединение (network timeout, DB restart), приложение получит `Connection is closed` ошибку.

**Рекомендация:**
```yaml
hikari:
  validation-timeout: 5000
  leak-detection-threshold: 30000
```

### 4.3 ⚠️ Actuator только health

Выставлен только `health` эндпоинт. Для мониторинга производительности полезно добавить:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
```

---

## 5. Рекомендации по улучшению

### Приоритет 1 — Критические (дают ощутимый прирост)

| # | Задача | Оценка эффекта | Сложность |
|---|---|---|---|
| 1 | **Кэширование `RoomDto` в WS-обработчике** — загружать комнату 1 раз за сообщение | -80% запросов к rooms | Низкая |
| 2 | **Исправить N+1 в `getContacts()`** — batch-запрос `findByUsernameIn()` | -95% запросов при 50 контактах | Низкая |
| 3 | **Добавить индексы на таблицы** (см. п. 3.3) — Flyway-миграция | Ускорение SELECT'ов в 10–100x | Низкая |
| 4 | **Отключить OSIV** — `open-in-view: false` | Раннее освобождение DB-соединений | Средняя* |

\* Средняя сложность, т.к. могут появиться `LazyInitializationException` — потребуется проверить все контроллеры.

### Приоритет 2 — Средние (улучшают стабильность)

| # | Задача | Оценка эффекта | Сложность |
|---|---|---|---|
| 5 | **Выделенный Executor для push** — заменить `commonPool()` | Изоляция push от CPU-задач | Низкая |
| 6 | **Увеличить интервал `DisappearingMessageScheduler`** до 30–60 сек | -66–83% холостых запросов | Низкая |
| 7 | **HikariCP валидация** — добавить `validation-timeout` + `leak-detection` | Устойчивость к разрывам | Низкая |
| 8 | **Full-text search** — `pg_trgm` + GIN для поиска сообщений | Поиск без full scan | Средняя |

### Приоритет 3 — Очистка кода

| # | Задача | Оценка эффекта | Сложность |
|---|---|---|---|
| 9 | **Удалить E2E-подсистему** (6 файлов + 10 колонок + Flyway-миграция) | Меньше кода, меньше размер messages | Средняя |
| 10 | **Удалить мёртвые фронтенд-компоненты** (6 файлов + LandingPage import) | Чистота кодовой базы | Низкая |
| 11 | **Удалить Capacitor зависимости** | Быстрее `npm install` | Низкая |
| 12 | **Убрать react-query-devtools из прода** или добавить lazy import | Меньше бандл | Низкая |
| 13 | **Удалить Lombok из pom.xml** | Чистота зависимостей | Низкая |

### Приоритет 4 — Улучшения бандла

| # | Задача | Оценка эффекта | Сложность |
|---|---|---|---|
| 14 | **Vite code splitting** — `manualChunks` для vendor-библиотек | Лучший кэшинг, меньший initial load | Низкая |
| 15 | **Actuator metrics/prometheus** | Мониторинг | Низкая |

---

## 6. Сводная таблица

| Категория | Количество | Файлов затронуто |
|---|---|---|
| Мёртвый backend-код | 6 файлов E2E + 10 колонок + Lombok | 8 |
| Мёртвый frontend-код | 6 компонентов + 3 npm пакета + devtools | 10 |
| Критические проблемы производительности | 3 (WS N+5, Contacts N+1, индексы) | 3 |
| Средние проблемы | 4 (push pool, scheduler, LIKE, JOIN) | 4 |
| Проблемы конфигурации | 3 (OSIV, HikariCP, Actuator) | 1 |
| **Итого рекомендаций** | **15** | — |

---

### Пример Flyway-миграции для индексов (приоритет 1, задача 3)

```sql
-- V__add_missing_indexes.sql

-- messages: ускорение ORDER BY, disappearing, pinned
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (room_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_disappears_at ON messages (disappears_at) WHERE disappears_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages (room_id) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender);

-- reactions
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions (message_id);

-- polls & votes
CREATE INDEX IF NOT EXISTS idx_polls_room_id ON polls (room_id);
CREATE INDEX IF NOT EXISTS idx_polls_message_id ON polls (message_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes (poll_id, username);

-- contacts & blocks
CREATE INDEX IF NOT EXISTS idx_user_contacts_owner ON user_contacts (owner);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users (blocker);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users (blocked);

-- read receipts
CREATE INDEX IF NOT EXISTS idx_read_receipts_room_user ON read_receipts (room_id, username);

-- room mutes
CREATE INDEX IF NOT EXISTS idx_room_mutes_username ON room_mutes (username, room_id);

-- news
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON news_comments (news_id);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON tasks (room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- folders
CREATE INDEX IF NOT EXISTS idx_chat_folders_username ON chat_folders (username);
```

---

*Отчёт подготовлен на основе анализа исходного кода backend (`src/main/java`) и frontend (`src/`). Все выводы подтверждены прямым чтением файлов.*
