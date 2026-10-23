//! Single-Page Application (SPA) Policy (v0.7)
//!
//! Prioritizes JavaScript parsing, client-side route extraction, API discovery, and historical URL mining.

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::TargetProfile;

pub struct SpaPolicy;

impl InvestigationPolicy for SpaPolicy {
    fn name(&self) -> &'static str {
        "Single-Page Application (SPA) Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::Spa
    }

    fn generate_candidate_actions(
        &self,
        state: &InvestigationState,
        profile: &TargetProfile,
    ) -> Vec<CandidateAction> {
        let mut candidates = Vec::new();
        let base_target = if let Some(first_ep) = state.endpoints.first() {
            first_ep.url.clone()
        } else {
            state.target.clone()
        };

        // 1. JavaScript endpoint extraction (katana deep JS parsing)
        candidates.push(
            CandidateAction::new(
                ActionType::EndpointCrawl,
                "katana",
                &base_target,
                "Deep client-side JavaScript bundle parsing and endpoint extraction",
            )
            .with_metrics(0.85, 0.85, 0.80, 0.25, 0.10)
            .with_context("mode", "js_endpoint_extraction"),
        );

        // 2. Historical URL analysis (gau)
        candidates.push(
            CandidateAction::new(
                ActionType::HistoricalUrls,
                "gau",
                &base_target,
                "Mine historical archives for unlinked client-side API endpoints",
            )
            .with_metrics(0.80, 0.80, 0.75, 0.20, 0.05)
            .with_context("mode", "historical_url_analysis"),
        );

        // 3. API discovery on extracted routes (ffuf)
        let has_api_ep = state.endpoints.iter().any(|e| e.path.contains("/api") || e.path.contains("/v1"));
        if has_api_ep || profile.api_indicators {
            candidates.push(
                CandidateAction::new(
                    ActionType::PathFuzz,
                    "ffuf",
                    &base_target,
                    "Discover unlinked backend API endpoints mapped from client-side bundles",
                )
                .with_metrics(0.75, 0.80, 0.70, 0.20, 0.10)
                .with_context("mode", "api_discovery"),
            );
        }

        // 4. Technology checks for frontend libraries
        if !profile.technologies.is_empty() {
            let tech_str = profile.technologies.join(", ");
            candidates.push(
                CandidateAction::new(
                    ActionType::TechVulnerabilityScan,
                    "nuclei",
                    &base_target,
                    format!("SPA frontend library and framework CVE checks: {}", tech_str),
                )
                .with_metrics(0.70, 0.75, 0.65, 0.30, 0.10),
            );
        }

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "endpoint_crawl" | "crawl" => {
                    if action.tool == "katana" {
                        action.score += 0.45; // JavaScript endpoint extraction
                        action.relevance += 0.35;
                    }
                }
                "historical_urls" => {
                    action.score += 0.40; // Historical URL analysis
                    action.relevance += 0.30;
                }
                "parameter_fuzzing" | "path_fuzz" => {
                    action.score += 0.35; // API discovery
                }
                "xss_fuzzing" | "xss_analysis" => {
                    action.score -= 0.15; // Client-side DOM XSS is possible but prioritized after bundle crawl
                }
                "subdomain_enumeration" => {
                    action.score += 0.10;
                }
                _ => {}
            }

            // Technology-specific action weighting (Section 4)
            if profile.javascript_heavy || profile.has_technology("react") || profile.has_technology("vue") || profile.has_technology("angular") {
                if action.tool == "katana" || action.tool == "gau" {
                    action.score += 0.25;
                }
                if action.tool == "ffuf" {
                    action.score += 0.20;
                }
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as Single-Page Application (SPA)".to_string(),
        ];

        if profile.javascript_heavy {
            reasons.push("client-side JavaScript bundle distribution identified".to_string());
        }
        if action.tool == "katana" {
            reasons.push("JavaScript endpoint extraction prioritized for client-side routing bundles".to_string());
        }
        if action.tool == "gau" || action.tool == "waybackurls" {
            reasons.push("historical archives frequently contain hidden SPA endpoints missing from main bundle".to_string());
        }
        if action.tool == "ffuf" {
            reasons.push("API discovery prioritized to enumerate backend routes extracted from client scripts".to_string());
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());

        reasons
    }
}
