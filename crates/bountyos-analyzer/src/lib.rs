pub mod analysis;
pub mod analyzer;
pub mod cwe;

pub use analyzer::types;
pub use analyzer::{
    ast::{classify_cwe_ast, parse_c},
    correlator::Correlator,
    ollama::OllamaAnalyzer,
    rules::RuleAnalyzer,
    types::{AnalysisResult, DetectionSource, SecurityFinding, Severity, ValidationStatus},
    VulnerabilityAnalyzer,
};

/// High-level vulnerability analysis engine that runs both deterministic rules
/// and VulnLLM-R-secure, then correlates their findings into a canonical SecurityFinding.
#[derive(Clone)]
pub struct VulnerabilityAnalysisEngine {
    llm: Option<OllamaAnalyzer>,
    rules: RuleAnalyzer,
}

impl Default for VulnerabilityAnalysisEngine {
    fn default() -> Self {
        Self::new(None, None)
    }
}

impl VulnerabilityAnalysisEngine {
    pub fn new(ollama_endpoint: Option<String>, model: Option<String>) -> Self {
        let llm = ollama_endpoint.map(|endpoint| {
            let model_name = model.unwrap_or_else(|| "vulnllm-r-secure".to_string());
            OllamaAnalyzer::new(endpoint, model_name)
        });

        Self {
            llm,
            rules: RuleAnalyzer::new(),
        }
    }

    pub async fn analyze(
        &self,
        source: &str,
    ) -> Result<AnalysisResult, Box<dyn std::error::Error + Send + Sync>> {
        let rule_result = self.rules.analyze(source).await?;

        if let Some(ref llm) = self.llm {
            match llm.analyze(source).await {
                Ok(llm_result) => Ok(Correlator::correlate(&llm_result, &rule_result)),
                Err(err) => {
                    tracing::warn!(
                        "LLM analyzer query failed, falling back to rule analysis: {}",
                        err
                    );
                    Ok(rule_result)
                }
            }
        } else {
            Ok(rule_result)
        }
    }
}
