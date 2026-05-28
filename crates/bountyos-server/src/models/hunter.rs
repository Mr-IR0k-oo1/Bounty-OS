use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Hunter {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub password_hash: String,
    pub totp_secret: Option<String>,
    pub totp_enabled: bool,
    pub discord_webhook: Option<String>,
    pub slack_webhook: Option<String>,
    pub email: Option<String>,
    pub active: bool,
    pub last_login: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
