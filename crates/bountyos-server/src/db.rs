//! Database connection and pool management

pub mod migrations;

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

/// Initialize the database connection pool
pub async fn init_db_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(3))
        .connect(database_url)
        .await
}
