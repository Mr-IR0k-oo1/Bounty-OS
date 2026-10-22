//! Explicit Stop Conditions
//!
//! Evaluates whether the investigation should cease:
//! - No legal actions remaining
//! - Execution budget exhausted
//! - Coverage sufficient
//! - Best action score below threshold
//! - Investigation cancelled

use crate::intelligence::coverage::CoverageModel;
use crate::intelligence::state::{InvestigationState, InvestigationStatus, StopReason};

pub struct StoppingChecker;

impl StoppingChecker {
    /// Default minimum action score threshold required to justify further scanning
    pub const DEFAULT_SCORE_THRESHOLD: f64 = 0.30;

    /// Evaluate whether the investigation should stop
    pub fn evaluate(
        state: &InvestigationState,
        best_action_score: Option<f64>,
        threshold: Option<f64>,
    ) -> Option<StopReason> {
        let thresh = threshold.unwrap_or(Self::DEFAULT_SCORE_THRESHOLD);

        // 1. Investigation explicitly cancelled or stopped
        if state.status == InvestigationStatus::Cancelled {
            return Some(StopReason::InvestigationCancelled(
                "Investigation was cancelled by user or policy".to_string(),
            ));
        }

        // 2. Budget exhausted
        if state.is_budget_exhausted() {
            return Some(StopReason::BudgetExhausted(format!(
                "Action limit of {} actions reached",
                state.budget.max_actions
            )));
        }

        // 3. No candidate actions available
        match best_action_score {
            None => Some(StopReason::NoLegalActions),
            Some(score) => {
                // 4. Action score is below viable threshold
                if score < thresh {
                    Some(StopReason::BestActionScoreTooLow {
                        score,
                        threshold: thresh,
                    })
                } else {
                    // 5. Coverage sufficiency check
                    let report = CoverageModel::assess(state);
                    if report.gaps.is_empty()
                        && state.unverified_high_confidence_findings().is_empty()
                        && state.endpoints_with_reflected_params().is_empty()
                    {
                        Some(StopReason::CoverageSufficient)
                    } else {
                        None
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{InvestigationProfile, ScopeBoundary};

    #[test]
    fn test_stop_on_cancelled() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.status = InvestigationStatus::Cancelled;

        let stop = StoppingChecker::evaluate(&state, Some(0.85), None);
        assert!(matches!(stop, Some(StopReason::InvestigationCancelled(_))));
    }

    #[test]
    fn test_stop_on_score_too_low() {
        let scope = ScopeBoundary::new();
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let stop = StoppingChecker::evaluate(&state, Some(0.15), Some(0.30));
        assert!(matches!(stop, Some(StopReason::BestActionScoreTooLow { .. })));
    }

    #[test]
    fn test_stop_on_no_actions() {
        let scope = ScopeBoundary::new();
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let stop = StoppingChecker::evaluate(&state, None, None);
        assert_eq!(stop, Some(StopReason::NoLegalActions));
    }
}
