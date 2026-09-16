//! Program handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{models::program::Program, state::AppState};

/// List all programs for a project
pub async fn list_programs(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Program>>, StatusCode> {
    let programs = sqlx::query_as::<_, Program>(
        r#"SELECT * FROM programs WHERE project_id = $1 ORDER BY created_at DESC"#,
    )
    .bind(project_id)
    .fetch_all(state.db())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(programs))
}

/// Create a new program
#[derive(Debug, Deserialize)]
pub struct CreateProgramRequest {
    pub name: String,
    pub platform: Option<String>,
    pub program_url: Option<String>,
    pub notes: Option<String>,
    pub rescan_interval_hrs: Option<i32>,
}

pub async fn create_program(
    State(state): State<AppState>,
    user_id_ext: Option<axum::extract::Extension<Uuid>>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateProgramRequest>,
) -> Result<Json<Program>, StatusCode> {
    let created_by = user_id_ext.map(|axum::extract::Extension(id)| id);
    let slug = payload.name.to_lowercase().replace(' ', "-");
    let platform = payload.platform.unwrap_or_else(|| "other".to_string());
    let rescan_interval_hrs = payload.rescan_interval_hrs.unwrap_or(24);

    let program = sqlx::query_as::<_, Program>(
        r#"INSERT INTO programs (
            project_id, name, slug, platform, program_url, notes, rescan_interval_hrs, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *"#,
    )
    .bind(project_id)
    .bind(&payload.name)
    .bind(&slug)
    .bind(&platform)
    .bind(&payload.program_url)
    .bind(&payload.notes)
    .bind(rescan_interval_hrs)
    .bind(created_by)
    .fetch_one(state.db())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create program: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(program))
}

/// Get a specific program
pub async fn get_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as::<_, Program>(r#"SELECT * FROM programs WHERE id = $1"#)
        .bind(id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(program))
}

/// Update a program
#[derive(Debug, Deserialize)]
pub struct UpdateProgramRequest {
    pub name: Option<String>,
    pub platform: Option<String>,
    pub program_url: Option<String>,
    pub active: Option<bool>,
    pub status: Option<String>,
    pub active_approved: Option<bool>,
    pub notes: Option<String>,
    pub rescan_interval_hrs: Option<i32>,
}

pub async fn update_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProgramRequest>,
) -> Result<Json<Program>, StatusCode> {
    let is_active = payload
        .active
        .or_else(|| payload.status.as_deref().map(|s| s == "active"));

    let program = sqlx::query_as::<_, Program>(
        r#"UPDATE programs SET
            name = COALESCE($1, name),
            platform = COALESCE($2, platform),
            program_url = COALESCE($3, program_url),
            active = COALESCE($4, active),
            active_approved = COALESCE($5, active_approved),
            notes = COALESCE($6, notes),
            rescan_interval_hrs = COALESCE($7, rescan_interval_hrs),
            updated_at = NOW()
         WHERE id = $8
         RETURNING *"#,
    )
    .bind(&payload.name)
    .bind(&payload.platform)
    .bind(&payload.program_url)
    .bind(is_active)
    .bind(payload.active_approved)
    .bind(&payload.notes)
    .bind(payload.rescan_interval_hrs)
    .bind(id)
    .fetch_one(state.db())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update program: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(program))
}

/// Delete a program
pub async fn delete_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(r#"DELETE FROM programs WHERE id = $1"#)
        .bind(id)
        .execute(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Approve a program for active scanning
pub async fn approve_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as::<_, Program>(
        r#"UPDATE programs SET active_approved = true WHERE id = $1 RETURNING *"#,
    )
    .bind(id)
    .fetch_one(state.db())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(program))
}

/// Scan a program
pub async fn scan_program(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // TODO: Implement program scanning logic
    // This would typically queue a job in Redis and return immediately
    Ok(StatusCode::ACCEPTED)
}
