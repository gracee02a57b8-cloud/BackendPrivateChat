-- V10: Add group_encrypted flag for group E2E encryption
ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
