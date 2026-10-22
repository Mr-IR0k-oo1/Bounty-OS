//! Action Value Model & Empirical Estimator (Bounty OS v0.4)
//!
//! Formulates the empirical value of an action:
//! V(a) = [w1(new attack surface) + w2(new findings) + w3(confirmed findings) + w4(coverage improvement)]
//!        ------------------------------------------------------------------------------------------------
//!                                      [time + resource cost + risk]
//!
//! Implements Bayesian shrinkage estimation to adaptively prioritize actions
//! based on historical outcomes observed across previous investigations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::action_outcome::ActionOutcome;

/// Weights for action-value outcome computation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValueWeights {
    pub attack_surface_weight: f64, // w1
    pub findings_weight: f64,       // w2
    pub confirmed_weight: f64,      // w3
    pub coverage_weight: f64,       // w4
}

impl Default for ValueWeights {
    fn default() -> Self {
        Self {
            attack_surface_weight: 1.0,
            findings_weight: 2.5,
            confirmed_weight: 5.0,
            coverage_weight: 1.5,
        }
    }
}

/// Historical performance statistics aggregated for a tool
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct HistoricalToolStats {
    pub tool: String,
    pub sample_count: usize,
    pub total_assets_discovered: i32,
    pub total_services_discovered: i32,
    pub total_endpoints_discovered: i32,
    pub total_parameters_discovered: i32,
    pub total_technologies_discovered: i32,
    pub total_findings: i32,
    pub total_confirmed_findings: i32,
    pub total_false_positives: i32,
    pub avg_actual_value: f64,
    pub avg_actual_ig: f64,
    pub avg_prediction_error: f64,
    pub avg_execution_time_ms: i64,
    pub success_rate: f64,
}

pub struct ActionValueModel;

impl ActionValueModel {
    /// Compute the empirical value V(a) of an executed action from observed deltas
    pub fn calculate_value(
        new_assets: i32,
        new_services: i32,
        new_endpoints: i32,
        new_parameters: i32,
        new_technologies: i32,
        new_findings: i32,
        confirmed_findings: i32,
        coverage_delta: f64,
        execution_time_ms: i64,
        resource_cost: f64,
        risk: f64,
        weights: Option<&ValueWeights>,
    ) -> f64 {
        let w = weights.cloned().unwrap_or_default();

        // 1. Attack surface discoveries: subdomains, hosts, services, endpoints, params, tech
        let attack_surface_points = (new_assets as f64 * 0.5)
            + (new_services as f64 * 1.0)
            + (new_endpoints as f64 * 1.5)
            + (new_parameters as f64 * 0.8)
            + (new_technologies as f64 * 0.7);

        let numerator = (w.attack_surface_weight * attack_surface_points)
            + (w.findings_weight * (new_findings as f64))
            + (w.confirmed_weight * (confirmed_findings as f64))
            + (w.coverage_weight * coverage_delta.clamp(0.0, 1.0));

        // 2. Denominator: normalized execution time + resource cost + risk
        // Normalize time: 5,000ms (5s) = 0.5, 10,000ms = 1.0
        let time_norm = (execution_time_ms as f64 / 10_000.0).clamp(0.05, 5.0);
        let cost_norm = resource_cost.clamp(0.05, 1.0);
        let risk_norm = risk.clamp(0.05, 1.0);

        let denominator = (time_norm + cost_norm + risk_norm).max(0.1);

        let raw_value = numerator / denominator;
        // Normalize to a practical 0.0 .. 2.0 range, round to 3 decimals
        let normalized = raw_value.clamp(0.0, 2.5);
        (normalized * 1000.0).round() / 1000.0
    }

    /// Aggregate historical statistics from recorded action outcomes
    pub fn aggregate_history(outcomes: &[ActionOutcome]) -> HashMap<String, HistoricalToolStats> {
        let mut map: HashMap<String, Vec<&ActionOutcome>> = HashMap::new();
        for o in outcomes {
            map.entry(o.tool.to_lowercase()).or_default().push(o);
        }

        let mut stats_map = HashMap::new();
        for (tool, list) in map {
            let n = list.len();
            if n == 0 {
                continue;
            }

            let mut total_assets = 0;
            let mut total_services = 0;
            let mut total_endpoints = 0;
            let mut total_parameters = 0;
            let mut total_technologies = 0;
            let mut total_findings = 0;
            let mut total_confirmed = 0;
            let mut total_false_positives = 0;
            let mut sum_val = 0.0;
            let mut sum_ig = 0.0;
            let mut sum_err = 0.0;
            let mut sum_time = 0i64;
            let mut successful_runs = 0;

            for o in &list {
                total_assets += o.new_assets;
                total_services += o.new_services;
                total_endpoints += o.new_endpoints;
                total_parameters += o.new_parameters;
                total_technologies += o.new_technologies;
                total_findings += o.new_findings;
                total_confirmed += o.confirmed_findings;
                total_false_positives += o.false_positives;
                sum_val += o.actual_value;
                sum_ig += o.actual_information_gain;
                sum_err += o.prediction_error;
                sum_time += o.execution_time_ms;
                if o.actual_information_gain > 0.0 || o.new_assets > 0 || o.new_findings > 0 {
                    successful_runs += 1;
                }
            }

            stats_map.insert(
                tool.clone(),
                HistoricalToolStats {
                    tool,
                    sample_count: n,
                    total_assets_discovered: total_assets,
                    total_services_discovered: total_services,
                    total_endpoints_discovered: total_endpoints,
                    total_parameters_discovered: total_parameters,
                    total_technologies_discovered: total_technologies,
                    total_findings,
                    total_confirmed_findings: total_confirmed,
                    total_false_positives,
                    avg_actual_value: (sum_val / n as f64 * 1000.0).round() / 1000.0,
                    avg_actual_ig: (sum_ig / n as f64 * 1000.0).round() / 1000.0,
                    avg_prediction_error: (sum_err / n as f64 * 1000.0).round() / 1000.0,
                    avg_execution_time_ms: sum_time / n as i64,
                    success_rate: (successful_runs as f64 / n as f64 * 100.0).round() / 100.0,
                },
            );
        }

        stats_map
    }

