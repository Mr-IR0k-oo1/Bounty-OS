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
    if state.has_db() {
        if let Ok(projects) =
            sqlx::query_as::<_, Project>(r#"SELECT * FROM projects ORDER BY created_at DESC"#)
                .fetch_all(state.db())
                .await
        {
            return Ok(Json(projects));
        }
    }

    let projects = state.in_memory_projects().read().await.clone();
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

    if state.has_db() {
        if let Ok(project) = sqlx::query_as::<_, Project>(
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
        {
            return Ok(Json(project));
        }
    }

    let project = Project {
        id: Uuid::new_v4(),
        name: payload.name,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date,
        active: true,
        created_by,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let mut lock = state.in_memory_projects().write().await;
    lock.insert(0, project.clone());
    Ok(Json(project))
}

/// Get a specific project
pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, StatusCode> {
    if state.has_db() {
        match sqlx::query_as::<_, Project>(r#"SELECT * FROM projects WHERE id = $1"#)
            .bind(id)
            .fetch_one(state.db())
            .await
        {
            Ok(project) => return Ok(Json(project)),
            Err(sqlx::Error::RowNotFound) => return Err(StatusCode::NOT_FOUND),
            Err(_) => {}
        }
    }

    let lock = state.in_memory_projects().read().await;
    if let Some(project) = lock.iter().find(|p| p.id == id) {
        return Ok(Json(project.clone()));
    }

    Err(StatusCode::NOT_FOUND)
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

    if state.has_db() {
        match sqlx::query_as::<_, Project>(
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
        {
            Ok(project) => return Ok(Json(project)),
            Err(sqlx::Error::RowNotFound) => return Err(StatusCode::NOT_FOUND),
            Err(_) => {}
        }
    }

    let mut lock = state.in_memory_projects().write().await;
    if let Some(p) = lock.iter_mut().find(|p| p.id == id) {
        if let Some(name) = payload.name {
            p.name = name;
        }
        if let Some(desc) = payload.description {
            p.description = Some(desc);
        }
        if let Some(active) = is_active {
            p.active = active;
        }
        if let Some(sd) = payload.start_date {
            p.start_date = Some(sd);
        }
        if let Some(ed) = payload.end_date {
            p.end_date = Some(ed);
        }
        p.updated_at = chrono::Utc::now();
        return Ok(Json(p.clone()));
    }

    Err(StatusCode::NOT_FOUND)
}

/// Delete a project
pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if state.has_db() {
        let _ = sqlx::query(r#"DELETE FROM projects WHERE id = $1"#)
            .bind(id)
            .execute(state.db())
            .await;
    }

    let mut lock = state.in_memory_projects().write().await;
    let initial_len = lock.len();
    lock.retain(|p| p.id != id);

    if !state.has_db() && lock.len() == initial_len {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// Additional project-related handlers would go here...
