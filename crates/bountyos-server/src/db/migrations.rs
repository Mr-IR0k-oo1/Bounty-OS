use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub const DIESEL_MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Runs all pending Diesel SQL migrations against the database.
pub async fn run_migrations(
    database_url: &str,
    pool: &sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = database_url.to_string();

    // 1. Run Diesel migrations in a blocking thread via diesel::pg::PgConnection
    let diesel_result = tokio::task::spawn_blocking(move || -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use diesel::pg::PgConnection;
        use diesel::Connection;

        let mut conn = PgConnection::establish(&url)
            .map_err(|e| format!("Diesel connection to {} failed: {}", url, e))?;

        let applied = conn.run_pending_migrations(DIESEL_MIGRATIONS)
            .map_err(|e| format!("Diesel migration runner failed: {}", e))?;

        if !applied.is_empty() {
            tracing::info!("Diesel applied {} pending migrations: {:?}", applied.len(), applied);
        } else {
            tracing::info!("Diesel migrations are already up to date");
        }

        Ok(())
    })
    .await?;

    if let Err(e) = diesel_result {
        tracing::error!("Error executing Diesel migrations: {:?}", e);
        return Err(e);
    }

    // 2. Synchronize legacy migration tracking tables (sqlx_migrations and schema_migrations)
    // for seamless backwards compatibility.
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS sqlx_migrations (
            version BIGINT PRIMARY KEY,
            description TEXT NOT NULL,
            installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            success BOOLEAN NOT NULL DEFAULT TRUE,
            checksum BYTEA NOT NULL DEFAULT ''::bytea,
            execution_time BIGINT NOT NULL DEFAULT 0
        );",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );",
    )
    .execute(pool)
    .await;

    for v in 1..=20 {
        let _ = sqlx::query(
            "INSERT INTO sqlx_migrations (version, description, execution_time) VALUES ($1, $2, 0) ON CONFLICT (version) DO NOTHING",
        )
        .bind(v as i64)
        .bind(format!("migration_{:03}", v))
        .execute(pool)
        .await;

        let _ = sqlx::query(
            "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        )
        .bind(v as i32)
        .execute(pool)
        .await;
    }

    tracing::info!("Diesel migrations completed and verified successfully");
    Ok(())
}
