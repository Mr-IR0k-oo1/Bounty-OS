//! Disagreement Handling & Empirical Validation (v0.5)
//!
//! Enforces the core architectural rule:
//! EMPIRICAL EVIDENCE ALWAYS OVERRIDES LLM BELIEFS.
//!
//! Case 1: VulnLLM = High Confidence, Tool = No Evidence, Verifier = Fail
//!   => Result: UNVERIFIED / REFUTED (No finding confirmed)
//!
//! Case 2: VulnLLM = Low Confidence, Tool = Evidence Found, Verifier = Success
//!   => Result: CONFIRMED (Empirical proof takes absolute authority)

use serde::{Deserialize, Serialize};

use crate::models::hypothesis::SecurityHypothesis;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceResolution {
    Confirmed,
    Unverified,
    FalsePositive,
    Refuted,
}

pub struct DisagreementValidator;

impl DisagreementValidator {
    /// Reconcile LLM hypothesis confidence with empirical tool output and verifier results
    pub fn evaluate(
        llm_confidence: f64,
        scanner_found_candidate: bool,
        verifier_reproduced: bool,
    ) -> (EvidenceResolution, String) {
        if verifier_reproduced {
            // Case 2: Real evidence reproducible -> CONFIRMED regardless of LLM confidence
            let note = if llm_confidence < 0.5 {
                format!(
                    "CONFIRMED by deterministic verifier (reproducible proof override: LLM confidence was only {:.2})",
                    llm_confidence
                )
            } else {
                format!(
                    "CONFIRMED by deterministic verifier with empirical PoC (LLM confidence {:.2} validated)",
                    llm_confidence
                )
            };
            (EvidenceResolution::Confirmed, note)
        } else if scanner_found_candidate && !verifier_reproduced {
            // Scanner flagged a candidate, but verifier could not reproduce reflection
            (
                EvidenceResolution::Unverified,
                "UNVERIFIED: Scanner candidate could not be verified deterministically via replay probe"
                    .to_string(),
            )
        } else {
            // Case 1: Tool produced no evidence / verifier cannot reproduce
            let note = if llm_confidence > 0.70 {
                format!(
                    "REFUTED: High-confidence LLM hypothesis ({:.2}) failed empirical validation (Zero evidence from ToolAdapter)",
                    llm_confidence
                )
            } else {
                "UNVERIFIED: No empirical evidence produced by tool execution".to_string()
            };
            (EvidenceResolution::Refuted, note)
        }
    }

