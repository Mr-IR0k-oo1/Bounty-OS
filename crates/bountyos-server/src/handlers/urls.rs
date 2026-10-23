use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::models::url::Url;
use crate::AppState;

#[derive(Deserialize, Default)]
pub struct ListUrlsParams {
    pub subdomain_id: Option<Uuid>,
}

pub async fn list_urls(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
    Query(params): Query<ListUrlsParams>,
) -> Result<Json<Vec<Url>>, StatusCode> {
    if !state.has_db() {
        return Ok(Json(vec![]));
    }

    let pool = state.db();
    let urls = match params.subdomain_id {
        Some(sub_id) => {
            sqlx::query_as::<_, Url>(
                "SELECT * FROM urls WHERE program_id = $1 AND subdomain_id = $2 ORDER BY url ASC LIMIT 500"
            )
            .bind(program_id)
            .bind(sub_id)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Url>(
                "SELECT * FROM urls WHERE program_id = $1 ORDER BY url ASC LIMIT 500"
            )
            .bind(program_id)
            .fetch_all(pool)
            .await
        }
    }
    .map_err(|e| {
        tracing::error!("Failed to list urls: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(urls))
}

#[derive(Debug, Deserialize)]
pub struct CreateUrlRequest {
    pub url: String,
    #[serde(default)]
    pub subdomain_id: Option<Uuid>,
    #[serde(default)]
    pub status_code: Option<i32>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub content_length: Option<i64>,
    #[serde(default)]
    pub tool: Option<String>,
}

pub async fn create_url(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
    Json(payload): Json<CreateUrlRequest>,
) -> Result<Json<Url>, StatusCode> {
    let source = payload.tool.unwrap_or_else(|| "unknown".to_string());
    if state.has_db() {
        let pool = state.db();
        match sqlx::query_as::<_, Url>(
            r#"INSERT INTO urls (program_id, subdomain_id, url, status_code, content_type, content_length, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (program_id, url) DO UPDATE
             SET status_code = EXCLUDED.status_code,
                 content_type = EXCLUDED.content_type,
                 content_length = EXCLUDED.content_length,
                 source = EXCLUDED.source,
                 updated_at = NOW()
             RETURNING *"#,
        )
        .bind(program_id)
        .bind(payload.subdomain_id)
        .bind(&payload.url)
        .bind(payload.status_code)
        .bind(&payload.content_type)
        .bind(payload.content_length)
        .bind(&source)
        .fetch_one(pool)
        .await
        {
            Ok(url) => return Ok(Json(url)),
            Err(e) => {
                tracing::error!("Failed to insert/update url in DB: {e}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    let url = Url {
        id: Uuid::new_v4(),
        program_id,
        subdomain_id: payload.subdomain_id,
        url: payload.url,
        status_code: payload.status_code,
        content_type: payload.content_type,
        content_length: payload.content_length,
        source,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    Ok(Json(url))
}
