//! Program handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{app::AppState, models::program::Program};

/// List all programs for a project
pub async fn list_programs(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Program>>, StatusCode> {
    let programs = sqlx::query_as!(
        Program,
        r#"SELECT * FROM programs WHERE project_id = $1 ORDER BY created_at DESC"#,
        project_id,
    )
    .fetch_all(&state.db_pool)
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
    pub bounty_range_low: Option<i32>,
    pub bounty_range_high: Option<i32>,
    pub currency: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_program(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateProgramRequest>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as!(
        Program,
        r#"INSERT INTO programs (
            project_id, name, platform, program_url,
            bounty_range_low, bounty_range_high, currency, notes, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) RETURNING *"#,
        project_id,
        payload.name,
        payload.platform,
        payload.program_url,
        payload.bounty_range_low,
        payload.bounty_range_high,
        payload.currency,
        payload.notes,
        // TODO: Get the current user ID from the request
        Uuid::new_v4(), // Placeholder
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(program))
}

/// Get a specific program
pub async fn get_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as!(
        Program,
        r#"SELECT * FROM programs WHERE id = $1"#,
        id,
    )
    .fetch_one(&state.db_pool)
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
    pub status: Option<String>,
    pub bounty_range_low: Option<i32>,
    pub bounty_range_high: Option<i32>,
    pub currency: Option<String>,
    pub active_approved: Option<bool>,
    pub notes: Option<String>,
    pub rescan_interval_hrs: Option<i32>,
}

pub async fn update_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProgramRequest>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as!(
        Program,
        r#"UPDATE programs SET
            name = COALESCE($1, name),
            platform = COALESCE($2, platform),
            program_url = COALESCE($3, program_url),
            status = COALESCE($4, status),
            bounty_range_low = COALESCE($5, bounty_range_low),
            bounty_range_high = COALESCE($6, bounty_range_high),
            currency = COALESCE($7, currency),
            active_approved = COALESCE($8, active_approved),
            notes = COALESCE($9, notes),
            rescan_interval_hrs = COALESCE($10, rescan_interval_hrs)
         WHERE id = $11
         RETURNING *"#,
        payload.name,
        payload.platform,
        payload.program_url,
        payload.status,
        payload.bounty_range_low,
        payload.bounty_range_high,
        payload.currency,
        payload.active_approved,
        payload.notes,
        payload.rescan_interval_hrs,
        id,
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(program))
}

/// Delete a program
pub async fn delete_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"DELETE FROM programs WHERE id = $1"#,
        id,
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Approve a program for active scanning
pub async fn approve_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    let program = sqlx::query_as!(
        Program,
        r#"UPDATE programs SET active_approved = true WHERE id = $1 RETURNING *"#,
        id,
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(program))
}

/// Scan a program
pub async fn scan_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // TODO: Implement program scanning logic
    // This would typically queue a job in Redis and return immediately
    Ok(StatusCode::ACCEPTED)
}
