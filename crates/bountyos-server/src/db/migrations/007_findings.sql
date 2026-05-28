-- Findings
CREATE TABLE IF NOT EXISTS findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    subdomain_id    UUID REFERENCES subdomains(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    severity        TEXT NOT NULL DEFAULT 'info',
    status          TEXT NOT NULL DEFAULT 'new',
    finding_type    TEXT NOT NULL DEFAULT 'unknown',
    matched_at      TEXT,
    curl_command    TEXT,
    tags            TEXT[] DEFAULT '{}',
    assigned_to     UUID REFERENCES hunters(id),
    cvss_score      REAL,
    kanban_column   TEXT DEFAULT 'backlog',
    duplicate_of    UUID REFERENCES findings(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_program_id ON findings(program_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
