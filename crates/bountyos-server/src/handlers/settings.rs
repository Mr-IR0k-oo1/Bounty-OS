use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;

use crate::AppState;
use crate::pipeline::tools::ToolRegistry;

pub async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tools = ToolRegistry::check_all().await;
    Ok(Json(serde_json::json!({
        "tools": tools,
        "max_concurrent_jobs": state.config().max_concurrent_jobs,
        "evidence_base_path": state.evidence_base().to_string_lossy(),
    })))
}

pub async fn update_settings(
    State(_state): State<AppState>,
    Json(_body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    Ok(Json(serde_json::json!({"status": "updated"})))
}

pub async fn check_tools(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tools = ToolRegistry::check_all().await;
    Ok(Json(serde_json::json!(tools)))
}

