//! Authentication handlers

use axum::{
    extract::{Extension, State},
    http::{HeaderMap, StatusCode},
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temp_token: Option<String>,
}

/// Refresh request
#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Login handler
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let clean_username = payload.username.trim();

    // Find the hunter by username (case-insensitive)
    let hunter = if state.has_db() {
        match sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE LOWER(username) = LOWER($1)"#)
            .bind(clean_username)
            .fetch_optional(state.db())
            .await
        {
            Ok(Some(h)) => Some(h),
            Ok(None) => None,
            Err(_) => state.find_hunter(clean_username).await,
        }
    } else {
        state.find_hunter(clean_username).await
    }
    .ok_or(StatusCode::UNAUTHORIZED)?;

    // Check if account is active
    if !hunter.active {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Verify the password
    if !crate::auth::password::verify_password(&payload.password, &hunter.password_hash) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check if 2FA is required
    if hunter.totp_enabled {
        let temp_claims = crate::auth::middleware::Claims {
            sub: hunter.id.to_string(),
            exp: (chrono::Utc::now() + chrono::Duration::minutes(5)).timestamp() as usize,
            token_type: "2fa_pending".to_string(),
        };
        let temp_token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &temp_claims,
            &jsonwebtoken::EncodingKey::from_secret(state.config().jwt_secret.as_ref()),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Ok(Json(LoginResponse {
            access_token: String::new(),
            refresh_token: String::new(),
            requires_2fa: true,
            temp_token: Some(temp_token),
        }));
    }

    // Generate JWT tokens
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&hunter.id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store the refresh token and clear any previous session blacklist in Redis (if available)
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let session_key = format!("session:{}", hunter.id);
        let _ = redis::cmd("DEL")
            .arg(&session_key)
            .query_async::<_, ()>(&mut redis_conn)
            .await;

        let refresh_token_key = format!("refresh_token:{}", hunter.id);
        let _ = redis::cmd("SET")
            .arg(&refresh_token_key)
            .arg(&refresh_token)
            .arg("EX")
            .arg(7 * 24 * 60 * 60) // 7 days
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
        temp_token: None,
    }))
}

