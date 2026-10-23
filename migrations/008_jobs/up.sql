-- Scan Jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
    id              UUID PRIMARY KEY,
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    subdomain_id    UUID REFERENCES subdomains(id) ON DELETE SET NULL,
    stage           INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'queued',
    target          TEXT,
    flags           JSONB DEFAULT '{}',
    error_log       TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_program_id ON scan_jobs(program_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
