use axum::extract::{Query, State};
use axum::Json;
use axum::http::StatusCode;
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
pub struct ListPortsParams {
    program_id: Option<Uuid>,
    subdomain_id: Option<Uuid>,
}

pub async fn list_ports(
    State(_state): State<AppState>,
    Query(_params): Query<ListPortsParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "Not implemented"})),
    ))
}
