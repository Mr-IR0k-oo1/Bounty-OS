//! REST API Investigation Policy (v0.7)
//!
//! Prioritizes structured endpoint routing, parameter fuzzing, auth boundaries,
//! and method tampering while deprioritizing HTML-form and DOM-specific scanners.

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::scoring::ActionScorer;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::{AuthenticationState, TargetProfile};

pub struct RestApiPolicy;

impl InvestigationPolicy for RestApiPolicy {
    fn name(&self) -> &'static str {
        "REST API Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::RestApi
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

        // 1. Discover API routes (ffuf targeting API routes / OpenAPI / Swagger specs)
        let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::PathFuzz);
        candidates.push(
            CandidateAction::new(
                ActionType::PathFuzz,
                "ffuf",
                &base_target,
                "Discover REST API routes and OpenAPI/Swagger schema documentation",
            )
            .with_metrics(ig + 0.15, r + 0.20, c, cost, risk)
            .with_context("mode", "api_route_discovery")
            .with_context("archetype", "rest_api"),
        );

        // 2. Enumerate parameters on identified endpoints
        for ep in state.endpoints.iter().filter(|e| !e.fuzzed) {
            candidates.push(
                CandidateAction::new(
                    ActionType::PathFuzz,
                    "ffuf",
                    &ep.url,
                    format!("Enumerate REST API parameters on endpoint '{}'", ep.path),
                )
                .with_metrics(0.70, 0.75, 0.65, 0.20, 0.10)
                .with_context("mode", "param_fuzz")
                .with_context("path", &ep.path),
            );
        }

        // 3. Identify authentication boundaries
        for ep in &state.endpoints {
            let path_lower = ep.path.to_lowercase();
            if path_lower.contains("auth") || path_lower.contains("login") || path_lower.contains("token") || path_lower.contains("oauth") {
                candidates.push(
                    CandidateAction::new(
                        ActionType::TechVulnerabilityScan,
                        "nuclei",
                        &ep.url,
                        format!("Identify authentication boundary and token handling mechanisms on '{}'", ep.path),
                    )
                    .with_metrics(0.80, 0.85, 0.70, 0.30, 0.15)
                    .with_context("focus", "auth_boundary")
                    .with_context("path", &ep.path),
                );
            }
        }

        // 4. Inspect HTTP methods (OPTIONS, PUT, DELETE, PATCH tampering)
        for ep in &state.endpoints {
            if ep.method.is_empty() || ep.method == "GET" {
                candidates.push(
                    CandidateAction::new(
                        ActionType::HttpProbe,
                        "httpx",
                        &ep.url,
                        format!("Inspect HTTP methods (OPTIONS/PUT/DELETE) on REST endpoint '{}'", ep.path),
                    )
                    .with_metrics(0.65, 0.70, 0.60, 0.15, 0.05)
                    .with_context("check", "http_methods")
                    .with_context("path", &ep.path),
                );
            }
        }

        // 5. Run technology-relevant checks
        if !profile.technologies.is_empty() {
            let tech_str = profile.technologies.join(", ");
            candidates.push(
                CandidateAction::new(
                    ActionType::TechVulnerabilityScan,
                    "nuclei",
                    &base_target,
                    format!("Targeted API vulnerability checks matching running stack: {}", tech_str),
                )
                .with_metrics(0.75, 0.80, 0.70, 0.35, 0.15)
                .with_context("technologies", tech_str),
            );
        }

        // 6. Prioritize authorization testing (BOLA / IDOR checks)
        for ep in &state.endpoints {
            let path_lower = ep.path.to_lowercase();
            if path_lower.contains("/users") || path_lower.contains("/orders") || path_lower.contains("/account") || path_lower.contains("/items") {
                candidates.push(
                    CandidateAction::new(
                        ActionType::TechVulnerabilityScan,
                        "nuclei",
                        &ep.url,
                        format!("Prioritize authorization boundary testing (BOLA/IDOR) on '{}'", ep.path),
                    )
                    .with_metrics(0.85, 0.85, 0.75, 0.30, 0.20)
                    .with_context("focus", "authorization_bola")
                    .with_context("path", &ep.path),
                );
            }
        }

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "route_fuzzing" | "api_discovery" | "parameter_fuzzing" | "path_fuzz" => {
                    action.score += 0.45;
                    action.relevance += 0.35;
                }
                "endpoint_crawl" | "crawl" => {
                    if action.tool == "katana" {
                        action.score += 0.15;
                    } else {
                        action.score -= 0.20;
                    }
                }
                "xss_fuzzing" | "xss_analysis" => {
                    action.score -= 0.35;
                    action.relevance -= 0.20;
                }
                "tech_vulnerability_scan" => {
                    action.score += 0.30;
                }
                "subdomain_enumeration" => {
                    if profile.api_indicators {
                        action.score -= 0.10;
                    }
                }
                _ => {}
            }

            // Authentication-specific adjustments
            if profile.authentication_state != AuthenticationState::None
                && profile.authentication_state != AuthenticationState::Unknown
            {
                if action.action_type.as_str().contains("auth") || action.tool == "nuclei" {
                    action.score += 0.25;
                }
            }

            // Technology-specific action weighting (Section 4)
            if profile.has_technology("node") || profile.has_technology("express") {
                if action.tool == "nuclei" || action.tool == "ffuf" {
                    action.score += 0.25;
                }
            }
            if profile.has_technology("fastapi") || profile.has_technology("python") {
                if action.tool == "ffuf" {
                    action.score += 0.25;
                }
            }
            if profile.has_technology("spring") {
                if action.tool == "nuclei" {
                    action.score += 0.30;
                }
            }

            // Tool-specific policy tuning
            if action.tool == "ffuf" {
                action.score += 0.35;
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as REST API".to_string(),
        ];

        if profile.api_indicators {
            reasons.push("API endpoints detected".to_string());
        }
        if action.action_type.as_str().contains("fuzz") || action.tool == "ffuf" {
            reasons.push("REST APIs expose structured endpoints; prioritized route and parameter discovery".to_string());
        }
        if action.action_type.as_str().contains("xss") {
            reasons.push("JSON API payloads rarely execute client-side DOM reflection; deprioritized XSS fuzzing".to_string());
        }
        if profile.authentication_state != AuthenticationState::None && profile.authentication_state != AuthenticationState::Unknown {
            reasons.push(format!("Active authentication boundary ({:?}) detected; prioritized authorization testing", profile.authentication_state));
        }
        if !profile.technologies.is_empty() {
            reasons.push(format!("technology stack identified: {}", profile.technologies.join(", ")));
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());

        reasons
    }
}
