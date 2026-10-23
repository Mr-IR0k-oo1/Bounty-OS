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
    let admin_exists: (bool,) = sqlx::query_as("SELECT EXISTS(SELECT 1 FROM hunters WHERE LOWER(username) = 'admin')")
        .fetch_one(pool)
        .await?;

    if !admin_exists.0 {
        tracing::info!("Admin hunter missing: seeding initial admin hunter");
        let admin_hash = crate::auth::password::hash_password("admin")
            .unwrap_or_else(|_| "$argon2id$v=19$m=65536,t=3,p=1$fake$fake".to_string());

        sqlx::query(
            r#"INSERT INTO hunters (id, username, display_name, role, password_hash, email, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET active = true, role = 'admin'"#,
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
    } else {
        // Ensure admin user is marked active
        let _ = sqlx::query("UPDATE hunters SET active = true WHERE LOWER(username) = 'admin' AND active = false")
            .execute(pool)
            .await;
    }

    Ok(())
}

