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
