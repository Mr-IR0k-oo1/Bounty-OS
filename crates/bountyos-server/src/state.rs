use crate::config::AppConfig;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::llm::OllamaClient;

pub type RedisPool = Arc<redis::Client>;

#[derive(Clone)]
pub struct AppState {
    db_pool: PgPool,
    redis_pool: RedisPool,
    config: AppConfig,
    ws_tx: broadcast::Sender<String>,
    /// Ollama client for LLM triage. None when llm.enabled = false.
    llm_client: Option<Arc<OllamaClient>>,
    /// Evidence base directory path (from config.evidence_base_path)
    evidence_base: std::path::PathBuf,
}

impl AppState {
    pub fn new(
        db_pool: PgPool,
        redis_pool: RedisPool,
        config: AppConfig,
        ws_tx: broadcast::Sender<String>,
    ) -> Self {
        let llm_client = Self::build_llm_client(&config);
        let evidence_base = std::path::PathBuf::from(&config.evidence_base_path);
        Self {
            db_pool,
            redis_pool,
            config,
            ws_tx,
            llm_client,
            evidence_base,
        }
    }

    pub fn db(&self) -> &PgPool {
        &self.db_pool
    }

    pub fn db_pool(&self) -> &PgPool {
        &self.db_pool
    }

    pub fn redis(&self) -> &redis::Client {
        &self.redis_pool
    }

    pub fn redis_pool(&self) -> &RedisPool {
        &self.redis_pool
    }

    pub fn redis_arc(&self) -> RedisPool {
        self.redis_pool.clone()
    }

    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    pub fn ws_tx(&self) -> &broadcast::Sender<String> {
        &self.ws_tx
    }

    pub fn evidence_base(&self) -> &std::path::PathBuf {
        &self.evidence_base
    }

    pub fn llm_client(&self) -> Option<&Arc<OllamaClient>> {
        self.llm_client.as_ref()
    }

    /// Build the LLM client from config, if enabled.
    pub fn build_llm_client(config: &AppConfig) -> Option<Arc<OllamaClient>> {
        if !config.llm.enabled {
            return None;
        }

        Some(Arc::new(OllamaClient::new(
            &config.llm.ollama_url,
            &config.llm.model,
            Duration::from_secs(config.llm.timeout_secs),
        )))
    }
}
