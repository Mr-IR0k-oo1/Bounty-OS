-- Programs
CREATE TABLE IF NOT EXISTS programs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    platform            TEXT NOT NULL,
    program_url         TEXT,
    active              BOOLEAN DEFAULT TRUE,
    active_approved     BOOLEAN DEFAULT FALSE,
    rescan_interval_hrs INTEGER DEFAULT 24,
    notes               TEXT,
    created_by          UUID REFERENCES hunters(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);
