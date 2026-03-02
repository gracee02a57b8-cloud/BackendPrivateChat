-- V23: Refresh tokens table for JWT revocation (P1-7)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    token       VARCHAR(64)  NOT NULL UNIQUE,
    username    VARCHAR(50)  NOT NULL,
    expires_at  VARCHAR(30)  NOT NULL,
    created_at  VARCHAR(30)  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_username ON refresh_tokens(username);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);
