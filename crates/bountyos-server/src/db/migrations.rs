pub const MIGRATIONS: &[(&str, &str)] = &[
    ("001_hunters", include_str!("migrations/001_hunters.sql")),
    ("002_projects", include_str!("migrations/002_projects.sql")),
    ("003_programs", include_str!("migrations/003_programs.sql")),
    ("004_scope", include_str!("migrations/004_scope.sql")),
    (
        "005_subdomains",
        include_str!("migrations/005_subdomains.sql"),
    ),
    (
        "006_ports_urls",
        include_str!("migrations/006_ports_urls.sql"),
    ),
    ("007_findings", include_str!("migrations/007_findings.sql")),
    ("008_jobs", include_str!("migrations/008_jobs.sql")),
    ("009_alerts", include_str!("migrations/009_alerts.sql")),
    ("010_tokens", include_str!("migrations/010_tokens.sql")),
    ("011_audit", include_str!("migrations/011_audit.sql")),
    (
        "012_llm_triage",
        include_str!("migrations/012_llm_triage.sql"),
    ),
];

pub async fn run_migrations(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
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
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );",
    )
    .execute(pool)
    .await?;

    for (i, (description, sql)) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        let applied: Option<i64> =
            sqlx::query_scalar("SELECT version FROM sqlx_migrations WHERE version = $1")
                .bind(version)
                .fetch_optional(pool)
                .await?;

        if applied.is_none() {
            tracing::info!("Running migration {}: {}", version, description);
            use sqlx::Executor;
            let start = std::time::Instant::now();
            pool.execute(*sql).await?;
            let elapsed_ms = start.elapsed().as_millis() as i64;

            sqlx::query(
                "INSERT INTO sqlx_migrations (version, description, execution_time) VALUES ($1, $2, $3)",
            )
            .bind(version)
            .bind(description)
            .bind(elapsed_ms)
            .execute(pool)
            .await?;

            sqlx::query(
                "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
            )
            .bind(version as i32)
            .execute(pool)
            .await?;
        }
    }
    tracing::info!("All migrations completed successfully");
    Ok(())
}
