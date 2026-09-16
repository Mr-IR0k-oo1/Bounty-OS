use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::models::scan_job::ScanJob;
use crate::AppState;

#[derive(Deserialize)]
pub struct ListJobsParams {
    program_id: Option<Uuid>,
}

pub async fn list_jobs(
    State(state): State<AppState>,
    Query(params): Query<ListJobsParams>,
) -> Result<Json<Vec<ScanJob>>, StatusCode> {
    let pool = state.db();
    let jobs =
        match params.program_id {
            Some(pid) => sqlx::query_as::<_, ScanJob>(
                "SELECT * FROM scan_jobs WHERE program_id = $1 ORDER BY created_at DESC LIMIT 100",
            )
            .bind(pid)
            .fetch_all(pool)
            .await,
            None => {
                sqlx::query_as::<_, ScanJob>(
                    "SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT 100",
                )
                .fetch_all(pool)
                .await
            }
        }
        .map_err(|e| {
            tracing::error!("Failed to list jobs: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(jobs))
}

pub async fn list_program_jobs(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Vec<ScanJob>>, StatusCode> {
    let pool = state.db();
    let jobs = sqlx::query_as::<_, ScanJob>(
        "SELECT * FROM scan_jobs WHERE program_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(program_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list program jobs: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(jobs))
}

pub async fn get_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScanJob>, StatusCode> {
    let pool = state.db();
    let job = sqlx::query_as::<_, ScanJob>("SELECT * FROM scan_jobs WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(job))
}

pub async fn cancel_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScanJob>, StatusCode> {
    let pool = state.db();
    let job = sqlx::query_as::<_, ScanJob>(
        "UPDATE scan_jobs SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // Also update redis queue if needed
    let _ = crate::pipeline::queue::update_job_status(state.redis(), id, "cancelled").await;

    Ok(Json(job))
}
