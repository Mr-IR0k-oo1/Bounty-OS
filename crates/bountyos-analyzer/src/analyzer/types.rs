pub use bountyos_common::{DetectionSource, SecurityFinding, Severity, ValidationStatus};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub finding: SecurityFinding,
    pub source: DetectionSource,
    pub status: ValidationStatus,
}
