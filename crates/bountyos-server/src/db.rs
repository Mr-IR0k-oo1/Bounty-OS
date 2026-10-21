//! Database connection and pool management

pub mod migrations;

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

/// Initialize the database connection pool
pub async fn init_db_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(2))
        .connect(database_url)
        .await
}

/// Initialize the database connection pool lazily
pub fn init_lazy_db_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(2))
        .connect_lazy(database_url)
}

/// Seed initial admin hunter and default projects if the database is newly initialized
pub async fn seed_defaults_if_empty(pool: &PgPool) -> Result<(), sqlx::Error> {
    let hunter_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM hunters")
        .fetch_one(pool)
        .await?;

    if hunter_count.0 == 0 {
        tracing::info!("Database is empty: seeding initial admin hunter");
        let admin_hash = crate::auth::password::hash_password("admin")
            .unwrap_or_else(|_| "$argon2id$v=19$m=65536,t=3,p=1$fake$fake".to_string());

        sqlx::query(
            r#"INSERT INTO hunters (id, username, display_name, role, password_hash, email, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (username) DO NOTHING"#,
        )
        .bind(uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
        .bind("admin")
        .bind("Admin Hunter")
        .bind("admin")
        .bind(&admin_hash)
        .bind("admin@bountyos.local")
        .bind(true)
        .execute(pool)
        .await?;
    }

    Ok(())
}

