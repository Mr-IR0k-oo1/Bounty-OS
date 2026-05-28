use crate::config::AppConfig;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;

pub type RedisPool = Arc<redis::Client>;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub redis_pool: RedisPool,
    pub config: AppConfig,
    pub ws_tx: broadcast::Sender<String>,
}
