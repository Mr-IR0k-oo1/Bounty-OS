use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Url {
    pub id: Uuid,
    pub program_id: Uuid,
    pub subdomain_id: Option<Uuid>,
    pub url: String,
    pub status_code: Option<i32>,
    pub content_type: Option<String>,
    pub content_length: Option<i64>,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
