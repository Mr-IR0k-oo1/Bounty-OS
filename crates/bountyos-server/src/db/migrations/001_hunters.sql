-- Hunters (users)
CREATE TABLE IF NOT EXISTS hunters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'hunter',
    password_hash   TEXT NOT NULL,
    totp_secret     TEXT,
    totp_enabled    BOOLEAN DEFAULT FALSE,
    discord_webhook TEXT,
    slack_webhook   TEXT,
    email           TEXT,
    active          BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_by      UUID REFERENCES hunters(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