    /// Reconcile active hypotheses against executed action outcomes
    pub fn reconcile_hypothesis(
        hypothesis: &mut SecurityHypothesis,
        tool: &str,
        is_success: bool,
        findings_generated: usize,
        confirmed_findings: usize,
    ) {
        // If this action was one of the suggested actions or matches the hypothesis target
        let relevant = hypothesis
            .suggested_actions
            .iter()
            .any(|act| act.contains(tool) || tool.contains(act))
            || tool == "verification"
            || tool == "dalfox"
            || tool == "nuclei";

        if !relevant {
            return;
        }

        if confirmed_findings > 0 {
            hypothesis.mark_validated();
        } else if is_success && findings_generated == 0 && (tool == "dalfox" || tool == "nuclei" || tool == "verification") {
            // Tool completed successfully with clean scan and found zero findings -> Hypothesis refuted
            hypothesis.mark_refuted();
        } else {
            hypothesis.status = "investigating".to_string();
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationError {
    TargetNotInGraph(String),
    TargetOutOfScope(String),
    InvalidConfidenceRange(f64),
    InvalidCategory(String),
    InvalidActionType(String),
    MismatchedInvestigationId { expected: uuid::Uuid, found: uuid::Uuid },
    EmptyRequiredEvidence,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::TargetNotInGraph(t) => {
                write!(f, "REJECTED: Target '{}' does not exist in investigation attack surface graph", t)
            }
            ValidationError::TargetOutOfScope(t) => {
                write!(f, "REJECTED: Target '{}' is outside authorized investigation scope", t)
            }
            ValidationError::InvalidConfidenceRange(c) => {
                write!(f, "REJECTED: Confidence {:.2} is outside legal numeric range [0.0, 1.0]", c)
            }
            ValidationError::InvalidCategory(cat) => {
                write!(f, "REJECTED: Invalid or empty hypothesis category '{}'", cat)
            }
            ValidationError::InvalidActionType(act) => {
                write!(f, "REJECTED: Suggested action '{}' does not map to a recognized legal tool action", act)
            }
            ValidationError::MismatchedInvestigationId { expected, found } => {
                write!(f, "REJECTED: Investigation ID mismatch (expected {}, found {})", expected, found)
            }
            ValidationError::EmptyRequiredEvidence => {
                write!(f, "REJECTED: Security hypothesis must define required verification evidence")
            }
        }
    }
}

pub struct LlmOutputValidator;

impl LlmOutputValidator {
    /// Strictly validate an LLM-generated hypothesis against attack surface graph, scope, and types
    pub fn validate_hypothesis(
        hypothesis: &SecurityHypothesis,
        investigation_id: uuid::Uuid,
        state: &crate::intelligence::state::InvestigationState,
    ) -> Result<(), ValidationError> {
        // 1. Investigation ID check
        if hypothesis.investigation_id != investigation_id {
            return Err(ValidationError::MismatchedInvestigationId {
                expected: investigation_id,
                found: hypothesis.investigation_id,
            });
        }

        // 2. Numeric range check [0.0, 1.0]
        if hypothesis.confidence < 0.0 || hypothesis.confidence > 1.0 || hypothesis.confidence.is_nan() {
            return Err(ValidationError::InvalidConfidenceRange(hypothesis.confidence));
        }

        // 3. Category validation
        if hypothesis.category.trim().is_empty() {
            return Err(ValidationError::InvalidCategory("Empty category".to_string()));
        }

        // 4. Scope validation: Target must be in authorized scope
        if !state.is_in_scope(&hypothesis.target) {
            return Err(ValidationError::TargetOutOfScope(hypothesis.target.clone()));
        }

        // 5. Target existence in attack surface graph: Target must exist in state
        let target_in_graph = state.target == hypothesis.target
            || state.hosts.iter().any(|h| h.host == hypothesis.target || h.ip.as_deref() == Some(&hypothesis.target))
            || state.subdomains.iter().any(|s| s.subdomain == hypothesis.target || s.ips.iter().any(|ip| ip == &hypothesis.target))
            || state.services.iter().any(|s| format!("{}:{}", s.host, s.port) == hypothesis.target || s.host == hypothesis.target)
            || state.endpoints.iter().any(|e| e.url == hypothesis.target || e.path == hypothesis.target || hypothesis.target.starts_with(&e.url));

        if !target_in_graph {
            return Err(ValidationError::TargetNotInGraph(hypothesis.target.clone()));
        }

        // 6. Action type validation: Suggested actions must be recognized
        for act in &hypothesis.suggested_actions {
            if !Self::is_valid_action_type(act) {
                return Err(ValidationError::InvalidActionType(act.clone()));
            }
        }

        Ok(())
    }

