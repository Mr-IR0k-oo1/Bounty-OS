-- Subdomains
CREATE TABLE IF NOT EXISTS subdomains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    subdomain       TEXT NOT NULL,
    ip_address      TEXT,
    status_code     INTEGER,
    title           TEXT,
    web_server      TEXT,
    content_type    TEXT,
    content_length  BIGINT,
    tech            TEXT[] DEFAULT '{}',
    cdn_name        TEXT,
    source          TEXT NOT NULL DEFAULT 'unknown',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, subdomain)
);
