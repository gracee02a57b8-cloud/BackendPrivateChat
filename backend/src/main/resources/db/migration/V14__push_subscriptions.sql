-- Push notification subscriptions (Web Push API)
CREATE TABLE push_subscriptions (
    id         VARCHAR(36)   PRIMARY KEY,
    username   VARCHAR(255)  NOT NULL,
    endpoint   VARCHAR(1024) NOT NULL UNIQUE,
    p256dh     VARCHAR(512)  NOT NULL,
    auth_key   VARCHAR(255)  NOT NULL,
    created_at VARCHAR(30)
);

CREATE INDEX idx_push_sub_username ON push_subscriptions(username);
