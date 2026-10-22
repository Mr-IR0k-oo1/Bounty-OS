//! Strategic Prioritization (v0.5)
//!
//! Ranks investigation directions and combines VulnLLM strategic hypothesis priorities
//! with empirical action-value history, coverage gaps, cost, and risk.
//!
//! CRITICAL PRINCIPLE:
//! The LLM is an advisory signal, not the execution controller.
//! LLM priority boosts are bounded and must pass deterministic policy gates.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::hypothesis::SecurityHypothesis;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedHypothesisInput {
    pub category: String,
    pub priority: f64,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategicPrioritization {
    pub ranked_hypotheses: Vec<SecurityHypothesis>,
    pub action_boosts: HashMap<String, f64>,
    pub strategic_summary: String,
}

pub struct StrategicPrioritizer;

impl StrategicPrioritizer {
    /// Generate bounded priority boosts from ranked hypothesis inputs
    pub fn prioritize_ranked_items(items: &[RankedHypothesisInput]) -> StrategicPrioritization {
        let mut action_boosts = HashMap::new();

        for item in items {
            let boost = (item.priority * 0.15).clamp(0.0, 0.15);
            let key = format!("{}:{}", item.category.to_lowercase(), item.target.to_lowercase());
            action_boosts.insert(key, boost);

            // Infer tool name from category
            let tool = match item.category.to_lowercase().as_str() {
                "xss" | "reflected_input" => "dalfox",
                "exposed_admin" | "path" | "fuzz" => "ffuf",
                "tech" | "cve" | "vulnerability" => "nuclei",
                "crawl" | "endpoint" => "katana",
                "port" | "service" => "naabu",
                "probe" | "http" => "httpx",
                _ => "",
            };
            if !tool.is_empty() {
                let tool_key = format!("{}:{}", tool, item.target.to_lowercase());
                action_boosts.insert(tool_key, boost);
            }
        }

        let summary = format!(
            "Strategic LLM Layer prioritized {} hypotheses. Highest priority: {:.2}",
            items.len(),
            items.first().map(|i| i.priority).unwrap_or(0.0)
        );

        StrategicPrioritization {
            ranked_hypotheses: Vec::new(),
            action_boosts,
            strategic_summary: summary,
        }
    }
    /// Generate bounded priority boosts for candidate actions based on active hypotheses
    pub fn prioritize(hypotheses: &[SecurityHypothesis]) -> StrategicPrioritization {
        let mut action_boosts = HashMap::new();
        let mut ranked = hypotheses.to_vec();

        // Sort hypotheses by confidence descending
        ranked.sort_by(|a, b| {
            b.confidence
                .partial_cmp(&a.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Compute bounded action boosts: Max boost +0.15 to ensure empirical evidence & policies dominate
        for h in &ranked {
            let boost = (h.confidence * 0.15).clamp(0.0, 0.15);
            for act in &h.suggested_actions {
                let key = format!("{}:{}", act.to_lowercase(), h.target.to_lowercase());
                let existing = action_boosts.entry(key).or_insert(0.0);
                if boost > *existing {
                    *existing = boost;
                }

                // Also boost by tool name for broader planner matching
                let tool_key = match act.as_str() {
                    "subdomain_enumeration" => "subfinder",
                    "port_scan" => "naabu",
                    "http_probe" => "httpx",
                    "endpoint_crawl" => "katana",
                    "historical_urls" => "gau",
                    "tech_vulnerability_scan" => "nuclei",
                    "xss_analysis" => "dalfox",
                    "finding_verification" => "verification",
                    _ => "",
                };

                if !tool_key.is_empty() {
                    let t_key = format!("{}:{}", tool_key, h.target.to_lowercase());
                    let tool_existing = action_boosts.entry(t_key).or_insert(0.0);
                    if boost > *tool_existing {
                        *tool_existing = boost;
                    }
                }
            }
        }

        let summary = format!(
            "Strategic LLM Layer analyzed {} active hypotheses. Top priority: '{}' (Confidence: {:.2})",
            ranked.len(),
            ranked.first().map(|h| h.category.as_str()).unwrap_or("None"),
            ranked.first().map(|h| h.confidence).unwrap_or(0.0)
        );

        StrategicPrioritization {
            ranked_hypotheses: ranked,
            action_boosts,
            strategic_summary: summary,
        }
    }

    /// Combines baseline score, empirical action-value history, and bounded LLM priority
    pub fn compute_composite_score(
        base_score: f64,
        empirical_score: f64,
        llm_boost: f64,
    ) -> (f64, String) {
        let clamped_boost = llm_boost.clamp(0.0, 0.20);
        let composite = (empirical_score + clamped_boost).clamp(0.0, 1.0);
        let rounded = (composite * 100.0).round() / 100.0;

        let note = if clamped_boost > 0.001 {
            format!(
                "Composite: {:.2} (Prior: {:.2}, Empirical: {:.2}, LLM Boost: +{:.2})",
                rounded, base_score, empirical_score, clamped_boost
            )
        } else {
            format!("Empirical: {:.2}", empirical_score)
        };

        (rounded, note)
    }
}
