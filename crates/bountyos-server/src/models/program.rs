use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Program {
    pub id: Uuid,
    pub project_id: Uuid,
    pub slug: String,
    pub name: String,
    pub platform: String,
    pub program_url: Option<String>,
    pub status: String,
    pub bounty_range_low: Option<i32>,
    pub bounty_range_high: Option<i32>,
    pub currency: String,
    pub active_approved: bool,
    pub notes: Option<String>,
    pub rescan_interval_hrs: i32,
    pub last_scanned_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
