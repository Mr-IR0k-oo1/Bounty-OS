ALTER TABLE findings
    DROP COLUMN IF EXISTS llm_triage_json,
    DROP COLUMN IF EXISTS llm_confidence,
    DROP COLUMN IF EXISTS llm_triaged_at;
DROP INDEX IF EXISTS idx_findings_llm_triaged_at;
DROP INDEX IF EXISTS idx_findings_llm_confidence;
