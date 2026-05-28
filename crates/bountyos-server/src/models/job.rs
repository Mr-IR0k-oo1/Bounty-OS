use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScanJob {
    pub id: Uuid,
    pub program_id: Uuid,
    pub stage: i32,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub triggered_by: Option<Uuid>,
    pub triggered_by_scheduler: bool,
    pub tool: Option<String>,
    pub script_path: Option<String>,
    pub output_path: Option<String>,
    pub findings_count: i32,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}
