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
    /// Path to the evidence directory (bind-mounted in Docker)
    #[serde(default = "default_evidence_base_path")]
    pub evidence_base_path: String,
    /// LLM triage subsystem configuration
    #[serde(default)]
    pub llm: LlmConfig,
}

fn default_evidence_base_path() -> String {
    "./evidence".to_string()
}

/// VulnLLM-R-7B / Ollama inference configuration
#[derive(Debug, Deserialize, Clone)]
pub struct LlmConfig {
    /// Enable or disable LLM triage. When false, triage endpoints return 501.
    pub enabled: bool,
    /// Base URL for the Ollama (or llama.cpp) server
    pub ollama_url: String,
    /// Model name as registered in Ollama (e.g. "vulnllm-r-7b" or "llama3")
    pub model: String,
    /// Inference timeout in seconds. 7B models on CPU may take 60–180s.
    pub timeout_secs: u64,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            ollama_url: "http://localhost:11434".to_string(),
            model: "vulnllm-r-7b".to_string(),
            timeout_secs: 120,
        }
    }
}

/// Load configuration from YAML file and environment variables
pub fn load_config() -> Result<AppConfig, config::ConfigError> {
    // Load .env file if present
    if let Ok(content) = std::fs::read_to_string(".env") {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let k = k.trim();
                let v = v.trim().trim_matches('"').trim_matches('\'');
                if env::var(k).is_err() {
                    env::set_var(k, v);
                }
            }
        }
    }

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

    // Evidence base path
    if let Ok(val) = env::var("EVIDENCE_BASE_PATH") {
        config.set("evidence_base_path", val)?;
    } else if config.get_string("evidence_base_path").is_err() {
        if let Ok(base) = config.get_string("evidence.base_path") {
            config.set("evidence_base_path", base)?;
        } else {
            config.set("evidence_base_path", "./evidence")?;
        }
    }

    // LLM overrides via env (useful for Docker Compose)
    if let Ok(val) = env::var("LLM_ENABLED") {
        config.set("llm.enabled", val.parse::<bool>().ok())?;
    }
    if let Ok(val) = env::var("LLM_OLLAMA_URL") {
        config.set("llm.ollama_url", Some(val))?;
    }
    if let Ok(val) = env::var("LLM_MODEL") {
        config.set("llm.model", Some(val))?;
    }

    config.try_deserialize()
}
