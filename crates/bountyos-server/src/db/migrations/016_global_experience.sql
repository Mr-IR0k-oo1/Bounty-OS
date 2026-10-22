-- Global Experience Store (v0.6 Cross-Investigation Experience Layer)
-- Stores empirical action-values conditional on target archetype and technology stack.
-- Tracks continuous Bayesian running averages and full provenance back to source investigations.

CREATE TABLE IF NOT EXISTS experience_actions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archetype                   TEXT NOT NULL,
    technology                  TEXT NOT NULL DEFAULT '*',
    action_type                 TEXT NOT NULL,
    tool                        TEXT NOT NULL,
    predicted_value             DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    actual_value                DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    avg_execution_time_ms       DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    total_new_assets            BIGINT NOT NULL DEFAULT 0,
    total_new_endpoints         BIGINT NOT NULL DEFAULT 0,
    total_new_parameters        BIGINT NOT NULL DEFAULT 0,
    total_new_findings          BIGINT NOT NULL DEFAULT 0,
    total_confirmed_findings    BIGINT NOT NULL DEFAULT 0,
    total_false_positives       BIGINT NOT NULL DEFAULT 0,
    success_rate                DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    sample_count                BIGINT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_experience_key UNIQUE (archetype, technology, action_type, tool)
);

CREATE INDEX IF NOT EXISTS idx_experience_archetype ON experience_actions(archetype);
CREATE INDEX IF NOT EXISTS idx_experience_technology ON experience_actions(technology);
CREATE INDEX IF NOT EXISTS idx_experience_tool ON experience_actions(tool);
CREATE INDEX IF NOT EXISTS idx_experience_actual_value ON experience_actions(actual_value);

CREATE TABLE IF NOT EXISTS experience_provenance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id       UUID NOT NULL REFERENCES experience_actions(id) ON DELETE CASCADE,
    investigation_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    action_id           UUID REFERENCES investigation_actions(id) ON DELETE SET NULL,
    outcome_id          UUID REFERENCES action_outcomes(id) ON DELETE SET NULL,
    observed_value      DOUBLE PRECISION NOT NULL,
    new_findings        INTEGER NOT NULL DEFAULT 0,
    confirmed_findings  INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_experience_id ON experience_provenance(experience_id);
CREATE INDEX IF NOT EXISTS idx_provenance_investigation_id ON experience_provenance(investigation_id);
CREATE INDEX IF NOT EXISTS idx_provenance_action_id ON experience_provenance(action_id);