    /// Check if action type name is recognized
    pub fn is_valid_action_type(act: &str) -> bool {
        matches!(
            act.to_lowercase().as_str(),
            "subdomain_enumeration"
                | "dns_resolution"
                | "port_scan"
                | "http_probe"
                | "endpoint_crawl"
                | "historical_urls"
                | "path_fuzz"
                | "parameter_discovery"
                | "tech_vulnerability_scan"
                | "xss_analysis"
                | "finding_verification"
                | "subfinder"
                | "dnsx"
                | "naabu"
                | "httpx"
                | "katana"
                | "gau"
                | "ffuf"
                | "nuclei"
                | "dalfox"
                | "verification"
                | "stop"
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{InvestigationProfile, InvestigationState, ScopeBoundary};

    #[test]
    fn test_high_llm_confidence_refuted_without_evidence() {
        // LLM claimed 0.95 confidence, but tool found nothing and verifier failed
        let (resolution, note) = DisagreementValidator::evaluate(0.95, false, false);
        assert_eq!(resolution, EvidenceResolution::Refuted);
        assert!(note.contains("REFUTED"));
    }

    #[test]
    fn test_low_llm_confidence_confirmed_with_reproducible_evidence() {
        // LLM had low confidence 0.20, but scanner found candidate and verifier reproduced
        let (resolution, note) = DisagreementValidator::evaluate(0.20, true, true);
        assert_eq!(resolution, EvidenceResolution::Confirmed);
        assert!(note.contains("override"));
    }

    #[test]
    fn test_validation_rejects_target_not_in_graph() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let inv_id = uuid::Uuid::new_v4();
        let hyp = SecurityHypothesis::new(
            inv_id,
            "xss",
            "http://nonexistent-hallucination.local/secret",
            "Hallucinated target by model",
            0.90,
            vec!["xss_analysis".to_string()],
            vec!["reflection".to_string()],
        );

        let res = LlmOutputValidator::validate_hypothesis(&hyp, inv_id, &state);
        assert!(matches!(res, Err(ValidationError::TargetNotInGraph(_))));
    }

    #[test]
    fn test_validation_rejects_out_of_scope_target() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        scope.excluded_hosts.push("evil.com".to_string());
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let inv_id = uuid::Uuid::new_v4();
        let hyp = SecurityHypothesis::new(
            inv_id,
            "xss",
            "evil.com",
            "Out of scope target recommended by model",
            0.80,
            vec!["xss_analysis".to_string()],
            vec!["reflection".to_string()],
        );

        let res = LlmOutputValidator::validate_hypothesis(&hyp, inv_id, &state);
        assert!(matches!(res, Err(ValidationError::TargetOutOfScope(_))));
    }

    #[test]
    fn test_validation_rejects_invalid_confidence() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let inv_id = uuid::Uuid::new_v4();
        let mut hyp = SecurityHypothesis::new(
            inv_id,
            "xss",
            "target.local",
            "Test",
            0.5,
            vec!["xss_analysis".to_string()],
            vec!["reflection".to_string()],
        );
        hyp.confidence = 1.85; // Malformed range

        let res = LlmOutputValidator::validate_hypothesis(&hyp, inv_id, &state);
        assert!(matches!(res, Err(ValidationError::InvalidConfidenceRange(_))));
    }

    #[test]
    fn test_validation_rejects_invalid_action_type() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let inv_id = uuid::Uuid::new_v4();
        let hyp = SecurityHypothesis::new(
            inv_id,
            "xss",
            "target.local",
            "Test",
            0.75,
            vec!["rm_rf_root_exploit".to_string()],
            vec!["reflection".to_string()],
        );

        let res = LlmOutputValidator::validate_hypothesis(&hyp, inv_id, &state);
        assert!(matches!(res, Err(ValidationError::InvalidActionType(_))));
    }

    #[test]
    fn test_validation_accepts_valid_hypothesis() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.add_endpoint("http://target.local/search?q=test", "katana");

        let inv_id = uuid::Uuid::new_v4();
        let hyp = SecurityHypothesis::new(
            inv_id,
            "xss",
            "http://target.local/search?q=test",
            "Reflected parameter in crawled endpoint",
            0.85,
            vec!["xss_analysis".to_string()],
            vec!["HTTP reflection probe confirmation".to_string()],
        );

        let res = LlmOutputValidator::validate_hypothesis(&hyp, inv_id, &state);
        assert!(res.is_ok());
    }
}

