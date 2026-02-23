-- Stories (video stories, up to 5 per user, auto-expire after 24h)
CREATE TABLE stories (
    id          VARCHAR(36)   PRIMARY KEY,
    author      VARCHAR(50)   NOT NULL,
    video_url   VARCHAR(500)  NOT NULL,
    thumbnail_url VARCHAR(500),
    duration    INTEGER       DEFAULT 0,
    created_at  VARCHAR(30)   NOT NULL,
    expires_at  VARCHAR(30)   NOT NULL
);

CREATE INDEX idx_stories_author     ON stories(author);
CREATE INDEX idx_stories_expires_at ON stories(expires_at);
CREATE INDEX idx_stories_created_at ON stories(created_at DESC);

-- Story views (who watched which story)
CREATE TABLE story_views (
    id          BIGSERIAL     PRIMARY KEY,
    story_id    VARCHAR(36)   NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer      VARCHAR(50)   NOT NULL,
    viewed_at   VARCHAR(30)   NOT NULL,
    UNIQUE(story_id, viewer)
);

CREATE INDEX idx_story_views_story_id ON story_views(story_id);
CREATE INDEX idx_story_views_viewer   ON story_views(viewer);
