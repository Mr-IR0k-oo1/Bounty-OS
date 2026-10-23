-- API Tokens
CREATE TABLE IF NOT EXISTS api_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunter_id       UUID NOT NULL REFERENCES hunters(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    name            TEXT NOT NULL,
    scopes          TEXT[] DEFAULT '{}',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hunter_id ON api_tokens(hunter_id);
