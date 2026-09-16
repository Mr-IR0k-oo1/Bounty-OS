use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl fmt::Display for Severity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Severity::Critical => write!(f, "critical"),
            Severity::High => write!(f, "high"),
            Severity::Medium => write!(f, "medium"),
            Severity::Low => write!(f, "low"),
            Severity::Info => write!(f, "info"),
        }
    }
}

impl FromStr for Severity {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "critical" => Ok(Severity::Critical),
            "high" => Ok(Severity::High),
            "medium" => Ok(Severity::Medium),
            "low" => Ok(Severity::Low),
            "info" => Ok(Severity::Info),
            _ => Err(format!("Invalid severity: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Platform {
    H1,
    Bugcrowd,
    Intigriti,
    Synack,
    Other,
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Platform::H1 => write!(f, "h1"),
            Platform::Bugcrowd => write!(f, "bugcrowd"),
            Platform::Intigriti => write!(f, "intigriti"),
            Platform::Synack => write!(f, "synack"),
            Platform::Other => write!(f, "other"),
        }
    }
}

impl FromStr for Platform {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "h1" => Ok(Platform::H1),
            "bugcrowd" => Ok(Platform::Bugcrowd),
            "intigriti" => Ok(Platform::Intigriti),
            "synack" => Ok(Platform::Synack),
            "other" => Ok(Platform::Other),
            _ => Err(format!("Invalid platform: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Queued,
    Running,
    Done,
    Failed,
    Cancelled,
}

impl fmt::Display for JobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JobStatus::Queued => write!(f, "queued"),
            JobStatus::Running => write!(f, "running"),
            JobStatus::Done => write!(f, "done"),
            JobStatus::Failed => write!(f, "failed"),
            JobStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl FromStr for JobStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "queued" => Ok(JobStatus::Queued),
            "running" => Ok(JobStatus::Running),
            "done" => Ok(JobStatus::Done),
            "failed" => Ok(JobStatus::Failed),
            "cancelled" | "canceled" => Ok(JobStatus::Cancelled),
            _ => Err(format!("Invalid job status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FindingStatus {
    New,
    Triaged,
    Validated,
    Submitted,
    Fp,
    Dup,
    Na,
    BountyAwarded,
}

impl fmt::Display for FindingStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FindingStatus::New => write!(f, "new"),
            FindingStatus::Triaged => write!(f, "triaged"),
            FindingStatus::Validated => write!(f, "validated"),
            FindingStatus::Submitted => write!(f, "submitted"),
            FindingStatus::Fp => write!(f, "fp"),
            FindingStatus::Dup => write!(f, "dup"),
            FindingStatus::Na => write!(f, "na"),
            FindingStatus::BountyAwarded => write!(f, "bounty_awarded"),
        }
    }
}

impl FromStr for FindingStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "new" => Ok(FindingStatus::New),
            "triaged" => Ok(FindingStatus::Triaged),
            "validated" => Ok(FindingStatus::Validated),
            "submitted" => Ok(FindingStatus::Submitted),
            "fp" | "false_positive" => Ok(FindingStatus::Fp),
            "dup" | "duplicate" => Ok(FindingStatus::Dup),
            "na" | "not_applicable" => Ok(FindingStatus::Na),
            "bounty_awarded" | "bountyawarded" => Ok(FindingStatus::BountyAwarded),
            _ => Err(format!("Invalid finding status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProjectStatus {
    Active,
    Archived,
}

impl fmt::Display for ProjectStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProjectStatus::Active => write!(f, "active"),
            ProjectStatus::Archived => write!(f, "archived"),
        }
    }
}

impl FromStr for ProjectStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(ProjectStatus::Active),
            "archived" => Ok(ProjectStatus::Archived),
            _ => Err(format!("Invalid project status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScopeType {
    Domain,
    Ip,
    Cidr,
    Wildcard,
    Apk,
    Url,
}

impl fmt::Display for ScopeType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ScopeType::Domain => write!(f, "domain"),
            ScopeType::Ip => write!(f, "ip"),
            ScopeType::Cidr => write!(f, "cidr"),
            ScopeType::Wildcard => write!(f, "wildcard"),
            ScopeType::Apk => write!(f, "apk"),
            ScopeType::Url => write!(f, "url"),
        }
    }
}

impl FromStr for ScopeType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "domain" => Ok(ScopeType::Domain),
            "ip" => Ok(ScopeType::Ip),
            "cidr" => Ok(ScopeType::Cidr),
            "wildcard" => Ok(ScopeType::Wildcard),
            "apk" => Ok(ScopeType::Apk),
            "url" => Ok(ScopeType::Url),
            _ => Err(format!("Invalid scope type: {s}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScanStage {
    Passive,
    Validate,
    Active,
    Vuln,
}

impl fmt::Display for ScanStage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ScanStage::Passive => write!(f, "passive"),
            ScanStage::Validate => write!(f, "validate"),
            ScanStage::Active => write!(f, "active"),
            ScanStage::Vuln => write!(f, "vuln"),
        }
    }
}

impl FromStr for ScanStage {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "passive" | "1" => Ok(ScanStage::Passive),
            "validate" | "2" => Ok(ScanStage::Validate),
            "active" | "3" => Ok(ScanStage::Active),
            "vuln" | "4" => Ok(ScanStage::Vuln),
            _ => Err(format!("Invalid scan stage: {s}")),
        }
    }
}

impl ScanStage {
    pub fn to_i32(&self) -> i32 {
        match self {
            ScanStage::Passive => 1,
            ScanStage::Validate => 2,
            ScanStage::Active => 3,
            ScanStage::Vuln => 4,
        }
    }

    pub fn from_i32(val: i32) -> Result<Self, String> {
        match val {
            1 => Ok(ScanStage::Passive),
            2 => Ok(ScanStage::Validate),
            3 => Ok(ScanStage::Active),
            4 => Ok(ScanStage::Vuln),
            _ => Err(format!("Invalid scan stage: {val}")),
        }
    }
}

impl TryFrom<i32> for ScanStage {
    type Error = String;
    fn try_from(val: i32) -> Result<Self, Self::Error> {
        Self::from_i32(val)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum DetectionSource {
    #[default]
    Llm,
    Rule,
    Correlated,
}

impl fmt::Display for DetectionSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DetectionSource::Llm => write!(f, "llm"),
            DetectionSource::Rule => write!(f, "rule"),
            DetectionSource::Correlated => write!(f, "correlated"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ValidationStatus {
    Confirmed,
    #[default]
    Candidate,
    Rejected,
}

impl fmt::Display for ValidationStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ValidationStatus::Confirmed => write!(f, "confirmed"),
            ValidationStatus::Candidate => write!(f, "candidate"),
            ValidationStatus::Rejected => write!(f, "rejected"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecurityFinding {
    pub vulnerability: Option<String>,
    pub cwe: Option<String>,
    pub severity: Option<Severity>,
    pub confidence: f32,
    pub evidence: String,
    pub impact: Option<String>,
    pub remediation: Option<String>,
    #[serde(default)]
    pub detection_source: DetectionSource,
    #[serde(default)]
    pub validation_status: ValidationStatus,
}
