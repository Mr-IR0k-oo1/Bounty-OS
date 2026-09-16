use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::models::finding::Finding;
use crate::AppState;

#[derive(Deserialize, Default)]
pub struct ListFindingsParams {
    pub program_id: Option<Uuid>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub unassigned: Option<bool>,
}

pub async fn list_findings(
    State(state): State<AppState>,
    Query(params): Query<ListFindingsParams>,
) -> Result<Json<Vec<Finding>>, StatusCode> {
    let pool = state.db();
    let findings =
        match (params.program_id, params.severity, params.status) {
            (Some(pid), _, _) => sqlx::query_as::<_, Finding>(
                "SELECT * FROM findings WHERE program_id = $1 ORDER BY created_at DESC LIMIT 200",
            )
            .bind(pid)
            .fetch_all(pool)
            .await,
            (None, Some(sev), _) => {
                sqlx::query_as::<_, Finding>(
                    "SELECT * FROM findings WHERE severity = $1 ORDER BY created_at DESC LIMIT 200",
                )
                .bind(sev)
                .fetch_all(pool)
                .await
            }
            (None, None, Some(st)) => {
                sqlx::query_as::<_, Finding>(
                    "SELECT * FROM findings WHERE status = $1 ORDER BY created_at DESC LIMIT 200",
                )
                .bind(st)
                .fetch_all(pool)
                .await
            }
            _ => {
                sqlx::query_as::<_, Finding>(
                    "SELECT * FROM findings ORDER BY created_at DESC LIMIT 200",
                )
                .fetch_all(pool)
                .await
            }
        }
        .map_err(|e| {
            tracing::error!("Failed to list findings: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(findings))
}

pub async fn get_finding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let finding = sqlx::query_as::<_, Finding>("SELECT * FROM findings WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFindingRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub cvss_score: Option<f32>,
    pub kanban_column: Option<String>,
    pub assigned_to: Option<Uuid>,
}

pub async fn update_finding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFindingRequest>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let finding = sqlx::query_as::<_, Finding>(
        r#"UPDATE findings SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            severity = COALESCE($3, severity),
            status = COALESCE($4, status),
            cvss_score = COALESCE($5, cvss_score),
            kanban_column = COALESCE($6, kanban_column),
            assigned_to = COALESCE($7, assigned_to),
            updated_at = NOW()
         WHERE id = $8
         RETURNING *"#,
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.severity)
    .bind(&payload.status)
    .bind(payload.cvss_score)
    .bind(&payload.kanban_column)
    .bind(payload.assigned_to)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

pub async fn claim_finding(
    State(state): State<AppState>,
    user_id_ext: Option<axum::extract::Extension<Uuid>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let user_id = user_id_ext.map(|axum::extract::Extension(u)| u);

    let finding = sqlx::query_as::<_, Finding>(
        "UPDATE findings SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

pub async fn validate_finding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let finding = sqlx::query_as::<_, Finding>(
        "UPDATE findings SET status = 'validated', updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

pub async fn report_finding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let finding = sqlx::query_as::<_, Finding>(
        "UPDATE findings SET status = 'submitted', updated_at = NOW() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

pub async fn list_project_findings(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Finding>>, StatusCode> {
    let pool = state.db();
    let findings = sqlx::query_as::<_, Finding>(
        r#"SELECT f.* FROM findings f
           JOIN programs p ON f.program_id = p.id
           WHERE p.project_id = $1
           ORDER BY f.created_at DESC"#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list project findings: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(findings))
}

pub async fn list_program_findings(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Vec<Finding>>, StatusCode> {
    let pool = state.db();
    let findings = sqlx::query_as::<_, Finding>(
        "SELECT * FROM findings WHERE program_id = $1 ORDER BY created_at DESC",
    )
    .bind(program_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list program findings: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(findings))
}

#[derive(Debug, Deserialize)]
pub struct MoveKanbanRequest {
    pub column: String,
}

pub async fn move_finding_kanban(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<MoveKanbanRequest>,
) -> Result<Json<Finding>, StatusCode> {
    let pool = state.db();
    let finding = sqlx::query_as::<_, Finding>(
        "UPDATE findings SET kanban_column = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    )
    .bind(&payload.column)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(finding))
}

// ---------------------------------------------------------------------------
// LLM Triage endpoints
// ---------------------------------------------------------------------------

/// POST /findings/:id/triage
///
/// Spawns an async triage task for the given finding.
/// Returns 202 Accepted immediately — the triage runs in the background.
/// Returns 501 if LLM is not configured.
/// Returns 404 if the finding does not exist.
pub async fn triage_finding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let llm_client = match state.llm_client() {
        Some(c) => Arc::clone(c),
        None => {
            return Err((
                StatusCode::NOT_IMPLEMENTED,
                Json(serde_json::json!({
                    "error": "LLM triage is not enabled. Set llm.enabled = true in config.yaml."
                })),
            ));
        }
    };

    // Verify finding exists before spawning
    let exists: bool = sqlx::query("SELECT EXISTS(SELECT 1 FROM findings WHERE id = $1)")
        .bind(id)
        .fetch_one(state.db())
        .await
        .map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            row.try_get::<bool, _>(0).unwrap_or(false)
        })
        .unwrap_or(false);

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Finding not found"})),
        ));
    }

    // Check if already triaged and not forcing re-triage
    let already_triaged: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM findings WHERE id = $1 AND llm_triaged_at IS NOT NULL)",
    )
    .bind(id)
    .fetch_one(state.db())
    .await
    .map(|row: sqlx::postgres::PgRow| {
        use sqlx::Row;
        row.try_get::<bool, _>(0).unwrap_or(false)
    })
    .unwrap_or(false);

    if already_triaged {
        info!("Finding {} already triaged — re-triaging", id);
    }

    // Spawn async — HTTP returns 202 immediately
    let pool = state.db().clone();
    let evidence_base = state.evidence_base().clone();

    tokio::spawn(async move {
        match crate::llm::triage::triage_finding(&pool, id, &llm_client, &evidence_base).await {
            Ok(output) => {
                info!(
                    "Background triage complete for {} — {} ({:.0}%)",
                    id,
                    output.finding_type,
                    output.sanitized_confidence() * 100.0
                );
            }
            Err(e) => {
                error!("Background triage failed for {}: {:#}", id, e);
            }
        }
    });

    Ok(Json(serde_json::json!({
        "status": "accepted",
        "finding_id": id,
        "message": "LLM triage started in background. Poll GET /findings/:id/triage for results."
    })))
}

/// GET /findings/:id/triage
///
/// Returns the stored triage result for a finding.
/// Returns 404 if not yet triaged, or if finding doesn't exist.
pub async fn get_finding_triage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if state.llm_client().is_none() {
        return Err((
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({
                "error": "LLM triage is not enabled."
            })),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT
            llm_triage_json,
            llm_confidence,
            llm_triaged_at
        FROM findings
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(state.db())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("DB error: {}", e)})),
        )
    })?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Finding not found"})),
            ));
        }
    };

    use sqlx::Row;
    let triage_json: Option<serde_json::Value> = row.try_get("llm_triage_json").ok();
    let confidence: Option<f64> = row
        .try_get::<Option<f64>, _>("llm_confidence")
        .ok()
        .flatten()
        .or_else(|| {
            row.try_get::<Option<f32>, _>("llm_confidence")
                .ok()
                .flatten()
                .map(|c| c as f64)
        });

    let triaged_at: Option<chrono::DateTime<chrono::Utc>> =
        row.try_get("llm_triaged_at").ok().flatten();

    match triage_json {
        Some(triage) => Ok(Json(serde_json::json!({
            "finding_id": id,
            "triage": triage,
            "confidence": confidence,
            "triaged_at": triaged_at
        }))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Triage not yet available. POST /findings/:id/triage to start.",
                "finding_id": id
            })),
        )),
    }
}
