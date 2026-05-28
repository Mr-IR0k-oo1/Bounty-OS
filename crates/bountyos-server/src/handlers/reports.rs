use axum::extract::{Path, State};
use axum::Json;
use axum::http::StatusCode;
use uuid::Uuid;

use crate::AppState;

pub async fn generate_report(
    State(_state): State<AppState>,
    Path(_program_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}
