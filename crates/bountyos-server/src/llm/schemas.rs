//! Serde types for the VulnLLM-R-7B triage contract.
//!
//! The split is intentional:
//!   TriageInput  — what BountyOS sends to the model
//!   TriageOutput — what the model must return (JSON-constrained by system prompt)
//!
//! Both are stored to disk alongside findings evidence for auditability.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Input — structured evidence bundle sent to the model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageInput {
    /// Scan run identifier (e.g. job UUID or timestamp string)
    pub run_id: String,
    /// The finding being triaged
    pub finding_id: Uuid,
    pub asset: AssetContext,
    pub endpoint: EndpointContext,
    /// What tools observed (discovery + detection events)
    pub observations: Vec<Observation>,
    /// References to raw evidence files on disk
    pub evidence: Vec<EvidenceRef>,
    /// Timestamp this input was built
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetContext {
    pub host: String,
    pub url: String,
    pub program_name: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointContext {
    pub method: String,
    pub path: String,
    pub query_parameters: Vec<String>,
    pub status_code: Option<i32>,
    pub content_length: Option<i64>,
    pub technologies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub source: String,           // e.g. "nuclei", "katana", "manual"
    pub observation_type: String, // e.g. "endpoint_discovery", "vuln_template_match"
    pub detail: Option<String>,
    pub template_id: Option<String>,
    pub template_name: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRef {
    pub evidence_type: String, // "http_request", "http_response", "screenshot", "nuclei_output"
    pub location: String,      // relative path under evidence/
    pub snippet: Option<String>, // first 2 KB of content, pre-loaded for context
}

// ---------------------------------------------------------------------------
// Output — what the model returns
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageOutput {
    /// Vulnerability class (e.g. "IDOR", "XSS", "SSRF", "info_disclosure")
    pub finding_type: String,
    /// Model's confidence in the classification, 0.0–1.0
    pub confidence: f64,
    /// Model's recommended severity: critical | high | medium | low | info | fp
    pub severity: String,
    /// Which evidence items the model actually used
    pub evidence_used: Vec<String>,
    /// 2–4 sentence plain-English reasoning for a human reviewer
    pub reasoning_summary: String,
    /// What additional evidence would increase confidence
    pub missing_evidence: Vec<String>,
    /// Specific manual verification steps the hunter should perform
    pub recommended_manual_verification: Vec<String>,
    /// Whether the model thinks this warrants immediate escalation
    pub escalate: bool,
}

impl TriageOutput {
    /// Returns true if the confidence meets a threshold worth showing prominently
    pub fn is_high_confidence(&self) -> bool {
        self.confidence >= 0.70
    }

    /// Clamps confidence to 0.0–1.0 in case the model hallucinates out of range
    pub fn sanitized_confidence(&self) -> f64 {
        self.confidence.clamp(0.0, 1.0)
    }
}

// ---------------------------------------------------------------------------
// DB row representation (what we store / retrieve)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingTriageRecord {
    pub finding_id: Uuid,
    pub llm_triage_json: serde_json::Value,
    pub llm_confidence: Option<f64>,
    pub llm_triaged_at: Option<DateTime<Utc>>,
}
