use crate::errors::BountyError;
use crate::ids::*;
pub use crate::types::{Platform, ScopeType, Severity};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

// ============================================================================
// 1. Program
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Program {
    pub id: ProgramId,
    pub name: String,
    pub platform: Platform,
    pub url: Option<String>,
    pub bounty_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Program {
    pub fn new(name: impl Into<String>, platform: Platform) -> Self {
        let now = Utc::now();
        Self {
            id: ProgramId::new(),
            name: name.into(),
            platform,
            url: None,
            bounty_enabled: true,
            created_at: now,
            updated_at: now,
        }
    }
}

// ============================================================================
// 2. Scope
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Scope {
    pub id: ScopeId,
    pub program_id: ProgramId,
    pub target: String,
    pub scope_type: ScopeType,
    pub is_in_scope: bool,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Scope {
    pub fn new(
        program_id: ProgramId,
        target: impl Into<String>,
        scope_type: ScopeType,
        is_in_scope: bool,
    ) -> Result<Self, BountyError> {
        let t = target.into();
        if t.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Scope target cannot be empty".into(),
            ));
        }
        Ok(Self {
            id: ScopeId::new(),
            program_id,
            target: t,
            scope_type,
            is_in_scope,
            description: None,
            created_at: Utc::now(),
        })
    }
}

// ============================================================================
// 3. Target
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Target {
    pub id: TargetId,
    pub program_id: ProgramId,
    pub identifier: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl Target {
    pub fn new(program_id: ProgramId, identifier: impl Into<String>) -> Result<Self, BountyError> {
        let id_str = identifier.into();
        if id_str.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Target identifier cannot be empty".into(),
            ));
        }
        Ok(Self {
            id: TargetId::new(),
            program_id,
            identifier: id_str,
            is_active: true,
            created_at: Utc::now(),
        })
    }
}

// ============================================================================
// 4. Asset & Provenance
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetType {
    Domain,
    Subdomain,
    IpAddress,
    Port,
    Url,
    Service,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Asset {
    pub id: AssetId,
    pub program_id: ProgramId,
    pub target_id: Option<TargetId>,
    pub asset_type: AssetType,
    pub value: String,
    pub source_tool: Option<String>,
    pub source_job_id: Option<JobId>,
    pub parent_asset_id: Option<AssetId>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

impl Asset {
    pub fn new(
        program_id: ProgramId,
        asset_type: AssetType,
        value: impl Into<String>,
        source_tool: Option<String>,
        source_job_id: Option<JobId>,
    ) -> Result<Self, BountyError> {
        let val = value.into();
        if val.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Asset value cannot be empty".into(),
            ));
        }
        let now = Utc::now();
        Ok(Self {
            id: AssetId::new(),
            program_id,
            target_id: None,
            asset_type,
            value: val,
            source_tool,
            source_job_id,
            parent_asset_id: None,
            first_seen: now,
            last_seen: now,
        })
    }

    pub fn update_last_seen(&mut self) {
        self.last_seen = Utc::now();
    }
}

// ============================================================================
// 5. Endpoint & Parameter
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
    Options,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParameterType {
    Query,
    Body,
    Header,
    Cookie,
    Path,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Parameter {
    pub name: String,
    pub param_type: ParameterType,
    pub sample_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Endpoint {
    pub id: Uuid,
    pub program_id: ProgramId,
    pub asset_id: Option<AssetId>,
    pub url: String,
    pub method: HttpMethod,
    pub status_code: Option<u16>,
    pub parameters: Vec<Parameter>,
    pub created_at: DateTime<Utc>,
}

impl Endpoint {
    pub fn new(
        program_id: ProgramId,
        url: impl Into<String>,
        method: HttpMethod,
    ) -> Result<Self, BountyError> {
        let u = url.into();
        if u.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Endpoint URL cannot be empty".into(),
            ));
        }
        Ok(Self {
            id: Uuid::new_v4(),
            program_id,
            asset_id: None,
            url: u,
            method,
            status_code: None,
            parameters: Vec::new(),
            created_at: Utc::now(),
        })
    }
}

