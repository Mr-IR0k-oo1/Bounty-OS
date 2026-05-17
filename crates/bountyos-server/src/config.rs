//! Configuration loading and management

use config::{Config, File, FileFormat};
use serde::Deserialize;
use std::env;

/// Application configuration
#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub first_run: bool,
    pub rust_log: String,
}

/// Load configuration from YAML file and environment variables
pub fn load_config() -> Result<AppConfig, config::ConfigError> {
    // Start with default values
    let mut config = Config::builder()
        .add_source(File::new("config/config.yaml", FileFormat::Yaml))
        .add_source(
            config::Environment::with_prefix("BOUNTYOS")
                .prefix_separator("_")
                .separator("__"),
        )
        .build()?;

    // Override with environment variables
    config.set("database_url", env::var("DATABASE_URL").ok())?;
    config.set("redis_url", env::var("REDIS_URL").ok())?;
    config.set("jwt_secret", env::var("JWT_SECRET").ok())?;
    config.set(
        "first_run",
        env::var("FIRST_RUN")
            .ok()
            .map(|s| s.parse::<bool>().unwrap_or(false)),
    )?;
    config.set("rust_log", env::var("RUST_LOG").ok())?;

    // Deserialize the configuration
    config.try_deserialize()
}
