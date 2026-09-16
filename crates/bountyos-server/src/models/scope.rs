use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScopeTarget {
    pub id: Uuid,
    pub program_id: Uuid,
    pub target: String,
    pub target_type: String,
    pub out_of_scope: bool,
    pub source: Option<String>,
    pub added_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
