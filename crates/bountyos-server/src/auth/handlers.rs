//! Authentication handlers

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{models::hunter::Hunter, state::AppState};

/// Login request
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub requires_2fa: bool,
}

/// Login handler
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Find the hunter by username
    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE username = $1"#)
        .bind(&payload.username)
        .fetch_optional(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify the password
    if !crate::auth::password::verify_password(&payload.password, &hunter.password_hash) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check if 2FA is required
    if hunter.totp_enabled {
        return Ok(Json(LoginResponse {
            access_token: String::new(),
            refresh_token: String::new(),
            requires_2fa: true,
        }));
    }

    // Generate JWT tokens
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&hunter.id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store the refresh token in Redis
    let mut redis_conn = state
        .redis()
        .get_async_connection()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token_key = format!("refresh_token:{}", hunter.id);
    redis::cmd("SET")
        .arg(&refresh_token_key)
        .arg(&refresh_token)
        .arg("EX")
        .arg(7 * 24 * 60 * 60) // 7 days
        .query_async::<_, ()>(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
    }))
}

/// Logout handler
pub async fn logout(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Blacklist the session in Redis
    let mut redis_conn = state
        .redis()
        .get_async_connection()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let session_key = format!("session:{}", user_id);
    redis::cmd("SET")
        .arg(&session_key)
        .arg("1")
        .arg("EX")
        .arg(7 * 24 * 60 * 60) // 7 days
        .query_async::<_, ()>(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Refresh token handler
pub async fn refresh(
    State(state): State<AppState>,
    refresh_token: String,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Verify the refresh token
    let claims = crate::auth::tokens::verify_token(&refresh_token, &state.config().jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if claims.token_type != "refresh" {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check if the refresh token exists in Redis
    let mut redis_conn = state
        .redis()
        .get_async_connection()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token_key = format!("refresh_token:{}", claims.sub);
    let stored_token: Option<String> = redis::cmd("GET")
        .arg(&refresh_token_key)
        .query_async(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if stored_token.as_deref() != Some(&refresh_token) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Generate new JWT tokens
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&user_id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Update the refresh token in Redis
    redis::cmd("SET")
        .arg(&refresh_token_key)
        .arg(&refresh_token)
        .arg("EX")
        .arg(7 * 24 * 60 * 60) // 7 days
        .query_async::<_, ()>(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
    }))
}

/// 2FA setup request
#[derive(Debug, Deserialize)]
pub struct Setup2FARequest {
    pub password: String,
}

/// 2FA setup response
#[derive(Debug, Serialize)]
pub struct Setup2FAResponse {
    pub secret: String,
    pub qr_code_url: String,
}

/// 2FA setup handler
pub async fn setup_2fa(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<Setup2FARequest>,
) -> Result<Json<Setup2FAResponse>, StatusCode> {
    // Find the hunter by ID
    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Verify the password
    if !crate::auth::password::verify_password(&payload.password, &hunter.password_hash) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Generate a new TOTP secret
    let (secret, qr_code_url) =
        crate::auth::totp::generate_totp_secret(&hunter.username, "BountyOS")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store the secret in the database
    sqlx::query(r#"UPDATE hunters SET totp_secret = $1 WHERE id = $2"#)
        .bind(&secret)
        .bind(user_id)
        .execute(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(Setup2FAResponse {
        secret,
        qr_code_url,
    }))
}

/// 2FA verification request
#[derive(Debug, Deserialize)]
pub struct Verify2FARequest {
    pub code: String,
}

/// 2FA verification handler
pub async fn verify_2fa(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<Verify2FARequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Find the hunter by ID
    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Verify the TOTP code
    if !crate::auth::totp::verify_totp_code(&hunter.totp_secret.unwrap_or_default(), &payload.code)
    {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Enable 2FA for the hunter
    sqlx::query(r#"UPDATE hunters SET totp_enabled = true WHERE id = $1"#)
        .bind(user_id)
        .execute(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate JWT tokens
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&hunter.id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store the refresh token in Redis
    let mut redis_conn = state
        .redis()
        .get_async_connection()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token_key = format!("refresh_token:{}", hunter.id);
    redis::cmd("SET")
        .arg(&refresh_token_key)
        .arg(&refresh_token)
        .arg("EX")
        .arg(7 * 24 * 60 * 60) // 7 days
        .query_async::<_, ()>(&mut redis_conn)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
    }))
}

/// Get current user handler
pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Hunter>, StatusCode> {
    // Find the hunter by ID
    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(hunter))
}
