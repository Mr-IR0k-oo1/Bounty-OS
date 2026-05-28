use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Port {
    pub id: Uuid,
    pub subdomain_id: Uuid,
    pub port: i32,
    pub protocol: String,
    pub service: Option<String>,
    pub version: Option<String>,
    pub banner: Option<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}
