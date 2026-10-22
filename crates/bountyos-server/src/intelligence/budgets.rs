//! Investigation Budgets and Constraints
//!
//! Enforces execution limits to avoid infinite scans or runaway consumption:
//! - Max total actions
//! - Max actions per specific tool
//! - Max wall-clock duration
//! - Operational risk ceiling

use crate::intelligence::state::InvestigationState;
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BudgetExceededReason {
    MaxTotalActionsReached(usize),
    MaxToolActionsReached(String, usize),
    MaxDurationSecondsReached(u64),
    RiskCeilingExceeded(f64),
}

pub struct BudgetManager;

impl BudgetManager {
    /// Maximum allowed executions per tool within a single investigation
    pub fn tool_limit(tool: &str) -> usize {
        match tool.to_lowercase().as_str() {
            "subfinder" => 2,
            "dnsx" => 3,
            "naabu" => 3,
            "httpx" => 5,
            "katana" => 5,
            "gau" | "waybackurls" => 3,
            "ffuf" => 4,
            "nuclei" => 5,
            "dalfox" => 8,
            "verification" => 15,
            _ => 3,
        }
    }

    /// Check if executing the given tool against current state violates budget constraints
    pub fn check(state: &InvestigationState, tool: &str, risk: f64) -> Result<(), BudgetExceededReason> {
        // 1. Total actions
        if state.budget.current_actions >= state.budget.max_actions {
            return Err(BudgetExceededReason::MaxTotalActionsReached(state.budget.max_actions));
        }

        // 2. Per-tool limit
        let limit = Self::tool_limit(tool);
        let used = state.budget.action_counts_by_tool.get(tool).copied().unwrap_or(0);
        if used >= limit {
            return Err(BudgetExceededReason::MaxToolActionsReached(tool.to_string(), limit));
        }

        // 3. Duration check
        if let Some(start) = state.budget.started_at {
            let elapsed = (Utc::now() - start).num_seconds().max(0) as u64;
            if elapsed > state.budget.max_duration_seconds {
                return Err(BudgetExceededReason::MaxDurationSecondsReached(state.budget.max_duration_seconds));
            }
        }

        // 4. Risk ceiling
        if risk > state.budget.max_risk_level {
            return Err(BudgetExceededReason::RiskCeilingExceeded(risk));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{InvestigationProfile, ScopeBoundary};

    #[test]
    fn test_budget_enforcement() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        // Tool limit check
        assert!(BudgetManager::check(&state, "subfinder", 0.1).is_ok());

        // Simulate reaching subfinder limit
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);

        let err = BudgetManager::check(&state, "subfinder", 0.1).unwrap_err();
        assert!(matches!(err, BudgetExceededReason::MaxToolActionsReached(..)));
    }
}