// ============================================================================
// 6. Job
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobCategory {
    Recon,
    ToolExecution,
    Analysis,
    Validation,
    EvidenceProcessing,
    Reporting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobExecutionState {
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    Timeout,
}

impl fmt::Display for JobExecutionState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JobExecutionState::Queued => write!(f, "QUEUED"),
            JobExecutionState::Running => write!(f, "RUNNING"),
            JobExecutionState::Succeeded => write!(f, "SUCCEEDED"),
            JobExecutionState::Failed => write!(f, "FAILED"),
            JobExecutionState::Cancelled => write!(f, "CANCELLED"),
            JobExecutionState::Timeout => write!(f, "TIMEOUT"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Job {
    pub id: JobId,
    pub program_id: ProgramId,
    pub target: String,
    pub category: JobCategory,
    pub state: JobExecutionState,
    pub retry_count: u32,
    pub max_retries: u32,
    pub parent_job_id: Option<JobId>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Job {
    pub fn new(
        program_id: ProgramId,
        target: impl Into<String>,
        category: JobCategory,
    ) -> Result<Self, BountyError> {
        let tgt = target.into();
        if tgt.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Job target cannot be empty".into(),
            ));
        }
        Ok(Self {
            id: JobId::new(),
            program_id,
            target: tgt,
            category,
            state: JobExecutionState::Queued,
            retry_count: 0,
            max_retries: 3,
            parent_job_id: None,
            started_at: None,
            completed_at: None,
            error_message: None,
            created_at: Utc::now(),
        })
    }

    pub fn start(&mut self) -> Result<(), BountyError> {
        match self.state {
            JobExecutionState::Queued => {
                self.state = JobExecutionState::Running;
                self.started_at = Some(Utc::now());
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "RUNNING".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }

    pub fn succeed(&mut self) -> Result<(), BountyError> {
        match self.state {
            JobExecutionState::Running => {
                self.state = JobExecutionState::Succeeded;
                self.completed_at = Some(Utc::now());
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "SUCCEEDED".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }

    pub fn fail(&mut self, reason: impl Into<String>) -> Result<(), BountyError> {
        match self.state {
            JobExecutionState::Running | JobExecutionState::Queued => {
                self.state = JobExecutionState::Failed;
                self.completed_at = Some(Utc::now());
                self.error_message = Some(reason.into());
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "FAILED".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }

    pub fn cancel(&mut self) -> Result<(), BountyError> {
        match self.state {
            JobExecutionState::Queued | JobExecutionState::Running => {
                self.state = JobExecutionState::Cancelled;
                self.completed_at = Some(Utc::now());
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "CANCELLED".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }

    pub fn timeout(&mut self) -> Result<(), BountyError> {
        match self.state {
            JobExecutionState::Running => {
                self.state = JobExecutionState::Timeout;
                self.completed_at = Some(Utc::now());
                self.error_message = Some("Execution exceeded timeout limit".into());
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "TIMEOUT".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }

    pub fn retry(&mut self) -> Result<(), BountyError> {
        if self.retry_count >= self.max_retries {
            return Err(BountyError::PolicyRejected(format!(
                "Max retries ({}) exceeded for job {}",
                self.max_retries, self.id
            )));
        }
        match self.state {
            JobExecutionState::Failed | JobExecutionState::Timeout => {
                self.retry_count += 1;
                self.state = JobExecutionState::Queued;
                self.started_at = None;
                self.completed_at = None;
                self.error_message = None;
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.state.to_string(),
                to: "QUEUED".to_string(),
                entity: "Job".to_string(),
            }),
        }
    }
}

// ============================================================================
// 7. Finding & Strict Lifecycle
// ============================================================================

/// Strict Finding Lifecycle:
/// DISCOVERED → CANDIDATE → EVIDENCE_REQUIRED → VALIDATING → CONFIRMED / REJECTED → REPORT_READY → REVIEWED → EXPORTED
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FindingLifecycleStatus {
    Discovered,
    Candidate,
    EvidenceRequired,
    Validating,
    Confirmed,
    Rejected,
    ReportReady,
    Reviewed,
    Exported,
}

impl fmt::Display for FindingLifecycleStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FindingLifecycleStatus::Discovered => write!(f, "DISCOVERED"),
            FindingLifecycleStatus::Candidate => write!(f, "CANDIDATE"),
            FindingLifecycleStatus::EvidenceRequired => write!(f, "EVIDENCE_REQUIRED"),
            FindingLifecycleStatus::Validating => write!(f, "VALIDATING"),
            FindingLifecycleStatus::Confirmed => write!(f, "CONFIRMED"),
            FindingLifecycleStatus::Rejected => write!(f, "REJECTED"),
            FindingLifecycleStatus::ReportReady => write!(f, "REPORT_READY"),
            FindingLifecycleStatus::Reviewed => write!(f, "REVIEWED"),
            FindingLifecycleStatus::Exported => write!(f, "EXPORTED"),
        }
    }
}

impl FromStr for FindingLifecycleStatus {
    type Err = BountyError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "DISCOVERED" => Ok(FindingLifecycleStatus::Discovered),
            "CANDIDATE" => Ok(FindingLifecycleStatus::Candidate),
            "EVIDENCE_REQUIRED" => Ok(FindingLifecycleStatus::EvidenceRequired),
            "VALIDATING" => Ok(FindingLifecycleStatus::Validating),
            "CONFIRMED" => Ok(FindingLifecycleStatus::Confirmed),
            "REJECTED" => Ok(FindingLifecycleStatus::Rejected),
            "REPORT_READY" => Ok(FindingLifecycleStatus::ReportReady),
            "REVIEWED" => Ok(FindingLifecycleStatus::Reviewed),
            "EXPORTED" => Ok(FindingLifecycleStatus::Exported),
            _ => Err(BountyError::InvalidTarget(format!(
                "Invalid finding lifecycle status: {s}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Finding {
    pub id: FindingId,
    pub program_id: ProgramId,
    pub target_id: Option<TargetId>,
    pub endpoint: Option<String>,
    pub title: String,
    pub vuln_class: String,
    pub severity: Severity,
    pub status: FindingLifecycleStatus,
    pub hypothesis: Option<String>,
    pub confidence: f32,
    pub proposed_validation: Option<String>,
    pub required_evidence: Option<String>,
    pub source_model_run: Option<String>,
    pub evidence_ids: Vec<EvidenceId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Finding {
    pub fn new_discovered(
        program_id: ProgramId,
        title: impl Into<String>,
        vuln_class: impl Into<String>,
        severity: Severity,
    ) -> Result<Self, BountyError> {
        let t = title.into();
        let vc = vuln_class.into();
        if t.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Finding title cannot be empty".into(),
            ));
        }
        let now = Utc::now();
        Ok(Self {
            id: FindingId::new(),
            program_id,
            target_id: None,
            endpoint: None,
            title: t,
            vuln_class: vc,
            severity,
            status: FindingLifecycleStatus::Discovered,
            hypothesis: None,
            confidence: 0.0,
            proposed_validation: None,
            required_evidence: None,
            source_model_run: None,
            evidence_ids: Vec::new(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn to_candidate(
        &mut self,
        hypothesis: impl Into<String>,
        confidence: f32,
        proposed_validation: impl Into<String>,
        required_evidence: impl Into<String>,
        source_model_run: Option<String>,
    ) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Discovered {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "CANDIDATE".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::Candidate;
        self.hypothesis = Some(hypothesis.into());
        self.confidence = confidence.clamp(0.0, 1.0);
        self.proposed_validation = Some(proposed_validation.into());
        self.required_evidence = Some(required_evidence.into());
        self.source_model_run = source_model_run;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn require_evidence(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Candidate
            && self.status != FindingLifecycleStatus::Validating
        {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "EVIDENCE_REQUIRED".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::EvidenceRequired;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn start_validating(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Candidate
            && self.status != FindingLifecycleStatus::EvidenceRequired
        {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "VALIDATING".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::Validating;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn confirm(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Validating {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "CONFIRMED".to_string(),
                entity: "Finding".to_string(),
            });
        }
        if self.evidence_ids.is_empty() {
            return Err(BountyError::InsufficientEvidence(
                "A finding cannot be CONFIRMED without attached evidence".into(),
            ));
        }
        self.status = FindingLifecycleStatus::Confirmed;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn reject(&mut self, _reason: impl Into<String>) -> Result<(), BountyError> {
        match self.status {
            FindingLifecycleStatus::Candidate
            | FindingLifecycleStatus::EvidenceRequired
            | FindingLifecycleStatus::Validating => {
                self.status = FindingLifecycleStatus::Rejected;
                self.updated_at = Utc::now();
                Ok(())
            }
            _ => Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "REJECTED".to_string(),
                entity: "Finding".to_string(),
            }),
        }
    }

    pub fn mark_report_ready(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Confirmed {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "REPORT_READY".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::ReportReady;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn mark_reviewed(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::ReportReady {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "REVIEWED".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::Reviewed;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn mark_exported(&mut self) -> Result<(), BountyError> {
        if self.status != FindingLifecycleStatus::Reviewed {
            return Err(BountyError::InvalidStateTransition {
                from: self.status.to_string(),
                to: "EXPORTED".to_string(),
                entity: "Finding".to_string(),
            });
        }
        self.status = FindingLifecycleStatus::Exported;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn attach_evidence(&mut self, evidence_id: EvidenceId) {
        if !self.evidence_ids.contains(&evidence_id) {
            self.evidence_ids.push(evidence_id);
            self.updated_at = Utc::now();
        }
    }
}

// ============================================================================
// 8. Evidence
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EvidenceType {
    HttpRequest,
    HttpResponse,
    Headers,
    Payload,
    Screenshot,
    DomSnapshot,
    ToolOutput,
    ValidationResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Evidence {
    pub id: EvidenceId,
    pub finding_id: Option<FindingId>,
    pub job_id: Option<JobId>,
    pub evidence_type: EvidenceType,
    pub data_hash: String,
    pub storage_reference: String,
    pub content_type: String,
    pub byte_size: usize,
    pub captured_at: DateTime<Utc>,
}

impl Evidence {
    pub fn compute_sha256(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    pub fn create_from_payload(
        finding_id: Option<FindingId>,
        job_id: Option<JobId>,
        evidence_type: EvidenceType,
        storage_reference: impl Into<String>,
        content_type: impl Into<String>,
        raw_bytes: &[u8],
    ) -> Self {
        let data_hash = Self::compute_sha256(raw_bytes);
        Self {
            id: EvidenceId::new(),
            finding_id,
            job_id,
            evidence_type,
            data_hash,
            storage_reference: storage_reference.into(),
            content_type: content_type.into(),
            byte_size: raw_bytes.len(),
            captured_at: Utc::now(),
        }
    }

    pub fn verify_integrity(&self, data: &[u8]) -> Result<(), BountyError> {
        let actual_hash = Self::compute_sha256(data);
        if self.data_hash == actual_hash {
            Ok(())
        } else {
            Err(BountyError::EvidenceIntegrityMismatch {
                expected: self.data_hash.clone(),
                actual: actual_hash,
            })
        }
    }
}

// ============================================================================
// 9. Report
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportStatus {
    Draft,
    Ready,
    Exported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Report {
    pub id: ReportId,
    pub program_id: ProgramId,
    pub title: String,
    pub finding_ids: Vec<FindingId>,
    pub status: ReportStatus,
    pub summary: String,
    pub generated_at: DateTime<Utc>,
}

impl Report {
    pub fn new(
        program_id: ProgramId,
        title: impl Into<String>,
        finding_ids: Vec<FindingId>,
        summary: impl Into<String>,
    ) -> Result<Self, BountyError> {
        let t = title.into();
        if t.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Report title cannot be empty".into(),
            ));
        }
        Ok(Self {
            id: ReportId::new(),
            program_id,
            title: t,
            finding_ids,
            status: ReportStatus::Draft,
            summary: summary.into(),
            generated_at: Utc::now(),
        })
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_finding_lifecycle_happy_path() {
        let prog_id = ProgramId::new();
        let mut finding = Finding::new_discovered(
            prog_id,
            "Stored XSS in Comment Field",
            "XSS",
            Severity::High,
        )
        .unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Discovered);

        // Discovered -> Candidate
        finding
            .to_candidate(
                "Comment payload reflected without escaping",
                0.9,
                "Inject test script payload and check response DOM",
                "HTTP_RESPONSE",
                Some("run-001".to_string()),
            )
            .unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Candidate);

        // Candidate -> Validating
        finding.start_validating().unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Validating);

        // Trying to confirm without evidence must fail
        let conf_res = finding.confirm();
        assert!(conf_res.is_err());
        assert!(matches!(
            conf_res.unwrap_err(),
            BountyError::InsufficientEvidence(_)
        ));

        // Attach evidence
        let ev = Evidence::create_from_payload(
            Some(finding.id),
            None,
            EvidenceType::HttpResponse,
            "evidence/runs/ev-1.txt",
            "text/plain",
            b"HTTP/1.1 200 OK\r\n<script>alert(1)</script>",
        );
        finding.attach_evidence(ev.id);

        // Confirm
        finding.confirm().unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Confirmed);

        // Confirmed -> ReportReady
        finding.mark_report_ready().unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::ReportReady);

        // ReportReady -> Reviewed
        finding.mark_reviewed().unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Reviewed);

        // Reviewed -> Exported
        finding.mark_exported().unwrap();
        assert_eq!(finding.status, FindingLifecycleStatus::Exported);
    }

    #[test]
    fn test_finding_invalid_state_transitions() {
        let prog_id = ProgramId::new();
        let mut finding =
            Finding::new_discovered(prog_id, "SQL Injection", "SQLI", Severity::Critical).unwrap();

        // Discovered cannot directly become Confirmed
        let res = finding.confirm();
        assert!(res.is_err());

        // Discovered cannot directly become Validating
        let res2 = finding.start_validating();
        assert!(res2.is_err());
    }

    #[test]
    fn test_evidence_integrity() {
        let raw = b"HTTP GET /api/v1/user returned 200 with session leaked";
        let ev = Evidence::create_from_payload(
            None,
            None,
            EvidenceType::HttpResponse,
            "evidence/test.log",
            "text/plain",
            raw,
        );

        // Integrity check with matching data
        assert!(ev.verify_integrity(raw).is_ok());

        // Integrity check with altered data fails
        let tampered = b"HTTP GET /api/v1/user returned 403 Forbidden";
        let err = ev.verify_integrity(tampered);
        assert!(err.is_err());
        assert!(matches!(
            err.unwrap_err(),
            BountyError::EvidenceIntegrityMismatch { .. }
        ));
    }

    #[test]
    fn test_job_state_transitions_and_retry() {
        let prog_id = ProgramId::new();
        let mut job = Job::new(prog_id, "subfinder-stage", JobCategory::Recon).unwrap();
        assert_eq!(job.state, JobExecutionState::Queued);

        // Queued -> Running
        job.start().unwrap();
        assert_eq!(job.state, JobExecutionState::Running);

        // Running -> Timeout
        job.timeout().unwrap();
        assert_eq!(job.state, JobExecutionState::Timeout);

        // Timeout -> Retry (back to Queued)
        job.retry().unwrap();
        assert_eq!(job.state, JobExecutionState::Queued);
        assert_eq!(job.retry_count, 1);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let prog_id = ProgramId::new();
        let target = Target::new(prog_id, "sub.example.com").unwrap();
        let json = serde_json::to_string(&target).unwrap();
        let de: Target = serde_json::from_str(&json).unwrap();
        assert_eq!(target, de);
    }
}
