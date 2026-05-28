pub const MIGRATIONS: &[&str] = &[
    include_str!("migrations/001_hunters.sql"),
    include_str!("migrations/002_projects.sql"),
    include_str!("migrations/003_programs.sql"),
    include_str!("migrations/004_scope.sql"),
    include_str!("migrations/005_subdomains.sql"),
    include_str!("migrations/006_ports_urls.sql"),
    include_str!("migrations/007_findings.sql"),
    include_str!("migrations/008_jobs.sql"),
    include_str!("migrations/009_alerts.sql"),
    include_str!("migrations/010_tokens.sql"),
    include_str!("migrations/011_audit.sql"),
];

pub async fn run_migrations(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        tracing::info!("Running migration {}", i + 1);
        sqlx::query(sql).execute(pool).await?;
    }
    tracing::info!("All migrations completed successfully");
    Ok(())
}
