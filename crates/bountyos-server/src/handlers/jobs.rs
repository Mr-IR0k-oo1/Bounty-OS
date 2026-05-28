use axum::extract::{Path, Query, State};
use axum::Json;
use axum::http::StatusCode;
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
pub struct ListJobsParams {
    program_id: Option<Uuid>,
}

pub async fn list_jobs(
    State(_state): State<AppState>,
    Query(_params): Query<ListJobsParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn list_program_jobs(
    State(_state): State<AppState>,
    Path(_program_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn get_job(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn cancel_job(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}
