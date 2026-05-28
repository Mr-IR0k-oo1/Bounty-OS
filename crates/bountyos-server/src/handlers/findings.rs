use axum::extract::{Path, Query, State};
use axum::Json;
use axum::http::StatusCode;
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
pub struct ListFindingsParams {
    program_id: Option<Uuid>,
    severity: Option<String>,
    status: Option<String>,
    unassigned: Option<bool>,
}

pub async fn list_findings(
    State(_state): State<AppState>,
    Query(_params): Query<ListFindingsParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn get_finding(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn update_finding(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
    Json(_body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn claim_finding(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn validate_finding(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn report_finding(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn list_project_findings(
    State(_state): State<AppState>,
    Path(_project_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn list_program_findings(
    State(_state): State<AppState>,
    Path(_program_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}

pub async fn move_finding_kanban(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
    Json(_body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}
