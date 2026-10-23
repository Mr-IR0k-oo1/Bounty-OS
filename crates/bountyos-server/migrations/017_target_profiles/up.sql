-- Target-Specific Investigation Policies & Profiles (v0.7)
-- Persists normalized target profiles derived from observed evidence.

CREATE TABLE IF NOT EXISTS investigation_target_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    archetype               TEXT NOT NULL,
    technologies            JSONB NOT NULL DEFAULT '[]'::jsonb,
    exposed_services        JSONB NOT NULL DEFAULT '[]'::jsonb,
    application_type        TEXT NOT NULL DEFAULT 'generic',
    authentication_state    TEXT NOT NULL DEFAULT 'unknown',
    api_indicators          BOOLEAN NOT NULL DEFAULT FALSE,
    javascript_heavy        BOOLEAN NOT NULL DEFAULT FALSE,
    historical_url_density  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    evidence                JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence              DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_target_profile_investigation UNIQUE (investigation_id)
);

CREATE INDEX IF NOT EXISTS idx_target_profiles_archetype ON investigation_target_profiles(archetype);
CREATE INDEX IF NOT EXISTS idx_target_profiles_investigation ON investigation_target_profiles(investigation_id);
