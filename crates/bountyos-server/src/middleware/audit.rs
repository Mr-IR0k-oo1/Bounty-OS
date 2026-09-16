use axum::{
    extract::{ConnectInfo, Request, State},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use uuid::Uuid;

use crate::state::AppState;

pub async fn audit_middleware(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let ip_address = addr.ip().to_string();
    let hunter_id = req.extensions().get::<Uuid>().copied();

    let response = next.run(req).await;

    let state_clone = state.clone();
    tokio::spawn(async move {
        let action = format!("{} {}", method, path);
        let resource_type = path.split('/').nth(2).unwrap_or("unknown").to_string();

        let resource_id = path.split('/').nth(3).map(|s| s.to_string());

        let result = sqlx::query(
            "INSERT INTO audit_log (hunter_id, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(hunter_id)
        .bind(&action)
        .bind(&resource_type)
        .bind(resource_id)
        .bind(&ip_address)
        .execute(state_clone.db())
        .await;

        if let Err(e) = result {
            tracing::warn!("Failed to write audit log: {e}");
        }
    });

    response
}
