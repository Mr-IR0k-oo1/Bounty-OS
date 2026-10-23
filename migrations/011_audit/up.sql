-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunter_id       UUID REFERENCES hunters(id),
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT,
    details         JSONB DEFAULT '{}',
    ip_address      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_hunter_id ON audit_log(hunter_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Session Blacklist (for logout/invalidation)
CREATE TABLE IF NOT EXISTS session_blacklist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash      TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_blacklist_token_hash ON session_blacklist(token_hash);