    /// Estimate adaptive action score combining prior rule score with empirical historical value:
    /// V_est(a) = (K * Score_prior + N * V_historical) / (K + N)
    ///
    /// Where:
    /// - K = pseudo-count prior strength (default: 2.0)
    /// - N = number of observed executions
    pub fn estimate_adaptive_score(
        prior_score: f64,
        tool: &str,
        history: Option<&HashMap<String, HistoricalToolStats>>,
    ) -> (f64, String) {
        let stats_opt = history.and_then(|h| h.get(&tool.to_lowercase()));

        let stats = match stats_opt {
            Some(s) if s.sample_count > 0 => s,
            _ => return (prior_score, "Rule-based prior (cold start)".to_string()),
        };

        let k = 2.0; // Bayesian pseudo-count prior weight
        let n = stats.sample_count as f64;

        // Map avg_actual_value (typically 0.0 .. 2.0) into normalized score space [0.0 .. 1.0]
        let historical_score_norm = (stats.avg_actual_value / 1.5).clamp(0.05, 1.0);

        let blended = ((k * prior_score) + (n * historical_score_norm)) / (k + n);
        let final_score = (blended.clamp(0.01, 1.0) * 100.0).round() / 100.0;

        let delta = final_score - prior_score;
        let sign = if delta >= 0.0 { "+" } else { "" };

        let reason = format!(
            "Adaptive score (N={}, avg_val={:.2}, historical yield: {} assets, {} findings, Δ={}{:.2})",
            stats.sample_count,
            stats.avg_actual_value,
            stats.total_assets_discovered,
            stats.total_findings,
            sign,
            delta
        );

        (final_score, reason)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_value_zero_discovery() {
        let val = ActionValueModel::calculate_value(0, 0, 0, 0, 0, 0, 0, 0.0, 1000, 0.35, 0.25, None);
        assert_eq!(val, 0.0);
    }

    #[test]
    fn test_calculate_value_high_finding_yield() {
        // High yield: 1 finding + 1 confirmed finding + 2 endpoints
        let val = ActionValueModel::calculate_value(2, 0, 2, 1, 0, 1, 1, 0.5, 2000, 0.35, 0.25, None);
        assert!(val > 1.0, "Expected high value, got {}", val);
    }

    #[test]
    fn test_adaptive_score_discount_for_unproductive_tool() {
        // Tool with 5 runs and 0 actual value
        let mut history = HashMap::new();
        history.insert(
            "gau".to_string(),
            HistoricalToolStats {
                tool: "gau".to_string(),
                sample_count: 5,
                avg_actual_value: 0.0,
                avg_actual_ig: 0.0,
                avg_prediction_error: 0.73,
                ..Default::default()
            },
        );

        let prior = 0.55;
        let (adaptive, reason) = ActionValueModel::estimate_adaptive_score(prior, "gau", Some(&history));
        assert!(adaptive < prior, "Expected adaptive score < prior, got {} vs {}", adaptive, prior);
        assert!(reason.contains("N=5"));
    }

    #[test]
    fn test_adaptive_score_boost_for_high_performing_tool() {
        let mut history = HashMap::new();
        history.insert(
            "naabu".to_string(),
            HistoricalToolStats {
                tool: "naabu".to_string(),
                sample_count: 4,
                total_assets_discovered: 5,
                avg_actual_value: 1.6,
                avg_actual_ig: 0.8,
                avg_prediction_error: 0.1,
                ..Default::default()
            },
        );

        let prior = 0.70;
        let (adaptive, reason) = ActionValueModel::estimate_adaptive_score(prior, "naabu", Some(&history));
        assert!(adaptive >= prior, "Expected adaptive score >= prior, got {} vs {}", adaptive, prior);
        assert!(reason.contains("historical yield: 5 assets"));
    }
}
