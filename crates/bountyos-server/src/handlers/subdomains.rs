use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::models::subdomain::Subdomain;
use crate::AppState;

pub async fn list_subdomains(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Vec<Subdomain>>, StatusCode> {
    if !state.has_db() {
        let subdomains = state.in_memory_subdomains().read().await;
        let list: Vec<Subdomain> = subdomains
            .iter()
            .filter(|s| s.program_id == program_id)
            .cloned()
            .collect();
        return Ok(Json(list));
    }

    let pool = state.db();
    let subdomains = sqlx::query_as::<_, Subdomain>(
        "SELECT * FROM subdomains WHERE program_id = $1 ORDER BY subdomain ASC",
    )
    .bind(program_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list subdomains: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(subdomains))
}

pub async fn get_subdomain(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Subdomain>, StatusCode> {
    if !state.has_db() {
        let subdomains = state.in_memory_subdomains().read().await;
        if let Some(s) = subdomains.iter().find(|s| s.id == id) {
            return Ok(Json(s.clone()));
        }
        return Err(StatusCode::NOT_FOUND);
    }

    let pool = state.db();
    let subdomain = sqlx::query_as::<_, Subdomain>("SELECT * FROM subdomains WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(subdomain))
}
