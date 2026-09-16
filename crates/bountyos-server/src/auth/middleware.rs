//! Authentication middleware

use axum::{extract::State, http::StatusCode, middleware::Next, response::Response};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

/// JWT claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user ID)
    pub exp: usize,  // Expiration time
    #[serde(default = "default_token_type")]
    pub token_type: String, // "access" or "refresh"
}

fn default_token_type() -> String {
    "access".to_string()
}

/// JWT token extraction and validation middleware
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract the token from the Authorization header
    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "));

    let token = if let Some(token) = auth_header {
        token
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Validate the token
    let validation = Validation::default();
    let decoding_key = DecodingKey::from_secret(state.config().jwt_secret.as_ref());

    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Only allow access tokens in authentication middleware
    if token_data.claims.token_type != "access" {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check if the session is blacklisted in Redis
    let mut redis_conn = state
        .redis()
        .get_async_connection()
        .await
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

    // Store the user ID in the request extensions as Uuid
    let user_id =
        uuid::Uuid::parse_str(&token_data.claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    req.extensions_mut().insert(user_id);

    // Call the next middleware/handler
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::tokens::generate_tokens;
    use crate::config::{AppConfig, LlmConfig};
    use axum::{
        body::Body,
        http::{header, Request, StatusCode},
        routing::get,
        Router,
    };
    use std::sync::Arc;
    use tower::ServiceExt;
    use uuid::Uuid;

    fn mock_state() -> AppState {
        let db_pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://localhost/test")
            .unwrap();
        let redis_client = Arc::new(redis::Client::open("redis://127.0.0.1:6379").unwrap());
        let (ws_tx, _) = tokio::sync::broadcast::channel(16);
        let config = AppConfig {
            database_url: "postgres://localhost/test".to_string(),
            redis_url: "redis://127.0.0.1:6379".to_string(),
            jwt_secret: "super-secret-key-that-is-long-enough-for-testing".to_string(),
            first_run: false,
            rust_log: "info".to_string(),
            evidence_base_path: "/tmp".to_string(),
            llm: LlmConfig::default(),
        };
        AppState::new(db_pool, redis_client, config, ws_tx)
    }

    fn test_app() -> Router {
        let state = mock_state();
        let protected = Router::new()
            .route("/protected", get(|| async { "secret data" }))
            .route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            ));

        Router::new()
            .route("/public", get(|| async { "public data" }))
            .merge(protected)
            .with_state(state)
    }

    #[tokio::test]
    async fn test_public_endpoint_accessible() {
        let app = test_app();
        let req = Request::builder()
            .uri("/public")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_protected_missing_auth_header_returns_401() {
        let app = test_app();
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_protected_invalid_bearer_prefix_returns_401() {
        let app = test_app();
        let req = Request::builder()
            .uri("/protected")
            .header(header::AUTHORIZATION, "Basic 12345")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_protected_malformed_token_returns_401() {
        let app = test_app();
        let req = Request::builder()
            .uri("/protected")
            .header(header::AUTHORIZATION, "Bearer not.a.valid.jwt")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_protected_rejects_refresh_token() {
        let app = test_app();
        let user_id = Uuid::new_v4();
        let secret = "super-secret-key-that-is-long-enough-for-testing";
        let (_access, refresh) = generate_tokens(&user_id, secret).unwrap();

        let req = Request::builder()
            .uri("/protected")
            .header(header::AUTHORIZATION, format!("Bearer {}", refresh))
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_protected_rejects_wrong_secret() {
        let app = test_app();
        let user_id = Uuid::new_v4();
        let wrong_secret = "different-secret-key-that-fails-signature-check";
        let (access, _) = generate_tokens(&user_id, wrong_secret).unwrap();

        let req = Request::builder()
            .uri("/protected")
            .header(header::AUTHORIZATION, format!("Bearer {}", access))
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }
}
