use crate::errors::BountyError;
use crate::ids::{EvidenceId, FindingId, ProgramId, TargetId};
use crate::models::{Evidence, EvidenceType, Finding, FindingLifecycleStatus};
use crate::types::Severity;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Evidence storage abstraction for keeping large binary artifacts outside relational database rows.
#[derive(Clone, Default)]
pub struct EvidenceStore {
    // In-memory backing simulating artifact directory/blob store
    artifacts: Arc<RwLock<HashMap<String, Vec<u8>>>>,
    metadata: Arc<RwLock<HashMap<EvidenceId, Evidence>>>,
}

impl EvidenceStore {
    pub fn new() -> Self {
        Self {
            artifacts: Arc::new(RwLock::new(HashMap::new())),
            metadata: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Store a raw artifact content-addressed by its SHA-256 hash
    pub async fn store_payload(
        &self,
        finding_id: Option<FindingId>,
        evidence_type: EvidenceType,
        content_type: impl Into<String>,
        raw_bytes: &[u8],
    ) -> Result<Evidence, BountyError> {
        let hash = Evidence::compute_sha256(raw_bytes);
        let storage_ref = format!("evidence/{}.dat", hash);

        {
            let mut artifacts = self.artifacts.write().await;
            artifacts.insert(storage_ref.clone(), raw_bytes.to_vec());
        }

        let ev = Evidence {
            id: EvidenceId::new(),
            finding_id,
            job_id: None,
            evidence_type,
            data_hash: hash,
            storage_reference: storage_ref,
            content_type: content_type.into(),
            byte_size: raw_bytes.len(),
            captured_at: Utc::now(),
        };

        {
            let mut meta = self.metadata.write().await;
            meta.insert(ev.id, ev.clone());
        }

        Ok(ev)
    }

    /// Retrieve raw artifact bytes and verify integrity
    pub async fn get_and_verify_payload(
        &self,
        evidence_id: EvidenceId,
    ) -> Result<Vec<u8>, BountyError> {
        let meta = {
            let meta_guard = self.metadata.read().await;
            meta_guard.get(&evidence_id).cloned().ok_or_else(|| {
                BountyError::NotFound(format!(
                    "Evidence metadata for ID {} not found",
                    evidence_id
                ))
            })?
        };

        let raw_bytes = {
            let art_guard = self.artifacts.read().await;
            art_guard
                .get(&meta.storage_reference)
                .cloned()
                .ok_or_else(|| {
                    BountyError::NotFound(format!(
                        "Artifact data at reference '{}' not found",
                        meta.storage_reference
                    ))
                })?
        };

        meta.verify_integrity(&raw_bytes)?;
        Ok(raw_bytes)
    }

    pub async fn get_metadata(&self, evidence_id: EvidenceId) -> Option<Evidence> {
        let meta = self.metadata.read().await;
        meta.get(&evidence_id).cloned()
    }
}

/// Candidate Finding Creation Specification
#[derive(Debug, Clone)]
pub struct CandidateFindingSpec {
    pub program_id: ProgramId,
    pub target_id: Option<TargetId>,
    pub endpoint: Option<String>,
    pub title: String,
    pub vuln_class: String,
    pub severity: Severity,
    pub hypothesis: String,
    pub confidence: f32,
    pub proposed_validation: String,
    pub required_evidence: String,
    pub source_model_run: Option<String>,
}

/// Comprehensive Finding & Evidence Engine
#[derive(Clone, Default)]
pub struct FindingsEngine {
    findings: Arc<RwLock<HashMap<FindingId, Finding>>>,
    evidence_store: EvidenceStore,
}

impl FindingsEngine {
    pub fn new(evidence_store: EvidenceStore) -> Self {
        Self {
            findings: Arc::new(RwLock::new(HashMap::new())),
            evidence_store,
        }
    }

    pub fn evidence_store(&self) -> &EvidenceStore {
        &self.evidence_store
    }

    /// Ingest a candidate finding hypothesis (e.g. from VulnLLM-R-7B model run).
    /// GUARANTEE: Never directly creates a CONFIRMED finding! Always starts as CANDIDATE.
    pub async fn create_candidate(
        &self,
        spec: CandidateFindingSpec,
    ) -> Result<Finding, BountyError> {
        let mut finding =
            Finding::new_discovered(spec.program_id, spec.title, spec.vuln_class, spec.severity)?;

        finding.target_id = spec.target_id;
        finding.endpoint = spec.endpoint;

        // Transition from Discovered to Candidate
        finding.to_candidate(
            spec.hypothesis,
            spec.confidence,
            spec.proposed_validation,
            spec.required_evidence,
            spec.source_model_run,
        )?;

        let mut store = self.findings.write().await;
        store.insert(finding.id, finding.clone());
        Ok(finding)
    }

    /// Store a raw payload artifact and link it directly to the finding
    pub async fn attach_new_evidence(
        &self,
        finding_id: FindingId,
        evidence_type: EvidenceType,
        content_type: impl Into<String>,
        raw_bytes: &[u8],
    ) -> Result<Evidence, BountyError> {
        let ev = self
            .evidence_store
            .store_payload(Some(finding_id), evidence_type, content_type, raw_bytes)
            .await?;

        let mut store = self.findings.write().await;
        let finding = store
            .get_mut(&finding_id)
            .ok_or_else(|| BountyError::NotFound(format!("Finding {} not found", finding_id)))?;

        finding.attach_evidence(ev.id);
        Ok(ev)
    }

    /// Get finding by ID
    pub async fn get_finding(&self, id: FindingId) -> Option<Finding> {
        let store = self.findings.read().await;
        store.get(&id).cloned()
    }

    /// List all findings
    pub async fn list_findings(&self) -> Vec<Finding> {
        let store = self.findings.read().await;
        store.values().cloned().collect()
    }

    /// Transition lifecycle state of a finding
    pub async fn transition(
        &self,
        id: FindingId,
        target_status: FindingLifecycleStatus,
        reason: Option<String>,
    ) -> Result<Finding, BountyError> {
        let mut store = self.findings.write().await;
        let finding = store
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Finding {} not found", id)))?;

        match target_status {
            FindingLifecycleStatus::EvidenceRequired => {
                finding.require_evidence()?;
            }
            FindingLifecycleStatus::Validating => {
                finding.start_validating()?;
            }
            FindingLifecycleStatus::Confirmed => {
                finding.confirm()?;
            }
            FindingLifecycleStatus::Rejected => {
                finding
                    .reject(reason.unwrap_or_else(|| "Validation rejected hypothesis".into()))?;
            }
            FindingLifecycleStatus::ReportReady => {
                finding.mark_report_ready()?;
            }
            FindingLifecycleStatus::Reviewed => {
                finding.mark_reviewed()?;
            }
            FindingLifecycleStatus::Exported => {
                finding.mark_exported()?;
            }
            _ => {
                return Err(BountyError::InvalidStateTransition {
                    from: finding.status.to_string(),
                    to: target_status.to_string(),
                    entity: "Finding".to_string(),
                });
            }
        }

        Ok(finding.clone())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_candidate_creation_never_auto_confirms() {
        let evidence_store = EvidenceStore::new();
        let engine = FindingsEngine::new(evidence_store);

        let prog_id = ProgramId::new();
        let spec = CandidateFindingSpec {
            program_id: prog_id,
            target_id: None,
            endpoint: Some("/api/v1/search".into()),
            title: "Potential Reflected XSS in search query".into(),
            vuln_class: "CWE-79".into(),
            severity: Severity::Medium,
            hypothesis: "The 'q' parameter is echoed in HTML without htmlspecialchars".into(),
            confidence: 0.85,
            proposed_validation: "Send probe with harmless HTML tags and examine response".into(),
            required_evidence: "HTTP response body containing unescaped markup".into(),
            source_model_run: Some("VulnLLM-R-7B-run-42".into()),
        };

        let candidate = engine.create_candidate(spec).await.unwrap();

        // Must start in CANDIDATE state, NEVER Confirmed
        assert_eq!(candidate.status, FindingLifecycleStatus::Candidate);
        assert_eq!(candidate.confidence, 0.85);
        assert!(candidate.evidence_ids.is_empty());
    }

    #[tokio::test]
    async fn test_evidence_attachment_and_integrity_verification() {
        let evidence_store = EvidenceStore::new();
        let engine = FindingsEngine::new(evidence_store);

        let prog_id = ProgramId::new();
        let candidate = engine
            .create_candidate(CandidateFindingSpec {
                program_id: prog_id,
                target_id: None,
                endpoint: Some("/auth/login".into()),
                title: "SQL Injection in Username".into(),
                vuln_class: "CWE-89".into(),
                severity: Severity::High,
                hypothesis: "Single quote triggers syntax error in query".into(),
                confidence: 0.9,
                proposed_validation: "Send username ' OR 1=1 --".into(),
                required_evidence: "SQL error message in HTTP response".into(),
                source_model_run: None,
            })
            .await
            .unwrap();

        let raw_payload =
            b"HTTP/1.1 500 Internal Server Error\r\n\r\nSyntax error in SQL statement";
        let ev = engine
            .attach_new_evidence(
                candidate.id,
                EvidenceType::HttpResponse,
                "text/plain",
                raw_payload,
            )
            .await
            .unwrap();

        assert_eq!(ev.finding_id, Some(candidate.id));
        assert!(ev.storage_reference.starts_with("evidence/"));

        // Retrieve and verify data integrity
        let verified_bytes = engine
            .evidence_store()
            .get_and_verify_payload(ev.id)
            .await
            .unwrap();
        assert_eq!(verified_bytes, raw_payload);

        // Updated finding has the evidence attached
        let updated = engine.get_finding(candidate.id).await.unwrap();
        assert_eq!(updated.evidence_ids.len(), 1);
        assert_eq!(updated.evidence_ids[0], ev.id);
    }

    #[tokio::test]
    async fn test_strict_lifecycle_and_rejection_of_invalid_transitions() {
        let evidence_store = EvidenceStore::new();
        let engine = FindingsEngine::new(evidence_store);

        let prog_id = ProgramId::new();
        let candidate = engine
            .create_candidate(CandidateFindingSpec {
                program_id: prog_id,
                target_id: None,
                endpoint: Some("/vuln".into()),
                title: "Candidate Test".into(),
                vuln_class: "IDOR".into(),
                severity: Severity::High,
                hypothesis: "User can access other profiles".into(),
                confidence: 0.7,
                proposed_validation: "Access ID 2 with ID 1 token".into(),
                required_evidence: "Profile 2 data returned".into(),
                source_model_run: None,
            })
            .await
            .unwrap();

        // 1. Direct confirmation from CANDIDATE must fail!
        let direct_confirm = engine
            .transition(candidate.id, FindingLifecycleStatus::Confirmed, None)
            .await;
        assert!(direct_confirm.is_err());

        // 2. Transition CANDIDATE -> VALIDATING
        let validating = engine
            .transition(candidate.id, FindingLifecycleStatus::Validating, None)
            .await
            .unwrap();
        assert_eq!(validating.status, FindingLifecycleStatus::Validating);

        // 3. Confirming without evidence must fail!
        let confirm_without_evidence = engine
            .transition(candidate.id, FindingLifecycleStatus::Confirmed, None)
            .await;
        assert!(confirm_without_evidence.is_err());
        assert!(matches!(
            confirm_without_evidence.unwrap_err(),
            BountyError::InsufficientEvidence(_)
        ));

        // 4. Attach evidence and confirm
        engine
            .attach_new_evidence(
                candidate.id,
                EvidenceType::HttpResponse,
                "application/json",
                b"{\"user_id\": 2, \"email\": \"victim@test.com\"}",
            )
            .await
            .unwrap();

        let confirmed = engine
            .transition(candidate.id, FindingLifecycleStatus::Confirmed, None)
            .await
            .unwrap();
        assert_eq!(confirmed.status, FindingLifecycleStatus::Confirmed);

        // 5. Subsequent steps to Exported
        let report_ready = engine
            .transition(candidate.id, FindingLifecycleStatus::ReportReady, None)
            .await
            .unwrap();
        assert_eq!(report_ready.status, FindingLifecycleStatus::ReportReady);

        let reviewed = engine
            .transition(candidate.id, FindingLifecycleStatus::Reviewed, None)
            .await
            .unwrap();
        assert_eq!(reviewed.status, FindingLifecycleStatus::Reviewed);

        let exported = engine
            .transition(candidate.id, FindingLifecycleStatus::Exported, None)
            .await
            .unwrap();
        assert_eq!(exported.status, FindingLifecycleStatus::Exported);
    }

    #[tokio::test]
    async fn test_candidate_rejection_flow() {
        let evidence_store = EvidenceStore::new();
        let engine = FindingsEngine::new(evidence_store);

        let prog_id = ProgramId::new();
        let candidate = engine
            .create_candidate(CandidateFindingSpec {
                program_id: prog_id,
                target_id: None,
                endpoint: Some("/admin".into()),
                title: "Open Admin Panel".into(),
                vuln_class: "AuthBypass".into(),
                severity: Severity::Medium,
                hypothesis: "Admin panel accessible without auth".into(),
                confidence: 0.5,
                proposed_validation: "GET /admin".into(),
                required_evidence: "HTTP 200".into(),
                source_model_run: None,
            })
            .await
            .unwrap();

        let rejected = engine
            .transition(
                candidate.id,
                FindingLifecycleStatus::Rejected,
                Some("Returned 401 Unauthorized with valid redirect".into()),
            )
            .await
            .unwrap();

        assert_eq!(rejected.status, FindingLifecycleStatus::Rejected);

        // Cannot confirm a rejected finding
        let invalid_res = engine
            .transition(candidate.id, FindingLifecycleStatus::Confirmed, None)
            .await;
        assert!(invalid_res.is_err());
    }
}
