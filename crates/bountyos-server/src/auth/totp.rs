//! TOTP (Time-based One-Time Password) generation and verification

use totp_rs::{Algorithm, Secret, TOTP};

/// Generate a new TOTP secret and QR code URL
pub fn generate_totp_secret(
    username: &str,
    issuer: &str,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    let secret = Secret::generate_secret();
    let secret_b32 = secret.to_encoded().to_string();

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().map_err(|e| format!("{:?}", e))?,
        Some(issuer.to_string()),
        username.to_string(),
    )
    .map_err(|e| format!("{:?}", e))?;

    let qr_code_url = totp.get_url();
    Ok((secret_b32, qr_code_url))
}

/// Verify a TOTP code
pub fn verify_totp_code(secret_b32: &str, code: &str) -> bool {
    let secret = Secret::Encoded(secret_b32.to_string());
    if let Ok(bytes) = secret.to_bytes() {
        if let Ok(totp) = TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, None, String::new()) {
            return totp.check_current(code).unwrap_or(false);
        }
    }
    false
}
