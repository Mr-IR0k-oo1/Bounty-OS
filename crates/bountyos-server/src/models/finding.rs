use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

pub use bountyos_common::types::{FindingStatus, Severity as FindingSeverity};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Finding {
    pub id: Uuid,
    pub program_id: Uuid,
    pub subdomain_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub severity: String,
    pub status: String,
    pub finding_type: String,
    pub matched_at: Option<String>,
    pub curl_command: Option<String>,
    pub tags: Vec<String>,
    pub assigned_to: Option<Uuid>,
    pub cvss_score: Option<f32>,
    pub kanban_column: Option<String>,
    pub duplicate_of: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub llm_triage_json: Option<serde_json::Value>,
    pub llm_confidence: Option<f64>,
    pub llm_triaged_at: Option<DateTime<Utc>>,
}