/// Logout handler
pub async fn logout(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Blacklist the session and delete refresh token in Redis (if available)
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let session_key = format!("session:{}", user_id);
        let _ = redis::cmd("SET")
            .arg(&session_key)
            .arg("1")
            .arg("EX")
            .arg(7 * 24 * 60 * 60) // 7 days
            .query_async::<_, ()>(&mut redis_conn)
            .await;

        let refresh_token_key = format!("refresh_token:{}", user_id);
        let _ = redis::cmd("DEL")
            .arg(&refresh_token_key)
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Refresh token handler
pub async fn refresh(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Verify the refresh token
    let claims = crate::auth::tokens::verify_token(&payload.refresh_token, &state.config().jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if claims.token_type != "refresh" {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Check if the refresh token exists in Redis
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let refresh_token_key = format!("refresh_token:{}", claims.sub);
        let stored_token: Option<String> = redis::cmd("GET")
            .arg(&refresh_token_key)
            .query_async(&mut redis_conn)
            .await
            .ok();

        if let Some(ref stored) = stored_token {
            if stored != &payload.refresh_token {
                return Err(StatusCode::UNAUTHORIZED);
            }
        }
    }

    // Generate new JWT tokens
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&user_id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Update the refresh token in Redis
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let refresh_token_key = format!("refresh_token:{}", claims.sub);
        let _ = redis::cmd("SET")
            .arg(&refresh_token_key)
            .arg(&refresh_token)
            .arg("EX")
            .arg(7 * 24 * 60 * 60) // 7 days
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
        temp_token: None,
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
    pub temp_token: Option<String>,
}

/// 2FA verification handler (works both with Bearer auth token and temp_token during login)
pub async fn verify_2fa(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Verify2FARequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Extract token string
    let token_str = if let Some(ref t) = payload.temp_token {
        t.as_str()
    } else if let Some(auth_val) = headers.get(axum::http::header::AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        auth_val.strip_prefix("Bearer ").unwrap_or(auth_val)
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    let decoding_key = jsonwebtoken::DecodingKey::from_secret(state.config().jwt_secret.as_ref());
    let mut validation = jsonwebtoken::Validation::default();
    validation.validate_exp = true;

    let token_data = jsonwebtoken::decode::<crate::auth::middleware::Claims>(token_str, &decoding_key, &validation)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if token_data.claims.token_type != "2fa_pending" && token_data.claims.token_type != "access" {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let user_id = Uuid::parse_str(&token_data.claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(state.db())
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let secret = hunter.totp_secret.as_deref().unwrap_or_default();
    if secret.is_empty() || !crate::auth::totp::verify_totp_code(secret, &payload.code) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Enable 2FA for the hunter if not enabled yet
    let _ = sqlx::query(r#"UPDATE hunters SET totp_enabled = true WHERE id = $1"#)
        .bind(user_id)
        .execute(state.db())
        .await;

    // Generate JWT tokens
    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&hunter.id, &state.config().jwt_secret)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store the refresh token and clear any previous session blacklist in Redis
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let session_key = format!("session:{}", hunter.id);
        let _ = redis::cmd("DEL")
            .arg(&session_key)
            .query_async::<_, ()>(&mut redis_conn)
            .await;

        let refresh_token_key = format!("refresh_token:{}", hunter.id);
        let _ = redis::cmd("SET")
            .arg(&refresh_token_key)
            .arg(&refresh_token)
            .arg("EX")
            .arg(7 * 24 * 60 * 60) // 7 days
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        requires_2fa: false,
        temp_token: None,
    }))
}

/// 2FA disable handler
pub async fn disable_2fa(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(r#"UPDATE hunters SET totp_enabled = false, totp_secret = NULL WHERE id = $1"#)
        .bind(user_id)
        .execute(state.db())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Setup request for first time wizard
#[derive(Debug, Deserialize)]
pub struct SetupRequest {
    pub username: String,
    pub display_name: String,
    pub password: String,
}

/// Setup response
#[derive(Debug, Serialize)]
pub struct SetupResponse {
    pub message: String,
    pub secret: String,
    pub qr_code_url: String,
    pub access_token: String,
    pub refresh_token: String,
}

/// Setup wizard handler
pub async fn setup(
    State(state): State<AppState>,
    Json(payload): Json<SetupRequest>,
) -> Result<Json<SetupResponse>, (StatusCode, String)> {
    if payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Username and password are required".to_string()));
    }

    let password_hash = crate::auth::password::hash_password(&payload.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Hash error: {:?}", e)))?;

    let (secret, qr_code_url) = crate::auth::totp::generate_totp_secret(&payload.username, "BountyOS")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("TOTP generation error: {:?}", e)))?;

    let admin_id = uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

    let display_name = if payload.display_name.trim().is_empty() {
        payload.username.clone()
    } else {
        payload.display_name
    };

    sqlx::query(
        r#"INSERT INTO hunters (id, username, display_name, role, password_hash, totp_secret, totp_enabled, active)
           VALUES ($1, $2, $3, 'admin', $4, $5, false, true)
           ON CONFLICT (id) DO UPDATE
           SET username = EXCLUDED.username,
               display_name = EXCLUDED.display_name,
               password_hash = EXCLUDED.password_hash,
               totp_secret = EXCLUDED.totp_secret"#,
    )
    .bind(admin_id)
    .bind(&payload.username)
    .bind(&display_name)
    .bind(&password_hash)
    .bind(&secret)
    .execute(state.db())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {:?}", e)))?;

    let (access_token, refresh_token) =
        crate::auth::tokens::generate_tokens(&admin_id, &state.config().jwt_secret)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token error: {:?}", e)))?;

    // Store the refresh token and clear any previous session blacklist in Redis (if available)
    if let Ok(mut redis_conn) = state.redis().get_async_connection().await {
        let session_key = format!("session:{}", admin_id);
        let _ = redis::cmd("DEL")
            .arg(&session_key)
            .query_async::<_, ()>(&mut redis_conn)
            .await;

        let refresh_token_key = format!("refresh_token:{}", admin_id);
        let _ = redis::cmd("SET")
            .arg(&refresh_token_key)
            .arg(&refresh_token)
            .arg("EX")
            .arg(7 * 24 * 60 * 60) // 7 days
            .query_async::<_, ()>(&mut redis_conn)
            .await;
    }

    Ok(Json(SetupResponse {
        message: "Account setup successful".to_string(),
        secret,
        qr_code_url,
        access_token,
        refresh_token,
    }))
}

/// Change password request
#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

/// Change password handler
pub async fn change_password(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hunter = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(state.db())
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Hunter not found".to_string()))?;

    if !crate::auth::password::verify_password(&payload.current_password, &hunter.password_hash) {
        return Err((StatusCode::BAD_REQUEST, "Current password is incorrect".to_string()));
    }

    if payload.new_password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "New password must be at least 8 characters long".to_string()));
    }

    let new_hash = crate::auth::password::hash_password(&payload.new_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Hash error: {:?}", e)))?;

    sqlx::query(r#"UPDATE hunters SET password_hash = $1 WHERE id = $2"#)
        .bind(&new_hash)
        .bind(user_id)
        .execute(state.db())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {:?}", e)))?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get current user handler
pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Hunter>, StatusCode> {
    if state.has_db() {
        if let Ok(hunter) = sqlx::query_as::<_, Hunter>(r#"SELECT * FROM hunters WHERE id = $1"#)
            .bind(user_id)
            .fetch_one(state.db())
            .await
        {
            return Ok(Json(hunter));
        }
    }

    if let Some(hunter) = state.get_hunter_by_id(&user_id).await {
        return Ok(Json(hunter));
    }

    Err(StatusCode::NOT_FOUND)
}

