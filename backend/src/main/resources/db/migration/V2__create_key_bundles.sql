-- V2__create_key_bundles.sql — E2E encryption key storage

-- Key bundles: each user has one identity key + signed pre-key
CREATE TABLE IF NOT EXISTS key_bundles (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    identity_key  TEXT         NOT NULL,
    signing_key   TEXT         NOT NULL,
    signed_pre_key TEXT        NOT NULL,
    signed_pre_key_signature TEXT NOT NULL,
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- One-time pre-keys: each user has multiple disposable keys
CREATE TABLE IF NOT EXISTS one_time_pre_keys (
    id         BIGSERIAL    PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL,
    key_id     INT          NOT NULL,
    public_key TEXT         NOT NULL,
    UNIQUE(username, key_id),
    CONSTRAINT fk_otk_bundle FOREIGN KEY (username)
        REFERENCES key_bundles(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_otk_username ON one_time_pre_keys(username);
