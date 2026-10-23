-- Bounty OS v0.4: Action Outcomes Empirical Telemetry Table
-- Persists fine-grained execution metrics, asset discovery deltas, finding yields, and computed action values

CREATE TABLE IF NOT EXISTS action_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    action_id UUID REFERENCES investigation_actions(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    tool TEXT NOT NULL,
    target TEXT NOT NULL,
    planner_score DOUBLE PRECISION NOT NULL,
    predicted_information_gain DOUBLE PRECISION NOT NULL,
    execution_time_ms BIGINT NOT NULL DEFAULT 0,
    resource_cost DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    risk DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    new_assets INTEGER NOT NULL DEFAULT 0,
    new_services INTEGER NOT NULL DEFAULT 0,
    new_endpoints INTEGER NOT NULL DEFAULT 0,
    new_parameters INTEGER NOT NULL DEFAULT 0,
    new_technologies INTEGER NOT NULL DEFAULT 0,
    new_findings INTEGER NOT NULL DEFAULT 0,
    confirmed_findings INTEGER NOT NULL DEFAULT 0,
    false_positives INTEGER NOT NULL DEFAULT 0,
    verification_result BOOLEAN,
    actual_information_gain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    actual_value DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    prediction_error DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_outcomes_inv_id ON action_outcomes(investigation_id);
CREATE INDEX IF NOT EXISTS idx_action_outcomes_action_type ON action_outcomes(action_type);
CREATE INDEX IF NOT EXISTS idx_action_outcomes_tool ON action_outcomes(tool);
CREATE INDEX IF NOT EXISTS idx_action_outcomes_created_at ON action_outcomes(created_at);
