-- Ports
CREATE TABLE IF NOT EXISTS ports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    subdomain_id    UUID REFERENCES subdomains(id) ON DELETE SET NULL,
    ip              TEXT NOT NULL,
    port            INTEGER NOT NULL,
    protocol        TEXT NOT NULL DEFAULT 'tcp',
    service         TEXT,
    state           TEXT NOT NULL DEFAULT 'open',
    banner          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, ip, port, protocol)
);

-- URLs
CREATE TABLE IF NOT EXISTS urls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    subdomain_id    UUID REFERENCES subdomains(id) ON DELETE SET NULL,
    url             TEXT NOT NULL,
    status_code     INTEGER,
    content_type    TEXT,
    content_length  BIGINT,
    source          TEXT NOT NULL DEFAULT 'unknown',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, url)
);
