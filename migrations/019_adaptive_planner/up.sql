-- Migration 019: Adaptive Investigation Planner
-- Persists planner decisions (selected action, explainable score components, alternatives, rejections)
-- and fine-grained action executions with before/after state deltas for empirical information gain.

CREATE TABLE IF NOT EXISTS planner_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    selected_action TEXT NOT NULL,
    capability TEXT NOT NULL,
    target TEXT NOT NULL,
    tool TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    score_components JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    expected_information_gain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    estimated_cost TEXT NOT NULL DEFAULT 'Low',
    alternatives JSONB NOT NULL DEFAULT '[]',
    rejected_candidates JSONB NOT NULL DEFAULT '[]',
    target_archetype TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_decisions_inv_id ON planner_decisions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_planner_decisions_created_at ON planner_decisions(created_at);

CREATE TABLE IF NOT EXISTS action_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    decision_id UUID REFERENCES planner_decisions(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    capability TEXT NOT NULL,
    tool TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    assets_before INTEGER NOT NULL DEFAULT 0,
    assets_after INTEGER NOT NULL DEFAULT 0,
    endpoints_before INTEGER NOT NULL DEFAULT 0,
    endpoints_after INTEGER NOT NULL DEFAULT 0,
    parameters_before INTEGER NOT NULL DEFAULT 0,
    parameters_after INTEGER NOT NULL DEFAULT 0,
    findings_before INTEGER NOT NULL DEFAULT 0,
    findings_after INTEGER NOT NULL DEFAULT 0,
    verified_findings_before INTEGER NOT NULL DEFAULT 0,
    verified_findings_after INTEGER NOT NULL DEFAULT 0,
    new_technologies INTEGER NOT NULL DEFAULT 0,
    new_services INTEGER NOT NULL DEFAULT 0,
    execution_duration_ms BIGINT NOT NULL DEFAULT 0,
    exit_status INTEGER,
    error_type TEXT,
    information_gain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_action_executions_inv_id ON action_executions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_action_executions_created_at ON action_executions(created_at);
