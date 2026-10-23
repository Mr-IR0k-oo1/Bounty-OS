-- Investigation Actions Audit Trail & Telemetry
-- Persists every decision made by the Intelligence Planner:
-- Planned metrics (IG, R, C, Cost, Risk, Score), execution link, and actual observed feedback.

CREATE TABLE IF NOT EXISTS investigation_actions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    action_type             TEXT NOT NULL,
    target                  TEXT NOT NULL,
    tool                    TEXT NOT NULL,
    score                   DOUBLE PRECISION NOT NULL,
    information_gain        DOUBLE PRECISION NOT NULL,
    relevance               DOUBLE PRECISION NOT NULL,
    confidence              DOUBLE PRECISION NOT NULL,
    cost                    DOUBLE PRECISION NOT NULL,
    risk                    DOUBLE PRECISION NOT NULL,
    reason                  TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'planned',
    actual_information_gain DOUBLE PRECISION,
    prediction_error        DOUBLE PRECISION,
    findings_generated      INTEGER NOT NULL DEFAULT 0,
    new_assets_generated    INTEGER NOT NULL DEFAULT 0,
    job_id                  UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_actions_investigation_id ON investigation_actions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_inv_actions_created_at ON investigation_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_actions_tool ON investigation_actions(tool);
