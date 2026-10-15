use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::models::scope::ScopeTarget;
use crate::AppState;

pub async fn list_scope(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Vec<ScopeTarget>>, StatusCode> {
    if !state.has_db() {
        let scope = state.in_memory_scope().read().await;
        let targets: Vec<ScopeTarget> = scope
            .iter()
            .filter(|s| s.program_id == program_id)
            .cloned()
            .collect();
        return Ok(Json(targets));
    }

    let pool = state.db();
    let targets = sqlx::query_as::<_, ScopeTarget>(
        "SELECT * FROM scope_targets WHERE program_id = $1 ORDER BY created_at ASC",
    )
    .bind(program_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list scope targets: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(targets))
}

#[derive(Debug, Deserialize)]
pub struct AddScopeRequest {
    pub target: String,
    pub target_type: Option<String>,
    pub out_of_scope: Option<bool>,
    pub source: Option<String>,
}

pub async fn add_scope(
    State(state): State<AppState>,
    user_id_ext: Option<axum::extract::Extension<Uuid>>,
    Path(program_id): Path<Uuid>,
    Json(payload): Json<AddScopeRequest>,
) -> Result<Json<ScopeTarget>, StatusCode> {
    let added_by = user_id_ext.map(|axum::extract::Extension(id)| id);
    let target_type = payload.target_type.unwrap_or_else(|| "domain".to_string());
    let out_of_scope = payload.out_of_scope.unwrap_or(false);

    if !state.has_db() {
        let mut scope = state.in_memory_scope().write().await;
        let new_target = ScopeTarget {
            id: Uuid::new_v4(),
            program_id,
            target: payload.target,
            target_type,
            out_of_scope,
            source: payload.source,
            added_by,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        scope.push(new_target.clone());
        return Ok(Json(new_target));
    }

    let pool = state.db();
    let target = sqlx::query_as::<_, ScopeTarget>(
        r#"INSERT INTO scope_targets (program_id, target, target_type, out_of_scope, source, added_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (program_id, target) DO UPDATE SET
            target_type = EXCLUDED.target_type,
            out_of_scope = EXCLUDED.out_of_scope,
            source = EXCLUDED.source,
            updated_at = NOW()
         RETURNING *"#,
    )
    .bind(program_id)
    .bind(&payload.target)
    .bind(&target_type)
    .bind(out_of_scope)
    .bind(&payload.source)
    .bind(added_by)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to add scope target: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(target))
}

#[derive(Debug, Deserialize)]
pub struct UpdateScopeRequest {
    pub target: Option<String>,
    pub target_type: Option<String>,
    pub out_of_scope: Option<bool>,
    pub source: Option<String>,
}

pub async fn update_scope(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateScopeRequest>,
) -> Result<Json<ScopeTarget>, StatusCode> {
    if !state.has_db() {
        let mut scope = state.in_memory_scope().write().await;
        if let Some(s) = scope.iter_mut().find(|s| s.id == id) {
            if let Some(target) = payload.target {
                s.target = target;
            }
            if let Some(tt) = payload.target_type {
                s.target_type = tt;
            }
            if let Some(oos) = payload.out_of_scope {
                s.out_of_scope = oos;
            }
            if let Some(src) = payload.source {
                s.source = Some(src);
            }
            s.updated_at = chrono::Utc::now();
            return Ok(Json(s.clone()));
        }
        return Err(StatusCode::NOT_FOUND);
    }

    let pool = state.db();
    let target = sqlx::query_as::<_, ScopeTarget>(
        r#"UPDATE scope_targets SET
            target = COALESCE($1, target),
            target_type = COALESCE($2, target_type),
            out_of_scope = COALESCE($3, out_of_scope),
            source = COALESCE($4, source),
            updated_at = NOW()
         WHERE id = $5
         RETURNING *"#,
    )
    .bind(&payload.target)
    .bind(&payload.target_type)
    .bind(payload.out_of_scope)
    .bind(&payload.source)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(target))
}

pub async fn delete_scope(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if !state.has_db() {
        let mut scope = state.in_memory_scope().write().await;
        let initial_len = scope.len();
        scope.retain(|s| s.id != id);
        if scope.len() < initial_len {
            return Ok(StatusCode::NO_CONTENT);
        }
        return Err(StatusCode::NOT_FOUND);
    }

    let pool = state.db();
    sqlx::query("DELETE FROM scope_targets WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct ImportScopeRequest {
    pub targets: Vec<String>,
    pub out_of_scope: Option<bool>,
    pub target_type: Option<String>,
}

pub async fn import_scope(
    State(state): State<AppState>,
    user_id_ext: Option<axum::extract::Extension<Uuid>>,
    Path(program_id): Path<Uuid>,
    Json(payload): Json<ImportScopeRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let added_by = user_id_ext.map(|axum::extract::Extension(id)| id);
    let out_of_scope = payload.out_of_scope.unwrap_or(false);
    let default_type = payload.target_type.unwrap_or_else(|| "domain".to_string());

    if !state.has_db() {
        let mut scope = state.in_memory_scope().write().await;
        let mut imported = 0;
        for raw in payload.targets {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                continue;
            }

            let target_type = if trimmed.starts_with("*.") || trimmed.starts_with('.') {
                "wildcard"
            } else if trimmed.contains('/') {
                "cidr"
            } else if trimmed.parse::<std::net::IpAddr>().is_ok() {
                "ip"
            } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                "url"
            } else {
                &default_type
            };

            if !scope
                .iter()
                .any(|s| s.program_id == program_id && s.target == trimmed)
            {
                scope.push(ScopeTarget {
                    id: Uuid::new_v4(),
                    program_id,
                    target: trimmed.to_string(),
                    target_type: target_type.to_string(),
                    out_of_scope,
                    source: Some("import".to_string()),
                    added_by,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                });
                imported += 1;
            }
        }

        return Ok(Json(serde_json::json!({
            "status": "success",
            "imported_count": imported
        })));
    }

    let pool = state.db();
    let mut imported = 0;
    for raw in payload.targets {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }

        let target_type = if trimmed.starts_with("*.") || trimmed.starts_with('.') {
            "wildcard"
        } else if trimmed.contains('/') {
            "cidr"
        } else if trimmed.parse::<std::net::IpAddr>().is_ok() {
            "ip"
        } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            "url"
        } else {
            &default_type
        };

        let res = sqlx::query(
            r#"INSERT INTO scope_targets (program_id, target, target_type, out_of_scope, source, added_by)
             VALUES ($1, $2, $3, $4, 'import', $5)
             ON CONFLICT (program_id, target) DO NOTHING"#,
        )
        .bind(program_id)
        .bind(trimmed)
        .bind(target_type)
        .bind(out_of_scope)
        .bind(added_by)
        .execute(pool)
        .await;

        if let Ok(r) = res {
            if r.rows_affected() > 0 {
                imported += 1;
            }
        }
    }

    Ok(Json(serde_json::json!({
        "status": "success",
        "imported_count": imported
    })))
}
