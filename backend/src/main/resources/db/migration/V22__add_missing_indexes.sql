-- ============================================================
-- V22: Add missing indexes for performance (audit 3.3 + 3.4)
-- ============================================================

-- messages: composite index for ORDER BY in history queries
CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages (room_id, timestamp DESC);

-- messages: sender (used in unread / search)
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender);

-- messages: pinned messages per room (partial index)
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages (room_id) WHERE pinned = true;

-- news: ordering by creation date
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);

-- news_comments: lookup by news_id
CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON news_comments (news_id);

-- tasks: lookup by room and assignee
CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON tasks (room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- messages: trigram GIN index for LIKE '%query%' full-text search (audit 3.4)
-- Requires pg_trgm extension (safe to call repeatedly)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);
