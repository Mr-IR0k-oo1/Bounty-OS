#![allow(unused_imports, dead_code)]

pub mod ast;
pub mod correlator;
pub mod ollama;
pub mod rules;
pub mod types;

pub use correlator::Correlator;
pub use ollama::OllamaAnalyzer;
pub use rules::RuleAnalyzer;
pub use types::{AnalysisResult, DetectionSource, SecurityFinding, Severity, ValidationStatus};

#[async_trait::async_trait]
pub trait VulnerabilityAnalyzer {
    async fn analyze(
        &self,
        source: &str,
    ) -> Result<AnalysisResult, Box<dyn std::error::Error + Send + Sync>>;
}
