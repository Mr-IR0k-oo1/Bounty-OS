use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::models::port::Port;
use crate::AppState;

pub async fn list_ports(
    State(state): State<AppState>,
    Path(subdomain_id): Path<Uuid>,
) -> Result<Json<Vec<Port>>, StatusCode> {
    let pool = state.db();
    let ports =
        sqlx::query_as::<_, Port>("SELECT * FROM ports WHERE subdomain_id = $1 ORDER BY port ASC")
            .bind(subdomain_id)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list ports: {e}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(ports))
}
