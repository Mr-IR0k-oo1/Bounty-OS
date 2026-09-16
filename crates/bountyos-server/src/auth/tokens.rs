//! JWT token generation and verification

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
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
        token_type: "access".to_string(),
    };

    // Create refresh token claims
    let refresh_claims = Claims {
        sub: user_id.to_string(),
        exp: refresh_expiration.timestamp() as usize,
        token_type: "refresh".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_verify_tokens() {
        let user_id = Uuid::new_v4();
        let secret = "super-secret-test-jwt-key-that-is-long-enough";

        let (access, refresh) = generate_tokens(&user_id, secret).expect("token generation failed");

        let access_claims = verify_token(&access, secret).expect("access verification failed");
        assert_eq!(access_claims.sub, user_id.to_string());
        assert_eq!(access_claims.token_type, "access");

        let refresh_claims = verify_token(&refresh, secret).expect("refresh verification failed");
        assert_eq!(refresh_claims.sub, user_id.to_string());
        assert_eq!(refresh_claims.token_type, "refresh");
    }

    #[test]
    fn test_invalid_secret_fails() {
        let user_id = Uuid::new_v4();
        let secret = "correct-secret-key-for-testing-purposes";
        let wrong_secret = "wrong-secret-key-for-testing-purposes";

        let (access, _) = generate_tokens(&user_id, secret).expect("token generation failed");
        assert!(verify_token(&access, wrong_secret).is_err());
    }

    #[test]
    fn test_malformed_token_fails() {
        let secret = "correct-secret-key-for-testing-purposes";
        assert!(verify_token("not-a-real-token", secret).is_err());
    }
}
