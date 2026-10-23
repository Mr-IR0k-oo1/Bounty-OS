-- Migration 020: Graph-Backed Attack Surface Model v0.2
-- Provides normalized graph relationships and provenance tracking across:
-- target -> asset -> dns_record -> ip -> service -> http_service -> endpoint -> parameter -> finding -> evidence

-- 1. DNS Records (DNS resolution & IP mapping)
CREATE TABLE IF NOT EXISTS dns_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    host                    TEXT NOT NULL,
    record_type             TEXT NOT NULL DEFAULT 'A',
    value                   TEXT NOT NULL,
    ttl                     INTEGER,
    source_tool             TEXT NOT NULL DEFAULT 'dnsx',
    job_id                  UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    confidence              REAL NOT NULL DEFAULT 1.0,
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dns_record UNIQUE (investigation_id, host, record_type, value)
);
CREATE INDEX IF NOT EXISTS idx_dns_records_inv ON dns_records(investigation_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_host ON dns_records(host);
CREATE INDEX IF NOT EXISTS idx_dns_records_value ON dns_records(value);

-- 2. HTTP Services (Web applications & probed protocols)
CREATE TABLE IF NOT EXISTS http_services (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    port_id                 UUID REFERENCES ports(id) ON DELETE SET NULL,
    url                     TEXT NOT NULL,
    host                    TEXT NOT NULL,
    port                    INTEGER NOT NULL,
    scheme                  TEXT NOT NULL DEFAULT 'http',
    status_code             INTEGER,
    title                   TEXT,
    web_server              TEXT,
    technologies            JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_tool             TEXT NOT NULL DEFAULT 'httpx',
    job_id                  UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    confidence              REAL NOT NULL DEFAULT 1.0,
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_http_service UNIQUE (investigation_id, url)
);
CREATE INDEX IF NOT EXISTS idx_http_services_inv ON http_services(investigation_id);
CREATE INDEX IF NOT EXISTS idx_http_services_host ON http_services(host);

-- 3. Endpoint Parameters (Granular input surfaces & test history)
CREATE TABLE IF NOT EXISTS endpoint_parameters (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    endpoint_id             UUID REFERENCES urls(id) ON DELETE SET NULL,
    endpoint_url            TEXT NOT NULL,
    name                    TEXT NOT NULL,
    param_location          TEXT NOT NULL DEFAULT 'query',
    example_value           TEXT,
    reflected               BOOLEAN NOT NULL DEFAULT FALSE,
    tested_actions          JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_tool             TEXT NOT NULL DEFAULT 'crawler',
    job_id                  UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    confidence              REAL NOT NULL DEFAULT 1.0,
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_endpoint_parameter UNIQUE (investigation_id, endpoint_url, name, param_location)
);
CREATE INDEX IF NOT EXISTS idx_endpoint_params_inv ON endpoint_parameters(investigation_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_params_url ON endpoint_parameters(endpoint_url);

-- 4. Attack Surface Graph Relationships (Normalized provenance edges)
CREATE TABLE IF NOT EXISTS attack_surface_relationships (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    source_type             TEXT NOT NULL,
    source_id               TEXT NOT NULL,
    source_label            TEXT NOT NULL DEFAULT '',
    target_type             TEXT NOT NULL,
    target_id               TEXT NOT NULL,
    target_label            TEXT NOT NULL DEFAULT '',
    relationship_type       TEXT NOT NULL,
    source_tool             TEXT NOT NULL DEFAULT 'unknown',
    job_id                  UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence              REAL NOT NULL DEFAULT 1.0,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_graph_relationship UNIQUE (investigation_id, source_type, source_id, target_type, target_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_graph_rel_inv ON attack_surface_relationships(investigation_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_source ON attack_surface_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_target ON attack_surface_relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_type ON attack_surface_relationships(relationship_type);
