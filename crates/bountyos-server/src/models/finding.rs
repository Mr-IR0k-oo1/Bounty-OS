use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Finding {
    pub id: Uuid,
    pub program_id: Uuid,
    pub subdomain_id: Option<Uuid>,
    pub url_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub template_id: Option<String>,
    pub template_name: Option<String>,
    pub tool: Option<String>,
    pub severity: String,
    pub cvss_score: Option<f64>,
    pub cve_id: Option<String>,
    pub request: Option<String>,
    pub response: Option<String>,
    pub curl_command: Option<String>,
    pub evidence_paths: serde_json::Value,
    pub screenshot_path: Option<String>,
    pub status: String,
    pub assigned_to: Option<Uuid>,
    pub found_at: DateTime<Utc>,
    pub triaged_at: Option<DateTime<Utc>>,
    pub validated_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub bounty_amount: Option<f64>,
    pub notes: Option<String>,
    pub report_path: Option<String>,
    pub dedup_hash: Option<String>,
}
