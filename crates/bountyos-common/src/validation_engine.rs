use crate::errors::BountyError;
use crate::findings_engine::FindingsEngine;
use crate::ids::FindingId;
use crate::models::{Evidence, EvidenceType, FindingLifecycleStatus};
use crate::scope::ScopePolicy;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================================================
// 1. Validation Test Types and Steps
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ValidationTestType {
    HttpStatusCheck,
    ResponseBodyContains,
    HeaderPresent,
    DeterministicProbe,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ValidationStep {
    pub name: String,
    pub test_type: ValidationTestType,
    pub expected_status: Option<u16>,
    pub expected_pattern: Option<String>,
    pub expected_header: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidationPlan {
    pub id: Uuid,
    pub finding_id: FindingId,
    pub target: String,
    pub endpoint: Option<String>,
    pub steps: Vec<ValidationStep>,
    pub required_evidence_type: EvidenceType,
    pub proposed_by: String,
    pub created_at: DateTime<Utc>,
}

impl ValidationPlan {
    pub fn new(
        finding_id: FindingId,
        target: impl Into<String>,
        endpoint: Option<String>,
        steps: Vec<ValidationStep>,
        required_evidence_type: EvidenceType,
        proposed_by: impl Into<String>,
    ) -> Result<Self, BountyError> {
        let tgt = target.into();
        if tgt.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Validation target cannot be empty".into(),
            ));
        }
        if steps.is_empty() {
            return Err(BountyError::ValidationFailed(
                "Validation plan must have at least one step".into(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            finding_id,
            target: tgt,
            endpoint,
            steps,
            required_evidence_type,
            proposed_by: proposed_by.into(),
            created_at: Utc::now(),
        })
    }
}

// ============================================================================
// 2. Controlled Execution Driver Trait
// ============================================================================

#[derive(Debug, Clone)]
pub struct StepExecutionOutput {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[async_trait::async_trait]
pub trait ValidationDriver: Send + Sync {
    async fn execute_step(
        &self,
        target: &str,
        endpoint: Option<&str>,
        step: &ValidationStep,
    ) -> Result<StepExecutionOutput, BountyError>;
}

// ============================================================================
// 3. Validation Outcome and Results
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ValidationOutcome {
    Confirmed,
    Rejected { reason: String },
    InsufficientEvidence { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub plan_id: Uuid,
    pub finding_id: FindingId,
    pub outcome: ValidationOutcome,
    pub evidence: Option<Evidence>,
    pub details: String,
    pub executed_at: DateTime<Utc>,
}

// ============================================================================
// 4. Validation Orchestrator Engine
// ============================================================================

#[derive(Clone)]
pub struct ValidationEngine {
    findings_engine: FindingsEngine,
}

impl ValidationEngine {
    pub fn new(findings_engine: FindingsEngine) -> Self {
        Self { findings_engine }
    }

    /// Orchestrate finding validation:
    /// Candidate → validation plan → scope/policy check → controlled test → evidence → validation result → finding state transition
    pub async fn validate_candidate<D: ValidationDriver>(
        &self,
        plan: &ValidationPlan,
        policy: &ScopePolicy,
        driver: &D,
    ) -> Result<ValidationResult, BountyError> {
        // Step 1: Strict Scope & Policy Boundary Check
        // Construct full URL/target representation
        let full_target = match &plan.endpoint {
            Some(ep) => {
                if plan.target.ends_with('/') || ep.starts_with('/') {
                    format!("{}{}", plan.target.trim_end_matches('/'), ep)
                } else {
                    format!("{}/{}", plan.target, ep)
                }
            }
            None => plan.target.clone(),
        };

        // Out-of-scope targets MUST NOT execute!
        policy.enforce(&full_target)?;

        // Step 2: Fetch finding and verify state
        let finding = self
            .findings_engine
            .get_finding(plan.finding_id)
            .await
            .ok_or_else(|| {
                BountyError::NotFound(format!("Finding {} not found", plan.finding_id))
            })?;

        if finding.status != FindingLifecycleStatus::Candidate
            && finding.status != FindingLifecycleStatus::EvidenceRequired
        {
            return Err(BountyError::InvalidStateTransition {
                from: finding.status.to_string(),
                to: "VALIDATING".to_string(),
                entity: "Finding".to_string(),
            });
        }

        // Transition finding to VALIDATING
        self.findings_engine
            .transition(plan.finding_id, FindingLifecycleStatus::Validating, None)
            .await?;

        // Step 3: Execute Controlled Test Steps Deterministically
        let mut all_passed = true;
        let mut failure_reason = String::new();
        let mut captured_evidence_payload = Vec::new();

        for step in &plan.steps {
            let output = driver
                .execute_step(&plan.target, plan.endpoint.as_deref(), step)
                .await?;

            // Check if output is completely empty (Insufficient Evidence)
            if output.body.is_empty() && step.test_type != ValidationTestType::HttpStatusCheck {
                all_passed = false;
                failure_reason = format!("Empty response received for step '{}'", step.name);
                break;
            }

            // Deterministic Assertions
            match step.test_type {
                ValidationTestType::HttpStatusCheck => {
                    if let Some(expected_status) = step.expected_status {
                        if output.status_code != expected_status {
                            all_passed = false;
                            failure_reason = format!(
                                "Step '{}' status mismatch: expected {}, got {}",
                                step.name, expected_status, output.status_code
                            );
                            break;
                        }
                    }
                }
                ValidationTestType::ResponseBodyContains => {
                    if let Some(ref pattern) = step.expected_pattern {
                        let body_str = String::from_utf8_lossy(&output.body);
                        if !body_str.contains(pattern) {
                            all_passed = false;
                            failure_reason = format!(
                                "Step '{}' pattern '{}' not found in response body",
                                step.name, pattern
                            );
                            break;
                        }
                    }
                }
                ValidationTestType::HeaderPresent => {
                    if let Some(ref expected_header) = step.expected_header {
                        let header_found = output
                            .headers
                            .iter()
                            .any(|(k, _)| k.eq_ignore_ascii_case(expected_header));
                        if !header_found {
                            all_passed = false;
                            failure_reason = format!(
                                "Step '{}' expected header '{}' missing from response",
                                step.name, expected_header
                            );
                            break;
                        }
                    }
                }
                ValidationTestType::DeterministicProbe => {
                    if let Some(expected_status) = step.expected_status {
                        if output.status_code != expected_status {
                            all_passed = false;
                            failure_reason = format!(
                                "Probe '{}' status mismatch: expected {}, got {}",
                                step.name, expected_status, output.status_code
                            );
                            break;
                        }
                    }
                    if let Some(ref pattern) = step.expected_pattern {
                        let body_str = String::from_utf8_lossy(&output.body);
                        if !body_str.contains(pattern) {
                            all_passed = false;
                            failure_reason =
                                format!("Probe '{}' pattern '{}' not found", step.name, pattern);
                            break;
                        }
                    }
                }
            }

            // Retain body bytes for evidence
            captured_evidence_payload = output.body;
        }

        // Step 4: Outcome Resolution & Finding State Transition
        let executed_at = Utc::now();

        if all_passed && !captured_evidence_payload.is_empty() {
            // Attach evidence to finding
            let ev = self
                .findings_engine
                .attach_new_evidence(
                    plan.finding_id,
                    plan.required_evidence_type,
                    "text/plain",
                    &captured_evidence_payload,
                )
                .await?;

            // Transition to CONFIRMED
            self.findings_engine
                .transition(plan.finding_id, FindingLifecycleStatus::Confirmed, None)
                .await?;

            Ok(ValidationResult {
                plan_id: plan.id,
                finding_id: plan.finding_id,
                outcome: ValidationOutcome::Confirmed,
                evidence: Some(ev),
                details:
                    "All deterministic validation steps passed successfully with evidence verified"
                        .into(),
                executed_at,
            })
        } else if failure_reason.contains("Empty response") {
            // Insufficient Evidence -> Transition finding back to EVIDENCE_REQUIRED
            self.findings_engine
                .transition(
                    plan.finding_id,
                    FindingLifecycleStatus::EvidenceRequired,
                    Some(failure_reason.clone()),
                )
                .await?;

            Ok(ValidationResult {
                plan_id: plan.id,
                finding_id: plan.finding_id,
                outcome: ValidationOutcome::InsufficientEvidence {
                    reason: failure_reason.clone(),
                },
                evidence: None,
                details: format!("Validation unresolved: {failure_reason}"),
                executed_at,
            })
        } else {
            // Failed Validation -> Transition finding to REJECTED
            self.findings_engine
                .transition(
                    plan.finding_id,
                    FindingLifecycleStatus::Rejected,
                    Some(failure_reason.clone()),
                )
                .await?;

            Ok(ValidationResult {
                plan_id: plan.id,
                finding_id: plan.finding_id,
                outcome: ValidationOutcome::Rejected {
                    reason: failure_reason.clone(),
                },
                evidence: None,
                details: format!("Validation failed: {failure_reason}"),
                executed_at,
            })
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::findings_engine::{CandidateFindingSpec, EvidenceStore};
    use crate::ids::ProgramId;
    use crate::models::Finding;
    use crate::types::{ScopeType, Severity};

    struct MockDriver {
        status_code: u16,
        body: Vec<u8>,
        headers: Vec<(String, String)>,
    }

    #[async_trait::async_trait]
    impl ValidationDriver for MockDriver {
        async fn execute_step(
            &self,
            _target: &str,
            _endpoint: Option<&str>,
            _step: &ValidationStep,
        ) -> Result<StepExecutionOutput, BountyError> {
            Ok(StepExecutionOutput {
                status_code: self.status_code,
                headers: self.headers.clone(),
                body: self.body.clone(),
            })
        }
    }

    async fn setup_test_finding_and_engine() -> (FindingsEngine, Finding, ScopePolicy) {
        let store = EvidenceStore::new();
        let engine = FindingsEngine::new(store);
        let prog_id = ProgramId::new();

        let mut policy = ScopePolicy::new(prog_id);
        policy.add_inclusion("example.com", ScopeType::Domain);
        policy.add_inclusion("*.example.com", ScopeType::Wildcard);
        policy.add_exclusion("forbidden.example.com", ScopeType::Domain);

        let candidate = engine
            .create_candidate(CandidateFindingSpec {
                program_id: prog_id,
                target_id: None,
                endpoint: Some("/api/user".into()),
                title: "Information Disclosure".into(),
                vuln_class: "CWE-200".into(),
                severity: Severity::High,
                hypothesis: "User endpoint leaks debug tokens".into(),
                confidence: 0.8,
                proposed_validation: "GET /api/user and check for debug_token".into(),
                required_evidence: "HTTP Response with debug_token".into(),
                source_model_run: Some("VulnLLM-R-7B".into()),
            })
            .await
            .unwrap();

        (engine, candidate, policy)
    }

    #[tokio::test]
    async fn test_successful_validation_confirms_finding() {
        let (findings_eng, candidate, policy) = setup_test_finding_and_engine().await;
        let val_engine = ValidationEngine::new(findings_eng.clone());

        let plan = ValidationPlan::new(
            candidate.id,
            "example.com",
            Some("/api/user".into()),
            vec![
                ValidationStep {
                    name: "Check HTTP 200".into(),
                    test_type: ValidationTestType::HttpStatusCheck,
                    expected_status: Some(200),
                    expected_pattern: None,
                    expected_header: None,
                },
                ValidationStep {
                    name: "Check Debug Token Pattern".into(),
                    test_type: ValidationTestType::ResponseBodyContains,
                    expected_status: None,
                    expected_pattern: Some("debug_token_xyz_123".into()),
                    expected_header: None,
                },
            ],
            EvidenceType::HttpResponse,
            "VulnLLM-R-7B",
        )
        .unwrap();

        let driver = MockDriver {
            status_code: 200,
            body: b"{\"user\": \"alice\", \"debug_token_xyz_123\": \"supersecret\"}".to_vec(),
            headers: vec![("Content-Type".into(), "application/json".into())],
        };

        let result = val_engine
            .validate_candidate(&plan, &policy, &driver)
            .await
            .unwrap();

        // Must be Confirmed
        assert_eq!(result.outcome, ValidationOutcome::Confirmed);
        assert!(result.evidence.is_some());

        // Finding in FindingsEngine must now be Confirmed
        let updated = findings_eng.get_finding(candidate.id).await.unwrap();
        assert_eq!(updated.status, FindingLifecycleStatus::Confirmed);
        assert_eq!(updated.evidence_ids.len(), 1);
    }

    #[tokio::test]
    async fn test_failed_validation_rejects_finding() {
        let (findings_eng, candidate, policy) = setup_test_finding_and_engine().await;
        let val_engine = ValidationEngine::new(findings_eng.clone());

        let plan = ValidationPlan::new(
            candidate.id,
            "example.com",
            Some("/api/user".into()),
            vec![ValidationStep {
                name: "Check Pattern".into(),
                test_type: ValidationTestType::ResponseBodyContains,
                expected_status: None,
                expected_pattern: Some("leaked_secret_key".into()),
                expected_header: None,
            }],
            EvidenceType::HttpResponse,
            "deterministic",
        )
        .unwrap();

        // Driver returns clean response without secret
        let driver = MockDriver {
            status_code: 200,
            body: b"{\"user\": \"alice\", \"status\": \"clean\"}".to_vec(),
            headers: vec![],
        };

        let result = val_engine
            .validate_candidate(&plan, &policy, &driver)
            .await
            .unwrap();

        // Must be Rejected
        assert!(matches!(result.outcome, ValidationOutcome::Rejected { .. }));

        // Finding in FindingsEngine must now be Rejected
        let updated = findings_eng.get_finding(candidate.id).await.unwrap();
        assert_eq!(updated.status, FindingLifecycleStatus::Rejected);

        // Cannot become confirmed
        let invalid = findings_eng
            .transition(candidate.id, FindingLifecycleStatus::Confirmed, None)
            .await;
        assert!(invalid.is_err());
    }

    #[tokio::test]
    async fn test_insufficient_evidence_leaves_unresolved() {
        let (findings_eng, candidate, policy) = setup_test_finding_and_engine().await;
        let val_engine = ValidationEngine::new(findings_eng.clone());

        let plan = ValidationPlan::new(
            candidate.id,
            "example.com",
            Some("/api/user".into()),
            vec![ValidationStep {
                name: "Check Body".into(),
                test_type: ValidationTestType::ResponseBodyContains,
                expected_status: None,
                expected_pattern: Some("token".into()),
                expected_header: None,
            }],
            EvidenceType::HttpResponse,
            "deterministic",
        )
        .unwrap();

        // Driver returns empty body (e.g. connection dropped or no content)
        let driver = MockDriver {
            status_code: 200,
            body: Vec::new(),
            headers: vec![],
        };

        let result = val_engine
            .validate_candidate(&plan, &policy, &driver)
            .await
            .unwrap();

        assert!(matches!(
            result.outcome,
            ValidationOutcome::InsufficientEvidence { .. }
        ));

        // Finding remains unresolved in EvidenceRequired state
        let updated = findings_eng.get_finding(candidate.id).await.unwrap();
        assert_eq!(updated.status, FindingLifecycleStatus::EvidenceRequired);
    }

    #[tokio::test]
    async fn test_out_of_scope_validation_is_denied_before_test_runs() {
        let (findings_eng, candidate, policy) = setup_test_finding_and_engine().await;
        let val_engine = ValidationEngine::new(findings_eng.clone());

        // Target forbidden.example.com is excluded in policy
        let plan = ValidationPlan::new(
            candidate.id,
            "forbidden.example.com",
            Some("/admin".into()),
            vec![ValidationStep {
                name: "Probe".into(),
                test_type: ValidationTestType::HttpStatusCheck,
                expected_status: Some(200),
                expected_pattern: None,
                expected_header: None,
            }],
            EvidenceType::HttpResponse,
            "VulnLLM-R-7B",
        )
        .unwrap();

        let driver = MockDriver {
            status_code: 200,
            body: b"admin".to_vec(),
            headers: vec![],
        };

        let res = val_engine.validate_candidate(&plan, &policy, &driver).await;
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), BountyError::ScopeViolation(_)));
    }
}
