use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::models::hunter::Hunter;
use crate::AppState;

pub async fn list_hunters(
    State(state): State<AppState>,
) -> Result<Json<Vec<Hunter>>, (StatusCode, Json<serde_json::Value>)> {
    if !state.has_db() {
        return Ok(Json(vec![]));
    }
    let pool = state.db();
    let hunters = sqlx::query_as::<_, Hunter>("SELECT * FROM hunters ORDER BY created_at ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list hunters: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to list hunters: {e}")})),
            )
        })?;

    Ok(Json(hunters))
}

#[derive(Debug, Deserialize)]
pub struct CreateHunterRequest {
    pub username: String,
    pub display_name: String,
    pub role: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
}

pub async fn create_hunter(
    State(state): State<AppState>,
    Json(payload): Json<CreateHunterRequest>,
) -> Result<Json<Hunter>, (StatusCode, Json<serde_json::Value>)> {
    if !state.has_db() {
        return Err((
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({"error": "Database not connected"})),
        ));
    }
    let pool = state.db();
    let password = payload.password.as_deref().unwrap_or("hunter123");
    let password_hash = crate::auth::password::hash_password(password).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("Password hashing failed: {e}")})),
        )
    })?;
    let role = payload.role.unwrap_or_else(|| "hunter".to_string());

    let hunter = sqlx::query_as::<_, Hunter>(
        r#"INSERT INTO hunters (username, display_name, role, password_hash, email, active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING *"#,
    )
    .bind(payload.username.to_lowercase())
    .bind(payload.display_name)
    .bind(role)
    .bind(password_hash)
    .bind(payload.email)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create hunter: {e}");
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": format!("Failed to create hunter: {e}")})),
        )
    })?;

    Ok(Json(hunter))
}

#[derive(Debug, Deserialize)]
pub struct UpdateHunterRequest {
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub email: Option<String>,
    pub active: Option<bool>,
}

pub async fn update_hunter(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateHunterRequest>,
) -> Result<Json<Hunter>, (StatusCode, Json<serde_json::Value>)> {
    if !state.has_db() {
        return Err((
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({"error": "Database not connected"})),
        ));
    }
    let pool = state.db();
    let hunter = sqlx::query_as::<_, Hunter>(
        r#"UPDATE hunters SET
             display_name = COALESCE($1, display_name),
             role = COALESCE($2, role),
             email = COALESCE($3, email),
             active = COALESCE($4, active)
           WHERE id = $5
           RETURNING *"#,
    )
    .bind(payload.display_name)
    .bind(payload.role)
    .bind(payload.email)
    .bind(payload.active)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update hunter: {e}");
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Hunter not found"})),
        )
    })?;

    Ok(Json(hunter))
}

pub async fn delete_hunter(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    if !state.has_db() {
        return Err((
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({"error": "Database not connected"})),
        ));
    }
    let pool = state.db();
    if id == uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Cannot delete primary admin account"})),
        ));
    }

    sqlx::query("DELETE FROM hunters WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete hunter: {e}");
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Hunter not found"})),
            )
        })?;

    Ok(StatusCode::NO_CONTENT)
}
