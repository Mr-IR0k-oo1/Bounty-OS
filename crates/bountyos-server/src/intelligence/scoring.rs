//! Deterministic Action Scoring
//!
//! Implements the deterministic scoring formula:
//! Score(A) = (IG(A) * R(A) * C(A)) / (Cost(A) + Risk(A))
//!
//! Where:
//! - IG: Expected Information Gain [0.0 .. 1.0]
//! - R: Relevance to discovered attack surface [0.0 .. 1.0]
//! - C: Prerequisite Confidence [0.0 .. 1.0]
//! - Cost: Execution runtime / resource cost [0.05 .. 1.0]
//! - Risk: Operational or security risk [0.05 .. 1.0]

use crate::intelligence::actions::ActionType;

pub struct ActionScorer;

impl ActionScorer {
    /// Compute normalized deterministic score in range [0.0, 1.0]
    pub fn compute(ig: f64, r: f64, c: f64, cost: f64, risk: f64) -> f64 {
        let ig_clamped = ig.clamp(0.0, 1.0);
        let r_clamped = r.clamp(0.0, 1.0);
        let c_clamped = c.clamp(0.0, 1.0);
        let numerator = ig_clamped * r_clamped * c_clamped;

        let denominator = (cost + risk).clamp(0.05, 2.0);
        let raw = (numerator / denominator) * 0.61;
        (raw.clamp(0.0, 1.0) * 100.0).round() / 100.0
    }

    /// Default baseline metrics for rule-based action types
    pub fn default_metrics(action_type: ActionType) -> (f64, f64, f64, f64, f64) {
        // Returns (IG, R, C, Cost, Risk)
        // Priorities follow the validated pipeline:
        // Verification > XSS (Dalfox) > Nuclei > Subfinder > Dnsx > Naabu > Httpx > Katana > Gau > Ffuf
        match action_type {
            ActionType::FindingVerification => (0.98, 1.00, 0.98, 0.10, 0.05),
            ActionType::XssAnalysis => (0.95, 0.95, 0.95, 0.35, 0.25),
            ActionType::TechVulnerabilityScan => (0.92, 0.90, 0.90, 0.35, 0.25),
            ActionType::SubdomainEnumeration => (0.90, 0.90, 0.90, 0.35, 0.25),
            ActionType::DnsResolution => (0.88, 0.90, 0.90, 0.35, 0.25),
            ActionType::PortScan => (0.85, 0.90, 0.90, 0.35, 0.25),
            ActionType::HttpProbe => (0.82, 0.90, 0.90, 0.35, 0.25),
            ActionType::EndpointCrawl => (0.79, 0.90, 0.90, 0.35, 0.25),
            ActionType::HistoricalUrls => (0.73, 0.90, 0.90, 0.40, 0.25),
            ActionType::PathFuzz => (0.65, 0.85, 0.85, 0.40, 0.30),
            ActionType::Stop => (0.00, 0.00, 0.00, 0.05, 0.05),
        }
    }

    /// Score an action type using default baseline metrics
    pub fn score_action_type(action_type: ActionType) -> f64 {
        let (ig, r, c, cost, risk) = Self::default_metrics(action_type);
        Self::compute(ig, r, c, cost, risk)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xss_analysis_score() {
        let score = ActionScorer::score_action_type(ActionType::XssAnalysis);
        // Expect high priority score for reflected parameter
        assert!(score >= 0.80 && score <= 0.95, "Score was {}", score);
    }

    #[test]
    fn test_finding_verification_score_highest() {
        let verif_score = ActionScorer::score_action_type(ActionType::FindingVerification);
        let xss_score = ActionScorer::score_action_type(ActionType::XssAnalysis);
        let crawl_score = ActionScorer::score_action_type(ActionType::EndpointCrawl);

        assert!(verif_score > xss_score);
        assert!(xss_score > crawl_score);
    }
}
