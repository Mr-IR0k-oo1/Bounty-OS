-- Alert Configurations
CREATE TABLE IF NOT EXISTS alert_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    alert_type      TEXT NOT NULL,
    webhook_url     TEXT,
    channel         TEXT,
    min_severity    TEXT NOT NULL DEFAULT 'medium',
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_program_id ON alert_configs(program_id);
