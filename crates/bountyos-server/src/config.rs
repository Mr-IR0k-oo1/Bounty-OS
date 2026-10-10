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
    /// Server bind host/IP (defaults to 127.0.0.1 for private binding)
    #[serde(default = "default_host")]
    pub host: String,
    /// Server listening port (defaults to 8000)
    #[serde(default = "default_port")]
    pub port: u16,
    /// Maximum concurrent background scan jobs (conservative for 8GB RAM / 2-core machines)
    #[serde(default = "default_max_concurrent_jobs")]
    pub max_concurrent_jobs: usize,
    /// LLM triage subsystem configuration
    #[serde(default)]
    pub llm: LlmConfig,
}

fn default_evidence_base_path() -> String {
    "./evidence".to_string()
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8000
}

fn default_max_concurrent_jobs() -> usize {
    2
}

/// VulnLLM-R-7B / Ollama inference configuration
#[derive(Debug, Deserialize, Clone)]
pub struct LlmConfig {
    /// Enable or disable LLM triage. When false, triage endpoints return 501.
    #[serde(default)]
    pub enabled: bool,
    /// Base URL for the Ollama (or llama.cpp) server
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,
    /// Model name as registered in Ollama (e.g. "vulnllm-r-7b" or "llama3")
    #[serde(default = "default_model")]
    pub model: String,
    /// Inference timeout in seconds. 7B models on CPU may take 60–180s.
    #[serde(default = "default_timeout_secs")]
    pub timeout_secs: u64,
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn default_model() -> String {
    "vulnllm-r-7b".to_string()
}

fn default_timeout_secs() -> u64 {
    120
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

    // Database URL: explicit env var, derived from components, or config file
    if let Ok(v) = env::var("DATABASE_URL") {
        config.set("database_url", v)?;
    } else if let Ok(user) = env::var("POSTGRES_USER") {
        let pass = env::var("POSTGRES_PASSWORD").unwrap_or_default();
        let host = env::var("POSTGRES_HOST").unwrap_or_else(|_| "localhost".to_string());
        let port = env::var("POSTGRES_PORT").unwrap_or_else(|_| "5432".to_string());
        let db = env::var("POSTGRES_DB").unwrap_or_else(|_| "bountyos".to_string());
        let url = format!("postgres://{}:{}@{}:{}/{}", user, pass, host, port, db);
        config.set("database_url", url)?;
    } else if config.get_string("database_url").is_err() {
        config.set("database_url", "postgres://bountyos:bountyos@localhost:5432/bountyos")?;
    }

    // Redis URL: explicit env var, derived from components, or config file
    if let Ok(v) = env::var("REDIS_URL") {
        config.set("redis_url", v)?;
    } else if let Ok(pass) = env::var("REDIS_PASSWORD") {
        let host = env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string());
        let port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
        let url = format!("redis://:{}@{}:{}", pass, host, port);
        config.set("redis_url", url)?;
    } else if config.get_string("redis_url").is_err() {
        config.set("redis_url", "redis://127.0.0.1:6379")?;
    }
    if let Ok(v) = env::var("JWT_SECRET") {
        config.set("jwt_secret", v)?;
    }
    if let Ok(v) = env::var("FIRST_RUN") {
        if let Ok(b) = v.parse::<bool>() {
            config.set("first_run", b)?;
        }
    }
    if let Ok(v) = env::var("RUST_LOG") {
        config.set("rust_log", v)?;
    }

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
    // Host and port overrides
    if let Ok(val) = env::var("SERVER_HOST").or_else(|_| env::var("HOST")) {
        config.set("host", val)?;
    } else if let Ok(val) = config.get_string("server.host") {
        config.set("host", val)?;
    }

    if let Ok(val) = env::var("SERVER_PORT").or_else(|_| env::var("PORT")) {
        if let Ok(p) = val.parse::<i64>() {
            config.set("port", p)?;
        }
    } else if let Ok(p) = config.get_int("server.port") {
        config.set("port", p)?;
    }

    if let Ok(val) = env::var("MAX_CONCURRENT_JOBS") {
        if let Ok(m) = val.parse::<i64>() {
            config.set("max_concurrent_jobs", m)?;
        }
    }

    config.try_deserialize()
}
