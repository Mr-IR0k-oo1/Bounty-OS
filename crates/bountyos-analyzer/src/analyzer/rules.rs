use super::types::{
    AnalysisResult,
    DetectionSource,
    SecurityFinding,
    Severity,
    ValidationStatus,
};

use super::VulnerabilityAnalyzer;

use crate::analysis::{
    c::find_unbounded_stack_copies,
    rules::detect_buffer_overflow,
};

#[derive(Clone)]
pub struct RuleAnalyzer;

impl RuleAnalyzer {
    pub fn new() -> Self {
        Self
    }
}

impl Default for RuleAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl VulnerabilityAnalyzer for RuleAnalyzer {
    async fn analyze(
        &self,
        source: &str,
    ) -> Result<AnalysisResult, Box<dyn std::error::Error + Send + Sync>> {
        let findings = analyze_source(source);

        if let Some(finding) = findings.into_iter().next() {
            let severity = match finding.severity {
                "Low" => Severity::Low,
                "Medium" => Severity::Medium,
                "High" => Severity::High,
                "Critical" => Severity::Critical,
                _ => Severity::Medium,
            };

            return Ok(AnalysisResult {
                finding: SecurityFinding {
                    vulnerability: Some(
                        finding.vulnerability.to_string(),
                    ),
                    cwe: Some(finding.cwe.to_string()),
                    severity: Some(severity),
                    confidence: 1.0,
                    evidence: finding.evidence,
                    impact: Some(
                        "The supplied source demonstrates the vulnerable operation."
                            .to_string(),
                    ),
                    remediation: Some(
                        finding.remediation.to_string(),
                    ),
                    detection_source: DetectionSource::Rule,
                    validation_status: ValidationStatus::Confirmed,
                },
                source: DetectionSource::Rule,
                status: ValidationStatus::Confirmed,
            });
        }

        Ok(AnalysisResult {
            finding: SecurityFinding {
                vulnerability: None,
                cwe: None,
                severity: None,
                confidence: 1.0,
                evidence:
                    "No deterministic security rule matched the supplied source."
                        .to_string(),
                impact: None,
                remediation: None,
                detection_source: DetectionSource::Rule,
                validation_status: ValidationStatus::Rejected,
            },
            source: DetectionSource::Rule,
            status: ValidationStatus::Rejected,
        })
    }
}

fn analyze_source(
    source: &str,
) -> Vec<crate::analysis::rules::RuleFinding> {
    let facts = find_unbounded_stack_copies(source);

    facts
        .iter()
        .filter_map(detect_buffer_overflow)
        .collect()
}
