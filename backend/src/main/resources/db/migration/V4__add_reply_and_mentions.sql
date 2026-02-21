-- Reply fields: link to original message
ALTER TABLE messages ADD COLUMN reply_to_id VARCHAR(36);
ALTER TABLE messages ADD COLUMN reply_to_sender VARCHAR(50);
ALTER TABLE messages ADD COLUMN reply_to_content TEXT;

-- Mentions: JSON array of mentioned usernames, e.g. ["user1","user2"]
ALTER TABLE messages ADD COLUMN mentions TEXT;

-- Index for fast lookup of replies to a message
CREATE INDEX idx_messages_reply_to_id ON messages(reply_to_id);
