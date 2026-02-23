-- User contacts (personal contact list)
CREATE TABLE user_contacts (
    id          BIGSERIAL     PRIMARY KEY,
    owner       VARCHAR(50)   NOT NULL,
    contact     VARCHAR(50)   NOT NULL,
    created_at  VARCHAR(30),
    UNIQUE(owner, contact)
);

CREATE INDEX idx_contacts_owner ON user_contacts(owner);

-- Blocked users
CREATE TABLE blocked_users (
    id          BIGSERIAL     PRIMARY KEY,
    blocker     VARCHAR(50)   NOT NULL,
    blocked     VARCHAR(50)   NOT NULL,
    created_at  VARCHAR(30),
    UNIQUE(blocker, blocked)
);

CREATE INDEX idx_blocked_blocker ON blocked_users(blocker);
CREATE INDEX idx_blocked_blocked ON blocked_users(blocked);
