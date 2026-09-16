//! Project handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{models::project::Project, state::AppState};

/// List all projects
pub async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, StatusCode> {
    let projects =
        sqlx::query_as::<_, Project>(r#"SELECT * FROM projects ORDER BY created_at DESC"#)
            .fetch_all(state.db())
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(projects))
}

/// Create a new project
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
}

pub async fn create_project(
    State(state): State<AppState>,
    user_id_ext: Option<axum::extract::Extension<Uuid>>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<Project>, StatusCode> {
    let created_by = user_id_ext.map(|axum::extract::Extension(id)| id);
    let project = sqlx::query_as::<_, Project>(
        r#"INSERT INTO projects (name, description, start_date, end_date, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *"#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(created_by)
    .fetch_one(state.db())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(project))
}

/// Get a specific project
pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, StatusCode> {
    let project = sqlx::query_as::<_, Project>(r#"SELECT * FROM projects WHERE id = $1"#)
        .bind(id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(project))
}

/// Update a project
#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub active: Option<bool>,
    pub status: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, StatusCode> {
    let is_active = payload
        .active
        .or_else(|| payload.status.as_deref().map(|s| s == "active"));

    let project = sqlx::query_as::<_, Project>(
        r#"UPDATE projects SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         active = COALESCE($3, active),
         start_date = COALESCE($4, start_date),
         end_date = COALESCE($5, end_date),
         updated_at = NOW()
         WHERE id = $6
         RETURNING *"#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(is_active)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(id)
    .fetch_one(state.db())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(project))
}

/// Delete a project
pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(r#"DELETE FROM projects WHERE id = $1"#)
        .bind(id)
        .execute(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

// Additional project-related handlers would go here...
