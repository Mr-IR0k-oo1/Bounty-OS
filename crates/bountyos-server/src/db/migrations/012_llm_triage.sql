-- LLM triage columns on findings
-- Stores VulnLLM-R-7B structured analysis alongside human review data.
-- These columns are append-only — they do NOT change finding status.
ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS llm_triage_json  JSONB,
    ADD COLUMN IF NOT EXISTS llm_confidence   DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS llm_triaged_at   TIMESTAMPTZ;


CREATE INDEX IF NOT EXISTS idx_findings_llm_triaged_at ON findings(llm_triaged_at);
CREATE INDEX IF NOT EXISTS idx_findings_llm_confidence ON findings(llm_confidence);
