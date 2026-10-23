-- Scope Targets
CREATE TABLE IF NOT EXISTS scope_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    target          TEXT NOT NULL,
    target_type     TEXT NOT NULL DEFAULT 'domain',
    out_of_scope    BOOLEAN DEFAULT FALSE,
    source          TEXT,
    added_by        UUID REFERENCES hunters(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, target)
);
