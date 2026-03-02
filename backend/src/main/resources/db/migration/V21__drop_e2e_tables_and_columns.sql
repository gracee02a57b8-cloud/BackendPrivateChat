-- Drop E2E encryption tables (created in V2)
DROP TABLE IF EXISTS one_time_pre_keys;
DROP TABLE IF EXISTS key_bundles;

-- Drop E2E encryption columns from messages (added in V3 and V10)
ALTER TABLE messages
    DROP COLUMN IF EXISTS encrypted,
    DROP COLUMN IF EXISTS group_encrypted,
    DROP COLUMN IF EXISTS encrypted_content,
    DROP COLUMN IF EXISTS iv,
    DROP COLUMN IF EXISTS ratchet_key,
    DROP COLUMN IF EXISTS message_number,
    DROP COLUMN IF EXISTS previous_chain_length,
    DROP COLUMN IF EXISTS ephemeral_key,
    DROP COLUMN IF EXISTS sender_identity_key,
    DROP COLUMN IF EXISTS one_time_key_id;
