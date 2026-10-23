-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT UNIQUE NOT NULL,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    active          BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES hunters(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
