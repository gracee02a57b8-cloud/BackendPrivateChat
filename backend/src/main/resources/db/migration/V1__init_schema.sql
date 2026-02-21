-- V1__init_schema.sql — Initial database schema for BarsikChat
-- This migration creates all tables matching the JPA entity definitions.

-- === Users ===
CREATE TABLE IF NOT EXISTS app_users (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    password     VARCHAR(200),
    created_at   VARCHAR(255)
);

-- === Rooms ===
CREATE TABLE IF NOT EXISTS rooms (
    id           VARCHAR(100) PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    type         VARCHAR(20)  NOT NULL,
    created_by   VARCHAR(50),
    created_at   VARCHAR(255)
);

-- === Room members (ElementCollection) ===
CREATE TABLE IF NOT EXISTS room_members (
    room_id      VARCHAR(100) NOT NULL,
    username     VARCHAR(50)  NOT NULL,
    PRIMARY KEY (room_id, username),
    CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- === Messages ===
CREATE TABLE IF NOT EXISTS messages (
    id           VARCHAR(36)  PRIMARY KEY,
    sender       VARCHAR(50),
    content      TEXT,
    timestamp    VARCHAR(255),
    type         VARCHAR(20),
    room_id      VARCHAR(100),
    file_url     VARCHAR(500),
    file_name    VARCHAR(255),
    file_size    BIGINT       NOT NULL DEFAULT 0,
    file_type    VARCHAR(100),
    status       VARCHAR(20),
    edited       BOOLEAN      NOT NULL DEFAULT FALSE,
    scheduled_at VARCHAR(255),
    seq_id       BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);

-- === News ===
CREATE TABLE IF NOT EXISTS news (
    id           VARCHAR(36)  PRIMARY KEY,
    author       VARCHAR(50),
    title        VARCHAR(255) NOT NULL,
    content      TEXT,
    image_url    VARCHAR(500),
    created_at   VARCHAR(255)
);

-- === Tasks ===
CREATE TABLE IF NOT EXISTS tasks (
    id           VARCHAR(36)  PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    created_by   VARCHAR(50),
    assigned_to  VARCHAR(50),
    deadline     VARCHAR(255),
    status       VARCHAR(20),
    created_at   VARCHAR(255),
    room_id      VARCHAR(100)
);

-- === Seed general room ===
INSERT INTO rooms (id, name, type, created_by, created_at)
VALUES ('general', 'Общий чат', 'GENERAL', 'system', NOW()::TEXT)
ON CONFLICT (id) DO NOTHING;
