//! Web Application Policies (Web Legacy, Web Modern, and Generic Fallback)

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::scoring::ActionScorer;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::TargetProfile;

/// Policy for traditional/legacy multi-page web applications (HTML forms, server-side scripts)
pub struct WebLegacyPolicy;

impl InvestigationPolicy for WebLegacyPolicy {
    fn name(&self) -> &'static str {
        "Web Legacy Application Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::WebLegacy
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

        // 1. Full HTML form and link crawling (katana)
        let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::EndpointCrawl);
        candidates.push(
            CandidateAction::new(
                ActionType::EndpointCrawl,
                "katana",
                &base_target,
                "Full HTML form and anchor crawling for server-rendered pages",
            )
            .with_metrics(ig + 0.10, r + 0.20, c, cost, risk)
            .with_context("mode", "html_form_crawl"),
        );

        // 2. Known endpoint discovery (WordPress / PHP administrative endpoints)
        if profile.has_technology("wordpress") {
            candidates.push(
                CandidateAction::new(
                    ActionType::PathFuzz,
                    "ffuf",
                    &base_target,
                    "Discover WordPress core endpoints (/wp-admin, /wp-login.php, /wp-json)",
                )
                .with_metrics(0.75, 0.85, 0.80, 0.20, 0.10)
                .with_context("cms", "wordpress")
                .with_context("mode", "known_endpoint_discovery"),
            );
        }

        // 3. Technology-specific vulnerability checks (nuclei)
        if !profile.technologies.is_empty() {
            let tech_str = profile.technologies.join(", ");
            candidates.push(
                CandidateAction::new(
                    ActionType::TechVulnerabilityScan,
                    "nuclei",
                    &base_target,
                    format!("CMS and server vulnerability checks matching stack: {}", tech_str),
                )
                .with_metrics(0.80, 0.85, 0.75, 0.35, 0.15)
                .with_context("technologies", tech_str),
            );
        }

        // 4. Parameter reflection and injection fuzzing (dalfox / ffuf)
        for ep in &state.endpoints {
            if ep.params.iter().any(|p| p.reflected) {
                candidates.push(
                    CandidateAction::new(
                        ActionType::XssAnalysis,
                        "dalfox",
                        &ep.url,
                        format!("Parameter reflection injection testing on '{}'", ep.path),
                    )
                    .with_metrics(0.80, 0.80, 0.75, 0.25, 0.10)
                    .with_context("path", &ep.path),
                );
            }
        }

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "endpoint_crawl" | "crawl" => {
                    action.score += 0.35;
                    action.relevance += 0.25;
                }
                "xss_fuzzing" | "xss_analysis" | "parameter_fuzzing" => {
                    action.score += 0.40;
                    action.relevance += 0.30;
                }
                "tech_vulnerability_scan" => {
                    action.score += 0.25;
                }
                "subdomain_enumeration" => {
                    if profile.historical_url_density > 0.5 {
                        action.score -= 0.15;
                    }
                }
                _ => {}
            }

            // Technology-specific action weighting (Section 4)
            if profile.has_technology("php") || profile.has_technology("apache") {
                if action.tool == "nuclei" || action.tool == "katana" {
                    action.score += 0.20;
                }
            }
            if profile.has_technology("wordpress") {
                if action.tool == "nuclei" {
                    action.score += 0.45; // WordPress-specific nuclei templates
                    action.relevance += 0.35;
                }
                if action.tool == "ffuf" || action.action_type == ActionType::PathFuzz {
                    action.score += 0.35; // Known endpoint discovery
                }
            }
            if profile.has_technology("joomla") || profile.has_technology("drupal") {
                if action.tool == "nuclei" {
                    action.score += 0.35;
                }
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as Web Legacy Application".to_string(),
        ];
        if action.action_type == ActionType::EndpointCrawl || action.action_type.as_str() == "crawl" {
            reasons.push("Legacy web applications require full HTML form and link crawling".to_string());
        }
        if action.tool == "dalfox" || action.action_type.as_str().contains("xss") {
            reasons.push("HTML form and parameter reflection detected; prioritized injection testing".to_string());
        }
        if profile.has_technology("wordpress") {
            reasons.push("WordPress CMS stack detected; elevated priority for CMS-specific CVE templates".to_string());
            if action.action_type == ActionType::PathFuzz || action.tool == "ffuf" {
                reasons.push("known WordPress administrative and core endpoint discovery prioritized".to_string());
            }
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());
        reasons
    }
}

/// Policy for modern server-rendered or hybridized web applications
pub struct WebModernPolicy;

impl InvestigationPolicy for WebModernPolicy {
    fn name(&self) -> &'static str {
        "Web Modern Application Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::WebModern
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

        // Modern component crawling
        candidates.push(
            CandidateAction::new(
                ActionType::EndpointCrawl,
                "katana",
                &base_target,
                "Modern hybridized crawler for SSR and client component discovery",
            )
            .with_metrics(0.70, 0.75, 0.70, 0.25, 0.10)
            .with_context("mode", "modern_component_crawl"),
        );

        // Tech vulnerability scan
        if !profile.technologies.is_empty() {
            candidates.push(
                CandidateAction::new(
                    ActionType::TechVulnerabilityScan,
                    "nuclei",
                    &base_target,
                    format!("Targeted vulnerability scans matching modern stack: {}", profile.technologies.join(", ")),
                )
                .with_metrics(0.75, 0.80, 0.70, 0.35, 0.15),
            );
        }

        // Historical URLs
        candidates.push(
            CandidateAction::new(
                ActionType::HistoricalUrls,
                "gau",
                &base_target,
                "Mine historical archives for unindexed modern application routes",
            )
            .with_metrics(0.65, 0.70, 0.65, 0.15, 0.05),
        );

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "endpoint_crawl" | "crawl" => {
                    action.score += 0.25;
                }
                "tech_vulnerability_scan" => {
                    action.score += 0.30;
                }
                "historical_urls" => {
                    action.score += 0.20;
                }
                _ => {}
            }

            if profile.has_technology("next") || profile.has_technology("nuxt") {
                if action.tool == "nuclei" {
                    action.score += 0.25;
                }
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        vec![
            "target classified as Web Modern Application".to_string(),
            format!("Action {} aligned with modern component discovery", action.action_type),
            "historical experience shows high information gain".to_string(),
            "action has not been executed in current investigation".to_string(),
        ]
    }
}

/// Generic fallback policy
pub struct GenericPolicy;

impl InvestigationPolicy for GenericPolicy {
    fn name(&self) -> &'static str {
        "Generic Investigation Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::Unknown
    }

    fn generate_candidate_actions(
        &self,
        state: &InvestigationState,
        _profile: &TargetProfile,
    ) -> Vec<CandidateAction> {
        let mut candidates = Vec::new();
        if state.endpoints.is_empty() {
            candidates.push(
                CandidateAction::new(
                    ActionType::EndpointCrawl,
                    "katana",
                    &state.target,
                    "Baseline exploratory crawling for unprofiled target",
                )
                .with_metrics(0.60, 0.60, 0.50, 0.25, 0.10),
            );
        }
        candidates
    }

    fn adjust_candidate_actions(&self, _profile: &TargetProfile, _actions: &mut [CandidateAction]) {
        // Neutral adjustments
    }

    fn policy_reasons(&self, _action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        vec![
            format!("Target archetype unknown or ambiguous (confidence: {:.2}); using balanced exploratory baseline", profile.confidence),
            "historical experience shows high information gain".to_string(),
            "action has not been executed in current investigation".to_string(),
        ]
    }
}
