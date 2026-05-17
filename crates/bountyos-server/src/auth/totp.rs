//! TOTP (Time-based One-Time Password) generation and verification

use base32::encode;
use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Secret, TOTP};

/// Generate a new TOTP secret and QR code URL
pub fn generate_totp_secret(
    username: &str,
    issuer: &str,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    // Generate a random secret
    let secret = Secret::generate()?;
    let secret_b32 = encode(
        totp_rs::Base32::RFC4648 { padding: false },
        &secret.as_bytes(),
    );

    // Create TOTP instance
    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret);

    // Generate QR code URL
    let qr_code_url = format!(
        "otpauth://totp/{}:{}:{}?secret={}&issuer={}",
        issuer, username, issuer, secret_b32, issuer,
    );

    Ok((secret_b32, qr_code_url))
}

/// Verify a TOTP code
pub fn verify_totp_code(secret_b32: &str, code: &str) -> bool {
    // Decode the secret from Base32
    let secret_bytes = base32::decode(base32::Alphabet::RFC4648 { padding: false }, secret_b32)
        .ok()
        .and_then(|bytes| Secret::try_from(bytes).ok());

    if let Some(secret) = secret_bytes {
        // Create TOTP instance
        let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret);

        // Get current timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Verify the code
        totp.check(code, timestamp).is_ok()
    } else {
        false
    }
}
