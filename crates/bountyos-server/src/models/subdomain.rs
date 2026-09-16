use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Subdomain {
    pub id: Uuid,
    pub program_id: Uuid,
    pub subdomain: String,
    pub ip_address: Option<String>,
    pub status_code: Option<i32>,
    pub title: Option<String>,
    pub web_server: Option<String>,
    pub content_type: Option<String>,
    pub content_length: Option<i64>,
    pub tech: Vec<String>,
    pub cdn_name: Option<String>,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
