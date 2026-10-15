use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BountyError {
    ScopeViolation(String),
    InvalidTarget(String),
    PolicyRejected(String),
    InvalidStateTransition {
        from: String,
        to: String,
        entity: String,
    },
    ToolExecutionFailed(String),
    EvidenceIntegrityMismatch {
        expected: String,
        actual: String,
    },
    UntrustedModelError(String),
    ValidationFailed(String),
    InsufficientEvidence(String),
    StorageError(String),
    NotFound(String),
    SerializationError(String),
}

impl fmt::Display for BountyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BountyError::ScopeViolation(msg) => write!(f, "Scope violation: {msg}"),
            BountyError::InvalidTarget(msg) => write!(f, "Invalid target: {msg}"),
            BountyError::PolicyRejected(msg) => write!(f, "Policy rejected operation: {msg}"),
            BountyError::InvalidStateTransition { from, to, entity } => {
                write!(
                    f,
                    "Invalid {entity} state transition: from '{from}' to '{to}'"
                )
            }
            BountyError::ToolExecutionFailed(msg) => write!(f, "Tool execution failed: {msg}"),
            BountyError::EvidenceIntegrityMismatch { expected, actual } => write!(
                f,
                "Evidence integrity mismatch: expected {expected}, actual {actual}"
            ),
            BountyError::UntrustedModelError(msg) => write!(f, "Untrusted model error: {msg}"),
            BountyError::ValidationFailed(msg) => write!(f, "Validation failed: {msg}"),
            BountyError::InsufficientEvidence(msg) => {
                write!(f, "Insufficient evidence for validation: {msg}")
            }
            BountyError::StorageError(msg) => write!(f, "Storage error: {msg}"),
            BountyError::NotFound(msg) => write!(f, "Entity not found: {msg}"),
            BountyError::SerializationError(msg) => write!(f, "Serialization error: {msg}"),
        }
    }
}

impl std::error::Error for BountyError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = BountyError::InvalidStateTransition {
            from: "DISCOVERED".to_string(),
            to: "CONFIRMED".to_string(),
            entity: "Finding".to_string(),
        };
        assert_eq!(
            err.to_string(),
            "Invalid Finding state transition: from 'DISCOVERED' to 'CONFIRMED'"
        );
    }
}
