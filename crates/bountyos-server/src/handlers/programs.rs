//! Program handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{models::program::Program, state::AppState};

/// List all programs across projects
pub async fn list_all_programs(
    State(state): State<AppState>,
) -> Result<Json<Vec<Program>>, StatusCode> {
    if state.has_db() {
        if let Ok(programs) = sqlx::query_as::<_, Program>(
            r#"SELECT * FROM programs ORDER BY created_at DESC"#,
        )
        .fetch_all(state.db())
        .await
        {
            return Ok(Json(programs));
        }
    }

    let programs = state.in_memory_programs().read().await.clone();
    Ok(Json(programs))
}

/// List all programs for a project
pub async fn list_programs(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Program>>, StatusCode> {
    if state.has_db() {
        if let Ok(programs) = sqlx::query_as::<_, Program>(
            r#"SELECT * FROM programs WHERE project_id = $1 ORDER BY created_at DESC"#,
        )
        .bind(project_id)
        .fetch_all(state.db())
        .await
        {
            return Ok(Json(programs));
        }
    }

    let lock = state.in_memory_programs().read().await;
    let filtered: Vec<Program> = lock
        .iter()
        .filter(|p| p.project_id == project_id)
        .cloned()
        .collect();
    Ok(Json(filtered))
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

    if state.has_db() {
        if let Ok(program) = sqlx::query_as::<_, Program>(
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
        {
            return Ok(Json(program));
        }
    }

    let program = Program {
        id: Uuid::new_v4(),
        project_id,
        name: payload.name,
        slug,
        platform,
        program_url: payload.program_url,
        active: true,
        active_approved: false,
        rescan_interval_hrs,
        notes: payload.notes,
        created_by,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let mut lock = state.in_memory_programs().write().await;
    lock.insert(0, program.clone());
    Ok(Json(program))
}

/// Get a specific program
pub async fn get_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    if state.has_db() {
        match sqlx::query_as::<_, Program>(r#"SELECT * FROM programs WHERE id = $1"#)
            .bind(id)
            .fetch_one(state.db())
            .await
        {
            Ok(program) => return Ok(Json(program)),
            Err(sqlx::Error::RowNotFound) => return Err(StatusCode::NOT_FOUND),
            Err(_) => {}
        }
    }

    let lock = state.in_memory_programs().read().await;
    if let Some(p) = lock.iter().find(|p| p.id == id) {
        return Ok(Json(p.clone()));
    }

    Err(StatusCode::NOT_FOUND)
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

    if state.has_db() {
        match sqlx::query_as::<_, Program>(
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
        {
            Ok(program) => return Ok(Json(program)),
            Err(sqlx::Error::RowNotFound) => return Err(StatusCode::NOT_FOUND),
            Err(_) => {}
        }
    }

    let mut lock = state.in_memory_programs().write().await;
    if let Some(p) = lock.iter_mut().find(|p| p.id == id) {
        if let Some(name) = payload.name {
            p.name = name;
        }
        if let Some(platform) = payload.platform {
            p.platform = platform;
        }
        if let Some(url) = payload.program_url {
            p.program_url = Some(url);
        }
        if let Some(active) = is_active {
            p.active = active;
        }
        if let Some(approved) = payload.active_approved {
            p.active_approved = approved;
        }
        if let Some(notes) = payload.notes {
            p.notes = Some(notes);
        }
        if let Some(interval) = payload.rescan_interval_hrs {
            p.rescan_interval_hrs = interval;
        }
        p.updated_at = chrono::Utc::now();
        return Ok(Json(p.clone()));
    }

    Err(StatusCode::NOT_FOUND)
}

/// Delete a program
pub async fn delete_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if state.has_db() {
        let _ = sqlx::query(r#"DELETE FROM programs WHERE id = $1"#)
            .bind(id)
            .execute(state.db())
            .await;
    }

    let mut lock = state.in_memory_programs().write().await;
    let initial_len = lock.len();
    lock.retain(|p| p.id != id);

    if !state.has_db() && lock.len() == initial_len {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Approve a program for active scanning
pub async fn approve_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Program>, StatusCode> {
    if state.has_db() {
        if let Ok(program) = sqlx::query_as::<_, Program>(
            r#"UPDATE programs SET active_approved = true, updated_at = NOW() WHERE id = $1 RETURNING *"#,
        )
        .bind(id)
        .fetch_one(state.db())
        .await
        {
            return Ok(Json(program));
        }
    }

    let mut lock = state.in_memory_programs().write().await;
    if let Some(p) = lock.iter_mut().find(|p| p.id == id) {
        p.active_approved = true;
        p.updated_at = chrono::Utc::now();
        return Ok(Json(p.clone()));
    }

    Err(StatusCode::NOT_FOUND)
}

/// Scan a program
pub async fn scan_program(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let program = if state.has_db() {
        sqlx::query_as::<_, Program>(r#"SELECT * FROM programs WHERE id = $1"#)
            .bind(id)
            .fetch_optional(state.db())
            .await
            .ok()
            .flatten()
    } else {
        let lock = state.in_memory_programs().read().await;
        lock.iter().find(|p| p.id == id).cloned()
    };

    let program = match program {
        Some(p) => p,
        None => return Err(StatusCode::NOT_FOUND),
    };

    // Precondition: Active scanning requires explicit approval safeguard
    if !program.active_approved {
        return Err(StatusCode::PRECONDITION_REQUIRED);
    }

    Ok(StatusCode::ACCEPTED)
}
