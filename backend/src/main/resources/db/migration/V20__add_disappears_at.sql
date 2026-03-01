-- V20: Add disappears_at column for disappearing messages auto-deletion
ALTER TABLE messages ADD COLUMN IF NOT EXISTS disappears_at VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_messages_disappears_at ON messages(disappears_at) WHERE disappears_at IS NOT NULL;
