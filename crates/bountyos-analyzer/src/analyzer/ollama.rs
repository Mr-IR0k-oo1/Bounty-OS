use reqwest::Client;
use serde::Deserialize;

use super::types::{AnalysisResult, DetectionSource, SecurityFinding, ValidationStatus};
use super::VulnerabilityAnalyzer;

#[derive(Clone)]
pub struct OllamaAnalyzer {
    client: Client,
    endpoint: String,
    model: String,
}

impl OllamaAnalyzer {
    pub fn new(endpoint: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.into(),
            model: model.into(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

#[async_trait::async_trait]
impl VulnerabilityAnalyzer for OllamaAnalyzer {
    async fn analyze(
        &self,
        source: &str,
    ) -> Result<AnalysisResult, Box<dyn std::error::Error + Send + Sync>> {
        let response = self
            .client
            .post(format!("{}/api/chat", self.endpoint))
            .json(&serde_json::json!({
                "model": self.model,
                "stream": false,
                "think": false,
                "messages": [
                    {
                        "role": "user",
                        "content": source
                    }
                ]
            }))
            .send()
            .await?
            .error_for_status()?;

        let response: OllamaResponse = response.json().await?;

        let json_content = extract_json(&response.message.content);
        let mut finding: SecurityFinding = serde_json::from_str(json_content)?;

        let vulnerable = finding
            .vulnerability
            .as_ref()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);

        let status = if vulnerable {
            ValidationStatus::Candidate
        } else {
            ValidationStatus::Rejected
        };

        finding.detection_source = DetectionSource::Llm;
        finding.validation_status = status;

        Ok(AnalysisResult {
            finding,
            source: DetectionSource::Llm,
            status,
        })
    }
}

/// Extract the outermost JSON object substring, ignoring leading/trailing text or reasoning tags.
fn extract_json(s: &str) -> &str {
    if let Some(start) = s.find('{') {
        let mut depth = 0;
        let mut in_string = false;
        let mut escape = false;

        for (i, c) in s[start..].char_indices() {
            if escape {
                escape = false;
                continue;
            }
            if c == '\\' {
                escape = true;
                continue;
            }
            if c == '"' {
                in_string = !in_string;
                continue;
            }
            if !in_string {
                if c == '{' {
                    depth += 1;
                } else if c == '}' {
                    depth -= 1;
                    if depth == 0 {
                        return &s[start..start + i + 1];
                    }
                }
            }
        }
    }
    s.trim()
}
