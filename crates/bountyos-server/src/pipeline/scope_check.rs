use sqlx::PgPool;
use uuid::Uuid;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScopeError {
    #[error("Target {0} is out of scope for program {1}")]
    OutOfScope(String, Uuid),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Stage validation failed: program {0} stage {1} not approved")]
    StageNotApproved(Uuid, i32),
}

pub async fn is_target_in_scope(
    target: &str,
    program_id: Uuid,
    pool: &PgPool,
) -> Result<bool, ScopeError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scope_targets WHERE program_id = $1 AND target = $2 AND out_of_scope = false"
    )
    .bind(program_id)
    .bind(target)
    .fetch_one(pool)
    .await?;

    if count == 0 {
        let oos_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scope_targets WHERE program_id = $1 AND target = $2 AND out_of_scope = true"
        )
        .bind(program_id)
        .bind(target)
        .fetch_one(pool)
        .await?;

        if oos_count > 0 {
            return Err(ScopeError::OutOfScope(target.to_string(), program_id));
        }
    }

    Ok(count > 0)
}

pub async fn validate_scan_stage(
    program_id: Uuid,
    stage: i32,
    pool: &PgPool,
) -> Result<bool, ScopeError> {
    if stage >= 3 {
        let approved: bool = sqlx::query_scalar(
            "SELECT active_approved FROM programs WHERE id = $1"
        )
        .bind(program_id)
        .fetch_one(pool)
        .await?;

        if !approved {
            return Err(ScopeError::StageNotApproved(program_id, stage));
        }
    }
    Ok(true)
}
