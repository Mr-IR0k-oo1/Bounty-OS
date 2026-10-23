pub const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_initial_schema",
        include_str!("migrations/001_initial_schema.sql"),
    ),
    (
        "002_evidence_and_hashes",
        include_str!("migrations/002_evidence_and_hashes.sql"),
    ),
    (
        "003_audit_log",
        include_str!("migrations/003_audit_log.sql"),
    ),
    (
        "004_findings_and_scans",
        include_str!("migrations/004_findings_and_scans.sql"),
    ),
    (
        "005_investigation_state",
        include_str!("migrations/005_investigation_state.sql"),
    ),
    (
        "006_verification_runs",
        include_str!("migrations/006_verification_runs.sql"),
    ),
    (
        "007_vulnllm_triage",
        include_str!("migrations/007_vulnllm_triage.sql"),
    ),
    (
        "008_mcp_control_plane",
        include_str!("migrations/008_mcp_control_plane.sql"),
    ),
    (
        "016_global_experience",
        include_str!("migrations/016_global_experience.sql"),
    ),
    (
        "017_target_profiles",
        include_str!("migrations/017_target_profiles.sql"),
    ),
];

pub async fn run_migrations(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    for (name, sql) in MIGRATIONS {
        let applied: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM _migrations WHERE name = $1)")
                .bind(name)
                .fetch_one(pool)
                .await?;

        if !applied {
            tracing::info!("Applying migration: {}", name);
            let mut tx = pool.begin().await?;
            for statement in sql.split(';') {
                let trimmed = statement.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed).execute(&mut *tx).await?;
                }
            }
            sqlx::query("INSERT INTO _migrations (name) VALUES ($1)")
                .bind(name)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            tracing::info!("Applied migration: {}", name);
        }
    }

    Ok(())
}
