-- V3__add_encryption_fields.sql — E2E encryption fields for messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_content TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS iv VARCHAR(24);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ratchet_key TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_number INT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS previous_chain_length INT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ephemeral_key TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_identity_key TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS one_time_key_id INT;
