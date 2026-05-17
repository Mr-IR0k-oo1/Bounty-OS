//! JWT token generation and verification

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::middleware::Claims;

/// Generate JWT tokens (access and refresh)
pub fn generate_tokens(
    user_id: &Uuid,
    jwt_secret: &str,
) -> Result<(String, String), jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let access_expiration = now + Duration::hours(1); // 1 hour
    let refresh_expiration = now + Duration::days(7); // 7 days

    // Create access token claims
    let access_claims = Claims {
        sub: user_id.to_string(),
        exp: access_expiration.timestamp() as usize,
    };

    // Create refresh token claims
    let refresh_claims = Claims {
        sub: user_id.to_string(),
        exp: refresh_expiration.timestamp() as usize,
    };

    // Generate tokens
    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )?;

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )?;

    Ok((access_token, refresh_token))
}

/// Verify a JWT token
pub fn verify_token(token: &str, jwt_secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let validation = Validation::default();
    let decoding_key = DecodingKey::from_secret(jwt_secret.as_ref());

    decode::<Claims>(token, &decoding_key, &validation).map(|data| data.claims)
}
