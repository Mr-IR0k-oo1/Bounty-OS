//! Authentication middleware

use axum::{
    async_trait,
    extract::{FromRequestParts, State},
    http::{request::Parts, StatusCode},
    middleware::Next,
    response::IntoResponse,
    RequestPartsExt,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;

use crate::{app::AppState, models::session::Session};

/// JWT claims structure
#[derive(Debug, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user ID)
    pub exp: usize, // Expiration time
}

/// JWT token extraction and validation middleware
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    // Extract the token from the Authorization header
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "));

    let token = if let Some(token) = auth_header {
        token
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Validate the token
    let validation = Validation::default();
    let decoding_key = DecodingKey::from_secret(state.config.jwt_secret.as_ref());

    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Check if the session is blacklisted
    let mut redis_conn = state.redis_pool.clone().get_async_connection().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let session_key = format!("session:{}", token_data.claims.sub);
    let is_blacklisted: bool = redis::cmd("EXISTS")
        .arg(&session_key)
        .query_async(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if is_blacklisted {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Store the user ID in the request extensions
    req.extensions_mut().insert(token_data.claims.sub);

    // Call the next middleware/handler
    Ok(next.run(req).await)
}
