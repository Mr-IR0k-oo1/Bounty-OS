use crate::errors::BountyError;
use crate::ids::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Execution boundary configuration for the Bounty OS Engine.
/// Guarantees that active operations carry strict scope and policy constraints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineContext {
    pub program_id: ProgramId,
    pub job_id: JobId,
    pub initiated_at: DateTime<Utc>,
    pub actor: String,
}

impl EngineContext {
    pub fn new(program_id: ProgramId, actor: impl Into<String>) -> Self {
        Self {
            program_id,
            job_id: JobId::new(),
            initiated_at: Utc::now(),
            actor: actor.into(),
        }
    }
}

/// Boundary contract for tool command invocation.
/// Arbitrary shell execution is forbidden: commands must be invoked via typed arguments.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SafeCommand {
    pub tool_name: String,
    pub arguments: Vec<String>,
    pub target: String,
    pub timeout_seconds: u64,
}

impl SafeCommand {
    pub fn new(
        tool_name: impl Into<String>,
        target: impl Into<String>,
        arguments: Vec<String>,
        timeout_seconds: u64,
    ) -> Result<Self, BountyError> {
        let tool = tool_name.into();
        let tgt = target.into();

        if tool.trim().is_empty() {
            return Err(BountyError::InvalidTarget(
                "Tool name cannot be empty".into(),
            ));
        }
        if tgt.trim().is_empty() {
            return Err(BountyError::InvalidTarget("Target cannot be empty".into()));
        }

        // Validate that arguments do not contain shell injection operators
        for arg in &arguments {
            if arg.contains(';') || arg.contains('|') || arg.contains('`') || arg.contains('$') {
                return Err(BountyError::PolicyRejected(format!(
                    "Argument contains illegal shell operator: {arg}"
                )));
            }
        }

        Ok(Self {
            tool_name: tool,
            arguments,
            target: tgt,
            timeout_seconds,
        })
    }
}

/// Untrusted Model Gateway observation contract.
/// LLM observations are hypotheses only and never treated as trusted findings.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelHypothesis {
    pub model_id: String,
    pub target: String,
    pub vuln_class: String,
    pub hypothesis: String,
    pub confidence: f32,
    pub proposed_validation_step: String,
    pub required_evidence_type: String,
    pub generated_at: DateTime<Utc>,
}

impl ModelHypothesis {
    pub fn new(
        model_id: impl Into<String>,
        target: impl Into<String>,
        vuln_class: impl Into<String>,
        hypothesis: impl Into<String>,
        confidence: f32,
        proposed_validation_step: impl Into<String>,
        required_evidence_type: impl Into<String>,
    ) -> Self {
        Self {
            model_id: model_id.into(),
            target: target.into(),
            vuln_class: vuln_class.into(),
            hypothesis: hypothesis.into(),
            confidence: confidence.clamp(0.0, 1.0),
            proposed_validation_step: proposed_validation_step.into(),
            required_evidence_type: required_evidence_type.into(),
            generated_at: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_command_rejection_of_shell_injections() {
        let res = SafeCommand::new(
            "subfinder",
            "example.com",
            vec!["; rm -rf /".to_string()],
            30,
        );
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), BountyError::PolicyRejected(_)));
    }

    #[test]
    fn test_model_hypothesis_untrusted_confidence_clamped() {
        let hyp = ModelHypothesis::new(
            "VulnLLM-R-7B",
            "example.com",
            "XSS",
            "Reflected parameter in /search",
            1.5,
            "Send test payload",
            "HTTP_RESPONSE",
        );
        assert_eq!(hyp.confidence, 1.0);
    }
}
