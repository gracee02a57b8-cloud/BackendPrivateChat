-- ============================================================
-- V19: Reactions, Polls, Chat Folders, Room Mutes,
--      Read Receipts, Disappearing Messages
-- ============================================================

-- 1) Message reactions (emoji reactions on messages)
CREATE TABLE reactions (
    id          BIGSERIAL     PRIMARY KEY,
    message_id  VARCHAR(36)   NOT NULL,
    room_id     VARCHAR(100)  NOT NULL,
    username    VARCHAR(50)   NOT NULL,
    emoji       VARCHAR(10)   NOT NULL,
    created_at  VARCHAR(30)   NOT NULL,
    UNIQUE(message_id, username, emoji)
);
CREATE INDEX idx_reactions_message ON reactions(message_id);
CREATE INDEX idx_reactions_room    ON reactions(room_id);

-- 2) Polls
CREATE TABLE polls (
    id           VARCHAR(36)   PRIMARY KEY,
    room_id      VARCHAR(100)  NOT NULL,
    message_id   VARCHAR(36),
    creator      VARCHAR(50)   NOT NULL,
    question     TEXT          NOT NULL,
    multi_choice BOOLEAN       NOT NULL DEFAULT FALSE,
    anonymous    BOOLEAN       NOT NULL DEFAULT FALSE,
    closed       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at   VARCHAR(30)   NOT NULL,
    expires_at   VARCHAR(30)
);
CREATE INDEX idx_polls_room ON polls(room_id);

CREATE TABLE poll_options (
    id          BIGSERIAL     PRIMARY KEY,
    poll_id     VARCHAR(36)   NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text        VARCHAR(200)  NOT NULL,
    sort_order  INTEGER       NOT NULL DEFAULT 0
);
CREATE INDEX idx_poll_options_poll ON poll_options(poll_id);

CREATE TABLE poll_votes (
    id          BIGSERIAL     PRIMARY KEY,
    poll_id     VARCHAR(36)   NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id   BIGINT        NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    username    VARCHAR(50)   NOT NULL,
    UNIQUE(poll_id, option_id, username)
);
CREATE INDEX idx_poll_votes_poll ON poll_votes(poll_id);

-- 3) Chat folders
CREATE TABLE chat_folders (
    id          BIGSERIAL     PRIMARY KEY,
    username    VARCHAR(50)   NOT NULL,
    name        VARCHAR(50)   NOT NULL,
    emoji       VARCHAR(10),
    sort_order  INTEGER       NOT NULL DEFAULT 0
);
CREATE INDEX idx_chat_folders_user ON chat_folders(username);

CREATE TABLE chat_folder_rooms (
    folder_id   BIGINT        NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
    room_id     VARCHAR(100)  NOT NULL,
    PRIMARY KEY (folder_id, room_id)
);

-- 4) Room mutes
CREATE TABLE room_mutes (
    id          BIGSERIAL     PRIMARY KEY,
    username    VARCHAR(50)   NOT NULL,
    room_id     VARCHAR(100)  NOT NULL,
    muted_until VARCHAR(30),
    UNIQUE(username, room_id)
);
CREATE INDEX idx_room_mutes_user ON room_mutes(username);

-- 5) Group read receipts
CREATE TABLE read_receipts (
    id          BIGSERIAL     PRIMARY KEY,
    message_id  VARCHAR(36)   NOT NULL,
    room_id     VARCHAR(100)  NOT NULL,
    username    VARCHAR(50)   NOT NULL,
    read_at     VARCHAR(30)   NOT NULL,
    UNIQUE(message_id, username)
);
CREATE INDEX idx_read_receipts_message ON read_receipts(message_id);
CREATE INDEX idx_read_receipts_room    ON read_receipts(room_id);

-- 6) Disappearing messages: add TTL field to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS disappearing_seconds INTEGER DEFAULT 0;
