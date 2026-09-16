//! Async HTTP client for the Ollama inference API.
//!
//! Compatible with:
//!   - Ollama  (default, recommended)
//!   - llama.cpp --server mode (same /api/chat endpoint)
//!
//! The client does NOT stream — it waits for the complete response, then
//! extracts and validates the JSON from the model's message content.

use anyhow::{bail, Context};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::llm::schemas::TriageOutput;

/// Minimal response shapes from the Ollama /api/chat endpoint.
/// We only decode what we need — the full payload is much larger.
#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
    done: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

/// Client for the Ollama chat completions API.
#[derive(Debug, Clone)]
pub struct OllamaClient {
    http: Client,
    base_url: String,
    model: String,
}

impl OllamaClient {
    /// Create a new client.
    ///
    /// `base_url` — e.g. `http://localhost:11434`
    /// `model`    — e.g. `vulnllm-r-7b` or `llama3`
    /// `timeout`  — how long to wait for the model (default config: 120s)
    pub fn new(base_url: impl Into<String>, model: impl Into<String>, timeout: Duration) -> Self {
        let http = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to build reqwest client");

        Self {
            http,
            base_url: base_url.into().trim_end_matches('/').to_string(),
            model: model.into(),
        }
    }

    /// Check if Ollama is reachable and the model is available.
    pub async fn health_check(&self) -> anyhow::Result<bool> {
        let url = format!("{}/api/tags", self.base_url);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .context("Ollama not reachable")?;

        if !resp.status().is_success() {
            return Ok(false);
        }

        let body: serde_json::Value = resp.json().await.context("Failed to parse /api/tags")?;
        let models = body["models"].as_array().cloned().unwrap_or_default();
        let found = models
            .iter()
            .any(|m| m["name"].as_str().unwrap_or("").starts_with(&self.model));

        if !found {
            warn!(
                "Ollama health check: model '{}' not found in loaded models",
                self.model
            );
        }

        Ok(found)
    }

    /// Send a chat triage request to the model.
    ///
    /// `messages` — the system + user message array built by `prompts::build_messages`
    ///
    /// Returns a parsed `TriageOutput` or an error if the model's JSON is invalid.
    pub async fn chat(&self, messages: Vec<serde_json::Value>) -> anyhow::Result<TriageOutput> {
        let url = format!("{}/api/chat", self.base_url);

        let body = serde_json::json!({
            "model": self.model,
            "messages": messages,
            "stream": false,
            // Encourage deterministic, JSON-formatted responses
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 1024
            }
        });

        debug!("Sending triage request to Ollama model '{}'", self.model);

        let resp = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("Failed to send request to Ollama")?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            bail!("Ollama returned {}: {}", status, text);
        }

        let ollama_resp: OllamaChatResponse = resp
            .json()
            .await
            .context("Failed to deserialize Ollama response")?;

        if !ollama_resp.done {
            bail!("Ollama returned a non-done response — streaming may be partially active");
        }

        let content = ollama_resp.message.content.trim().to_string();
        info!(
            "Received {} chars from Ollama model '{}'",
            content.len(),
            self.model
        );

        self.parse_triage_output(&content)
    }

    /// Extract JSON from the model's text content and parse into `TriageOutput`.
    ///
    /// The model may (despite instructions) wrap the JSON in a code fence.
    /// We strip that defensively before parsing.
    fn parse_triage_output(&self, content: &str) -> anyhow::Result<TriageOutput> {
        // Strip markdown code fences if the model added them
        let json_str = strip_code_fence(content);

        let output: TriageOutput = serde_json::from_str(json_str).with_context(|| {
            format!("Model output was not valid TriageOutput JSON:\n{json_str}")
        })?;

        // Sanity-check the confidence range
        if output.confidence < 0.0 || output.confidence > 1.0 {
            warn!(
                "Model returned out-of-range confidence {:.2} — clamping",
                output.confidence
            );
        }

        Ok(output)
    }
}

/// Remove ```json ... ``` or ``` ... ``` wrappers from model output.
fn strip_code_fence(s: &str) -> &str {
    let s = s.trim();

    // Handle ```json\n...\n``` or ```\n...\n```
    if s.starts_with("```") {
        let after_fence = s
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_start_matches('\n');

        if let Some(end) = after_fence.rfind("```") {
            return after_fence[..end].trim();
        }
    }

    // If the content starts with '{', assume it's already clean JSON
    if let Some(start) = s.find('{') {
        if let Some(end) = s.rfind('}') {
            return &s[start..=end];
        }
    }

    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_json_code_fence() {
        let raw = "```json\n{\"finding_type\": \"IDOR\"}\n```";
        assert_eq!(strip_code_fence(raw), "{\"finding_type\": \"IDOR\"}");
    }

    #[test]
    fn strips_bare_code_fence() {
        let raw = "```\n{\"finding_type\": \"XSS\"}\n```";
        assert_eq!(strip_code_fence(raw), "{\"finding_type\": \"XSS\"}");
    }

    #[test]
    fn passthrough_clean_json() {
        let raw = "{\"finding_type\": \"SSRF\"}";
        assert_eq!(strip_code_fence(raw), raw);
    }
}
