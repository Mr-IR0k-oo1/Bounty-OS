use crate::engine::ModelHypothesis;
use crate::errors::BountyError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelProvider {
    Ollama,
    LlamaCpp,
    Mock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelGatewayConfig {
    pub provider: ModelProvider,
    pub model_name: String,
    pub endpoint_url: String,
    pub temperature: f32,
}

impl Default for ModelGatewayConfig {
    fn default() -> Self {
        Self {
            provider: ModelProvider::Ollama,
            model_name: "vulnllm-r-7b".into(),
            endpoint_url: "http://localhost:11434".into(),
            temperature: 0.2,
        }
    }
}

/// Dynamic Model Gateway boundary.
/// Does not hardcode a single model into business logic.
/// Parses untrusted model responses and fails safely on invalid output.
#[derive(Clone)]
pub struct ModelGateway {
    config: ModelGatewayConfig,
}

#[derive(Debug, Deserialize)]
struct RawModelHypothesisPayload {
    pub target: Option<String>,
    pub vuln_class: Option<String>,
    pub hypothesis: Option<String>,
    pub confidence: Option<f32>,
    pub proposed_validation_step: Option<String>,
    pub required_evidence_type: Option<String>,
}

impl ModelGateway {
    pub fn new(config: ModelGatewayConfig) -> Self {
        Self { config }
    }

    pub fn with_model(model_name: impl Into<String>) -> Self {
        let mut cfg = ModelGatewayConfig::default();
        cfg.model_name = model_name.into();
        Self { config: cfg }
    }

    pub fn config(&self) -> &ModelGatewayConfig {
        &self.config
    }

    /// Clean model output: strips markdown formatting, code fences, etc.
    pub fn clean_model_output(raw: &str) -> String {
        let trimmed = raw.trim();
        // Remove ```json ... ``` or ``` ... ```
        if let Some(start) = trimmed.find("```") {
            let after_first = &trimmed[start + 3..];
            let content_start = if after_first.starts_with("json") {
                &after_first[4..]
            } else {
                after_first
            };
            if let Some(end) = content_start.find("```") {
                return content_start[..end].trim().to_string();
            }
        }
        trimmed.to_string()
    }

    /// Parse untrusted model response safely into typed `ModelHypothesis`.
    /// Fails safely with `BountyError::UntrustedModelError` if output is invalid.
    pub fn parse_model_response(
        &self,
        raw_output: &str,
        fallback_target: &str,
    ) -> Result<ModelHypothesis, BountyError> {
        let cleaned = Self::clean_model_output(raw_output);

        if cleaned.is_empty() {
            return Err(BountyError::UntrustedModelError(
                "Model returned empty response".into(),
            ));
        }

        let parsed: RawModelHypothesisPayload = serde_json::from_str(&cleaned).map_err(|e| {
            BountyError::UntrustedModelError(format!(
                "Failed to parse model JSON (model: {}): {e}. Raw content: {cleaned}",
                self.config.model_name
            ))
        })?;

        let vuln_class = parsed
            .vuln_class
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "Unknown Vulnerability".into());

        let hypothesis = parsed
            .hypothesis
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                BountyError::UntrustedModelError(
                    "Model output missing required 'hypothesis' field".into(),
                )
            })?;

        let target = parsed
            .target
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| fallback_target.to_string());

        let confidence = parsed.confidence.unwrap_or(0.5);
        let proposed_validation = parsed
            .proposed_validation_step
            .unwrap_or_else(|| "Manual inspection required".into());
        let required_evidence = parsed
            .required_evidence_type
            .unwrap_or_else(|| "HTTP_RESPONSE".into());

        Ok(ModelHypothesis::new(
            &self.config.model_name,
            target,
            vuln_class,
            hypothesis,
            confidence,
            proposed_validation,
            required_evidence,
        ))
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_json_parsing() {
        let gateway = ModelGateway::with_model("VulnLLM-R-7B");
        let raw = r#"{
            "target": "api.example.com",
            "vuln_class": "CWE-89",
            "hypothesis": "SQL injection in search",
            "confidence": 0.95,
            "proposed_validation_step": "Test with sleep probe",
            "required_evidence_type": "HTTP_RESPONSE"
        }"#;

        let res = gateway
            .parse_model_response(raw, "api.example.com")
            .unwrap();
        assert_eq!(res.model_id, "VulnLLM-R-7B");
        assert_eq!(res.vuln_class, "CWE-89");
        assert_eq!(res.confidence, 0.95);
        assert_eq!(res.hypothesis, "SQL injection in search");
    }

    #[test]
    fn test_code_fenced_json_parsing() {
        let gateway = ModelGateway::with_model("qwen2.5-coder:7b");
        let raw = "Here is the finding analysis:\n```json\n{\n  \"vuln_class\": \"XSS\",\n  \"hypothesis\": \"Reflected script payload in /search\",\n  \"confidence\": 0.8\n}\n```\nHope this helps!";

        let res = gateway.parse_model_response(raw, "example.com").unwrap();
        assert_eq!(res.model_id, "qwen2.5-coder:7b");
        assert_eq!(res.vuln_class, "XSS");
        assert_eq!(res.confidence, 0.8);
        assert_eq!(res.target, "example.com");
    }

    #[test]
    fn test_malformed_llm_output_fails_safely() {
        let gateway = ModelGateway::with_model("VulnLLM-R-7B");
        let gibberish =
            "I cannot determine if there is a vulnerability here. The target looks safe.";

        let err = gateway.parse_model_response(gibberish, "example.com");
        assert!(err.is_err());
        assert!(matches!(
            err.unwrap_err(),
            BountyError::UntrustedModelError(_)
        ));
    }
}
