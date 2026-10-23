-- Ars0n Framework Capability Integration (Phases 5-15)
-- Extends Bounty OS PostgreSQL schema with normalized entities for:
-- API discovery, GraphQL, Secret candidates, Request flows, Identities, Threat models, Education lessons.

-- 1. Secret Candidates (redacted display with hash deduplication)
CREATE TABLE IF NOT EXISTS secret_candidates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    target                  TEXT NOT NULL,
    secret_type             TEXT NOT NULL,
    redacted_value          TEXT NOT NULL,
    raw_hash                TEXT NOT NULL,
    file_path               TEXT NOT NULL,
    line                    INT,
    verified                BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_secret_candidates_inv ON secret_candidates(investigation_id);
CREATE INDEX IF NOT EXISTS idx_secret_candidates_hash ON secret_candidates(raw_hash);

-- 2. API Endpoints
CREATE TABLE IF NOT EXISTS api_endpoints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    url                     TEXT NOT NULL,
    path                    TEXT NOT NULL,
    method                  TEXT NOT NULL DEFAULT 'GET',
    version                 TEXT,
    auth_required           BOOLEAN NOT NULL DEFAULT FALSE,
    is_doc                  BOOLEAN NOT NULL DEFAULT FALSE,
    parameters              JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_api_endpoint UNIQUE (investigation_id, path, method)
);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_inv ON api_endpoints(investigation_id);

-- 3. GraphQL Assets
CREATE TABLE IF NOT EXISTS graphql_assets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    endpoint                TEXT NOT NULL,
    engine                  TEXT,
    introspection_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    schema_hash             TEXT,
    operations              JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_graphql_endpoint UNIQUE (investigation_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_graphql_assets_inv ON graphql_assets(investigation_id);

-- 4. Auth Identities & Authorization Boundaries
CREATE TABLE IF NOT EXISTS auth_identities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    label                   TEXT NOT NULL,
    role                    TEXT NOT NULL DEFAULT 'user',
    token_redacted          TEXT NOT NULL,
    session_metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_inv ON auth_identities(investigation_id);

-- 5. Request Flows (Controlled repeater & replay engine)
CREATE TABLE IF NOT EXISTS request_flows (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    target_url              TEXT NOT NULL,
    method                  TEXT NOT NULL DEFAULT 'GET',
    headers                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    body                    TEXT,
    mutations               JSONB NOT NULL DEFAULT '[]'::jsonb,
    dry_run                 BOOLEAN NOT NULL DEFAULT FALSE,
    last_status             INT,
    last_replay_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_request_flows_inv ON request_flows(investigation_id);

-- 6. Threat Models (STRIDE classification: Observed, Inferred, Hypothesized, Verified)
CREATE TABLE IF NOT EXISTS threat_models (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    asset                   TEXT NOT NULL,
    stride_category         TEXT NOT NULL,
    threat_title            TEXT NOT NULL,
    threat_description      TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'Hypothesized',
    evidence                JSONB NOT NULL DEFAULT '[]'::jsonb,
    mitigation              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threat_models_inv ON threat_models(investigation_id);
CREATE INDEX IF NOT EXISTS idx_threat_models_stride ON threat_models(stride_category);

-- 7. Education Lessons ("Help Me Learn" layer)
CREATE TABLE IF NOT EXISTS education_lessons (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    stage                   TEXT NOT NULL,
    recommended_action      TEXT NOT NULL,
    reason                  TEXT NOT NULL,
    evidence_requirements   TEXT NOT NULL,
    learning_objective      TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_education_lessons_inv ON education_lessons(investigation_id);
