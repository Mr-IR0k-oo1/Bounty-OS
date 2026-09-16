use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use bountyos_common::ScanStage;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScanJob {
    pub id: Uuid,
    pub program_id: Uuid,
    #[sqlx(try_from = "i32")]
    pub stage: ScanStage,
    pub status: String,
    pub subdomain_id: Option<Uuid>,
    pub target: Option<String>,
    pub flags: Option<serde_json::Value>,
    pub error_log: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
