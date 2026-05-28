use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Url {
    pub id: Uuid,
    pub subdomain_id: Uuid,
    pub url: String,
    pub method: String,
    pub status_code: Option<i32>,
    pub content_length: Option<i32>,
    pub source: Option<String>,
    pub params: serde_json::Value,
    pub found_at: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}
