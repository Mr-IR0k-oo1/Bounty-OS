use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Subdomain {
    pub id: Uuid,
    pub program_id: Uuid,
    pub root_domain: String,
    pub subdomain: String,
    pub ip_address: Option<String>,
    pub status_code: Option<i32>,
    pub title: Option<String>,
    pub web_server: Option<String>,
    pub tech_stack: serde_json::Value,
    pub cdn: bool,
    pub cdn_provider: Option<String>,
    pub is_new: bool,
    pub is_alive: bool,
    pub screenshot_path: Option<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}
