use super::types::{AnalysisResult, DetectionSource, SecurityFinding, ValidationStatus};

pub struct Correlator;

impl Correlator {
    pub fn correlate(llm: &AnalysisResult, rules: &AnalysisResult) -> AnalysisResult {
        match (
            llm.finding.vulnerability.is_some(),
            rules.finding.vulnerability.is_some(),
        ) {
            // Both independently detected a vulnerability.
            (true, true) => Self::confirmed(llm, rules),

            // Only the LLM detected it.
            (true, false) => Self::candidate(llm),

            // Only deterministic analysis detected it.
            (false, true) => Self::confirmed_rule_only(rules),

            // Neither detected anything.
            (false, false) => Self::rejected(llm),
        }
    }

    fn confirmed(primary: &AnalysisResult, secondary: &AnalysisResult) -> AnalysisResult {
        let mut finding = primary.finding.clone();

        // Prefer deterministic CWE classification when available.
        if let Some(cwe) = &secondary.finding.cwe {
            finding.cwe = Some(cwe.clone());
        }

        // Calibrated composite confidence: 0.80 + 0.15 * llm_conf (range 0.80 - 0.95)
        let llm_conf = primary.finding.confidence.clamp(0.0, 1.0);
        finding.confidence = 0.80 + 0.15 * llm_conf;
        finding.detection_source = DetectionSource::Correlated;
        finding.validation_status = ValidationStatus::Confirmed;

        AnalysisResult {
            finding,
            source: DetectionSource::Correlated,
            status: ValidationStatus::Confirmed,
        }
    }

    fn confirmed_rule_only(rules: &AnalysisResult) -> AnalysisResult {
        let mut finding = rules.finding.clone();
        finding.confidence = 0.85;
        finding.detection_source = DetectionSource::Correlated;
        finding.validation_status = ValidationStatus::Confirmed;

        AnalysisResult {
            finding,
            source: DetectionSource::Correlated,
            status: ValidationStatus::Confirmed,
        }
    }

    fn candidate(llm: &AnalysisResult) -> AnalysisResult {
        let mut finding = llm.finding.clone();

        // Calibrated composite confidence: 0.35 + 0.30 * llm_conf (range 0.35 - 0.65)
        let llm_conf = llm.finding.confidence.clamp(0.0, 1.0);
        finding.confidence = 0.35 + 0.30 * llm_conf;
        finding.detection_source = DetectionSource::Llm;
        finding.validation_status = ValidationStatus::Candidate;

        AnalysisResult {
            finding,
            source: DetectionSource::Llm,
            status: ValidationStatus::Candidate,
        }
    }

    fn rejected(_llm: &AnalysisResult) -> AnalysisResult {
        AnalysisResult {
            finding: SecurityFinding {
                vulnerability: None,
                cwe: None,
                severity: None,
                confidence: 0.0,
                evidence: "No vulnerability was confirmed by the available analyzers.".to_string(),
                impact: None,
                remediation: None,
                detection_source: DetectionSource::Correlated,
                validation_status: ValidationStatus::Rejected,
            },
            source: DetectionSource::Correlated,
            status: ValidationStatus::Rejected,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_finding(vuln: Option<&str>, cwe: Option<&str>) -> SecurityFinding {
        SecurityFinding {
            vulnerability: vuln.map(String::from),
            cwe: cwe.map(String::from),
            severity: None,
            confidence: 1.0,
            evidence: "evidence".into(),
            impact: None,
            remediation: None,
            detection_source: DetectionSource::Llm,
            validation_status: ValidationStatus::Candidate,
        }
    }

    #[test]
    fn test_correlate_both_vulnerable_yields_confirmed_and_prefers_rule_cwe() {
        let llm = AnalysisResult {
            finding: dummy_finding(Some("buffer overflow"), Some("120")),
            source: DetectionSource::Llm,
            status: ValidationStatus::Candidate,
        };
        let rules = AnalysisResult {
            finding: dummy_finding(Some("Format String"), Some("CWE-134")),
            source: DetectionSource::Rule,
            status: ValidationStatus::Confirmed,
        };

        let result = Correlator::correlate(&llm, &rules);
        assert_eq!(result.status, ValidationStatus::Confirmed);
        assert_eq!(result.source, DetectionSource::Correlated);
        assert_eq!(result.finding.cwe.as_deref(), Some("CWE-134"));
        assert!(result.finding.confidence >= 0.85);
    }

    #[test]
    fn test_correlate_llm_only_yields_candidate() {
        let llm = AnalysisResult {
            finding: dummy_finding(Some("IDOR"), Some("CWE-639")),
            source: DetectionSource::Llm,
            status: ValidationStatus::Candidate,
        };
        let rules = AnalysisResult {
            finding: dummy_finding(None, None),
            source: DetectionSource::Rule,
            status: ValidationStatus::Rejected,
        };

        let result = Correlator::correlate(&llm, &rules);
        assert_eq!(result.status, ValidationStatus::Candidate);
        assert_eq!(result.source, DetectionSource::Llm);
        assert!(result.finding.confidence <= 0.65);
    }

    #[test]
    fn test_correlate_rule_only_yields_confirmed() {
        let llm = AnalysisResult {
            finding: dummy_finding(None, None),
            source: DetectionSource::Llm,
            status: ValidationStatus::Rejected,
        };
        let rules = AnalysisResult {
            finding: dummy_finding(Some("Command Injection"), Some("CWE-78")),
            source: DetectionSource::Rule,
            status: ValidationStatus::Confirmed,
        };

        let result = Correlator::correlate(&llm, &rules);
        assert_eq!(result.status, ValidationStatus::Confirmed);
        assert_eq!(result.source, DetectionSource::Correlated);
        assert_eq!(result.finding.confidence, 0.85);
    }

    #[test]
    fn test_correlate_neither_yields_rejected() {
        let llm = AnalysisResult {
            finding: dummy_finding(None, None),
            source: DetectionSource::Llm,
            status: ValidationStatus::Rejected,
        };
        let rules = AnalysisResult {
            finding: dummy_finding(None, None),
            source: DetectionSource::Rule,
            status: ValidationStatus::Rejected,
        };

        let result = Correlator::correlate(&llm, &rules);
        assert_eq!(result.status, ValidationStatus::Rejected);
        assert_eq!(result.source, DetectionSource::Correlated);
        assert!(result.finding.vulnerability.is_none());
        assert_eq!(result.finding.confidence, 0.0);
    }
}
