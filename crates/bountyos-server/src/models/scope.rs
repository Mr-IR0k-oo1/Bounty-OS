use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScopeTarget {
    pub id: Uuid,
    pub program_id: Uuid,
    pub target_type: String,
    pub target_value: String,
    pub in_scope: bool,
    pub notes: Option<String>,
    pub added_by: Option<Uuid>,
    pub added_at: DateTime<Utc>,
}
