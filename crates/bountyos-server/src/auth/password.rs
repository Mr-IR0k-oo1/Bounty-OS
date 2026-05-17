//! Password hashing and verification using Argon2

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use thiserror::Error;

/// Custom error type for password operations
#[derive(Error, Debug)]
pub enum PasswordError {
    #[error("Invalid password hash")]
    InvalidHash,
    #[error("Password verification failed")]
    VerificationFailed,
}

/// Hash a password using Argon2
pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    // Generate a random salt
    let salt = SaltString::generate(&mut OsRng);

    // Create Argon2 hasher
    let argon2 = Argon2::default();

    // Hash the password
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| PasswordError::InvalidHash)?
        .to_string();

    Ok(password_hash)
}

/// Verify a password against a hash
pub fn verify_password(password: &str, password_hash: &str) -> bool {
    // Parse the password hash
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|_| PasswordError::InvalidHash)
        .ok();

    if let Some(parsed_hash) = parsed_hash {
        // Create Argon2 verifier
        let argon2 = Argon2::default();

        // Verify the password
        argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    } else {
        false
    }
}
