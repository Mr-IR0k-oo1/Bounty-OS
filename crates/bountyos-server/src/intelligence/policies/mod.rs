//! Policy Engine (v0.7 Target-Specific Investigation Policies)
//!
//! Provides specialized investigation policies derived from target archetypes and technology stacks.
//! Modifies candidate action prioritization, weighting, and provenance without creating fragmented execution pipelines.

pub mod api;
pub mod auth;
pub mod graphql;
pub mod multi_host;
pub mod spa;
pub mod web;

use serde::{Deserialize, Serialize};
use crate::intelligence::actions::CandidateAction;
use crate::intelligence::archetype::TargetArchetype;
use crate::models::target_profile::TargetProfile;

/// Self-explaining decision provenance for an action evaluated under an investigation policy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicyDecision {
    pub policy_name: String,
    pub action_type: String,
    pub tool: String,
    pub score: f64,
    pub priority_adjustment: f64,
    pub reasons: Vec<String>,
    pub evidence_refs: Vec<String>,
}

/// Common trait implemented by all target investigation policies
pub trait InvestigationPolicy: Send + Sync {
    /// Friendly policy display name
    fn name(&self) -> &'static str;

    /// Associated target archetype
    fn archetype(&self) -> TargetArchetype;

    /// Generate candidate actions recommended by this policy based on target attack surface state and profile
    fn generate_candidate_actions(
        &self,
        state: &crate::intelligence::state::InvestigationState,
        profile: &TargetProfile,
    ) -> Vec<CandidateAction> {
        let _ = (state, profile);
        Vec::new()
    }

    /// Adjust candidate actions according to the target policy
    fn adjust_candidate_actions(
        &self,
        profile: &TargetProfile,
        actions: &mut [CandidateAction],
    );

    /// Generate structured, auditable reasons for an action under this policy
    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String>;

    /// Extract relevant evidence references for the given action
    fn evidence_refs(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        let mut refs = Vec::new();
        if !action.target.is_empty() {
            if action.target.starts_with("http://") || action.target.starts_with("https://") || action.target.contains('/') {
                refs.push(format!("endpoint:{}", action.target));
            } else {
                refs.push(format!("asset:{}", action.target));
            }
        }
        for tech in &profile.technologies {
            if action.reason.to_lowercase().contains(&tech.to_lowercase())
                || action.context.values().any(|v| v.to_lowercase().contains(&tech.to_lowercase()))
            {
                refs.push(format!("technology:{}", tech));
            }
        }
        for ev in &profile.evidence {
            if ev.to_lowercase().contains(&action.tool.to_lowercase())
                || ev.to_lowercase().contains(&action.action_type.as_str().to_lowercase())
            {
                if !refs.contains(ev) {
                    refs.push(ev.clone());
                }
            }
        }
        if refs.is_empty() {
            refs.push(format!("profile:archetype={}", profile.archetype.as_str()));
        }
        refs
    }
}

/// Registry and dispatcher for investigation policies
pub struct PolicyRegistry;

impl PolicyRegistry {
    /// Retrieve the specialized policy matching the given target archetype
    pub fn get_policy_for(archetype: TargetArchetype) -> Box<dyn InvestigationPolicy> {
        match archetype {
            TargetArchetype::RestApi => Box::new(api::RestApiPolicy),
            TargetArchetype::GraphqlApi => Box::new(graphql::GraphqlPolicy),
            TargetArchetype::Spa => Box::new(spa::SpaPolicy),
            TargetArchetype::WebLegacy => Box::new(web::WebLegacyPolicy),
            TargetArchetype::WebModern => Box::new(web::WebModernPolicy),
            TargetArchetype::AuthBoundary => Box::new(auth::AuthBoundaryPolicy),
            TargetArchetype::MultiHost => Box::new(multi_host::MultiHostPolicy),
            TargetArchetype::StaticSite | TargetArchetype::Unknown => {
                Box::new(web::GenericPolicy)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use crate::intelligence::actions::ActionType;
    use crate::intelligence::planner::IntelligencePlanner;
    use crate::intelligence::profiler::TargetProfiler;
    use crate::intelligence::state::{
        DiscoveredEndpoint, DiscoveredTechnology, InvestigationProfile, ScopeBoundary, InvestigationState,
    };
    use crate::models::target_profile::AuthenticationState;

    #[test]
    fn test_rest_api_policy_candidate_generation() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("api.target.local".to_string());
        let mut state = InvestigationState::new("http://api.target.local:8080/v1", scope, InvestigationProfile::Policy);
        state.endpoints.push(DiscoveredEndpoint::new(
            "http://api.target.local:8080/api/v1/users",
            "api.target.local",
            8080,
            "/api/v1/users",
        ));

        let profile = TargetProfiler::profile(Uuid::new_v4(), &state);
        let policy = PolicyRegistry::get_policy_for(profile.archetype);
        let candidates = policy.generate_candidate_actions(&state, &profile);

        assert!(!candidates.is_empty(), "Policy must generate candidate actions");
        assert!(candidates.iter().any(|c| c.context.get("mode") == Some(&"api_route_discovery".to_string())));
        assert!(candidates.iter().any(|c| c.tool == "ffuf"));
        // Ensure no raw shell commands are present in reasons or context
        for cand in &candidates {
            assert!(!cand.reason.contains("bash"));
            assert!(!cand.reason.contains("sh -c"));
            assert!(!cand.tool.contains(' '));
        }
    }

    #[test]
    fn test_spa_policy_candidate_generation() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("app.target.local".to_string());
        let mut state = InvestigationState::new("http://app.target.local", scope, InvestigationProfile::Policy);
        let mut ep = DiscoveredEndpoint::new(
            "http://app.target.local/static/js/main.chunk.js",
            "app.target.local",
            80,
            "/static/js/main.chunk.js",
        );
        ep.content_type = Some("application/javascript".to_string());
        state.endpoints.push(ep);

        let profile = TargetProfiler::profile(Uuid::new_v4(), &state);
        assert_eq!(profile.archetype, TargetArchetype::Spa);

        let policy = PolicyRegistry::get_policy_for(profile.archetype);
        let candidates = policy.generate_candidate_actions(&state, &profile);

        assert!(candidates.iter().any(|c| c.tool == "katana" && c.context.get("mode") == Some(&"js_endpoint_extraction".to_string())));
        assert!(candidates.iter().any(|c| c.tool == "gau" && c.context.get("mode") == Some(&"historical_url_analysis".to_string())));
    }

    #[test]
    fn test_graphql_policy_candidate_generation() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("gql.target.local".to_string());
        let mut state = InvestigationState::new("http://gql.target.local/graphql", scope, InvestigationProfile::Policy);
        state.endpoints.push(DiscoveredEndpoint::new(
            "http://gql.target.local/graphql",
            "gql.target.local",
            80,
            "/graphql",
        ));

        let profile = TargetProfiler::profile(Uuid::new_v4(), &state);
        assert_eq!(profile.archetype, TargetArchetype::GraphqlApi);

        let policy = PolicyRegistry::get_policy_for(profile.archetype);
        let candidates = policy.generate_candidate_actions(&state, &profile);

        assert!(candidates.iter().any(|c| c.context.get("mode") == Some(&"graphql_schema_audit".to_string())));
    }

    #[test]
    fn test_technology_weighting_wordpress() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("blog.target.local".to_string());
        let mut state = InvestigationState::new("http://blog.target.local", scope, InvestigationProfile::Policy);
        state.technologies.push(DiscoveredTechnology {
            name: "WordPress".to_string(),
            version: Some("6.4".to_string()),
            cpe: None,
            category: Some("CMS".to_string()),
            templates_matched: Vec::new(),
        });
        state.endpoints.push(DiscoveredEndpoint::new(
            "http://blog.target.local/wp-login.php",
            "blog.target.local",
            80,
            "/wp-login.php",
        ));

        let profile = TargetProfiler::profile(Uuid::new_v4(), &state);
        assert!(profile.has_technology("wordpress"));

        let plan = IntelligencePlanner::plan_with_policy(&state, None, None, None, None, Some(&profile));
        let rec = plan.recommended_action.expect("Recommended action must be present");
        assert!(rec.policy_reasons.iter().any(|r| r.contains("WordPress")));
        assert!(rec.evidence_refs.iter().any(|r| r.contains("WordPress") || r.contains("technology:WordPress")));
    }

    #[test]
    fn test_provenance_structure_and_reproducibility() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("api.target.local".to_string());
        let mut state = InvestigationState::new("http://api.target.local/api/v1", scope, InvestigationProfile::Policy);
        state.hosts[0].ports_scanned = true;
        let mut ep = DiscoveredEndpoint::new(
            "http://api.target.local/api/v1/orders",
            "api.target.local",
            80,
            "/api/v1/orders",
        );
        ep.content_type = Some("application/json".to_string());
        state.endpoints.push(ep);

        let plan1 = IntelligencePlanner::plan(&state);
        let plan2 = IntelligencePlanner::plan(&state);

        // Reproducibility check: ranking, action, score, and reasons are deterministic
        assert_eq!(plan1.policy_name, plan2.policy_name);
        let rec1 = plan1.recommended_action.as_ref().unwrap();
        let rec2 = plan2.recommended_action.as_ref().unwrap();
        assert_eq!(rec1.tool, rec2.tool);
        assert_eq!(rec1.target, rec2.target);
        assert_eq!(rec1.score, rec2.score);
        assert_eq!(rec1.action_type, rec2.action_type);
        assert_eq!(rec1.policy_reasons, rec2.policy_reasons);

        let decision = plan1.policy_decision.expect("Policy decision provenance must be present");
        assert_eq!(decision.policy_name, "REST API Policy");
        assert!(!decision.reasons.is_empty());
        assert!(decision.reasons.iter().any(|r| r.contains("REST API")));
        assert!(decision.reasons.iter().any(|r| r.contains("API endpoints detected")));
        assert!(decision.reasons.iter().any(|r| r.contains("historical experience shows high information gain")));
        assert!(decision.reasons.iter().any(|r| r.contains("action has not been executed in current investigation")));
        assert!(!decision.evidence_refs.is_empty());
    }

    #[test]
    fn test_benchmark_comparative_planner_matrix() {
        // Evaluate Fixed vs Generic vs Target Policy on a REST API target
        let mut scope = ScopeBoundary::new();
        scope.domains.push("api.local".to_string());

        let mut fixed_state = InvestigationState::new("api.local", scope.clone(), InvestigationProfile::Fixed);
        let mut generic_state = InvestigationState::new("api.local", scope.clone(), InvestigationProfile::Standard);
        let mut policy_state = InvestigationState::new("api.local", scope, InvestigationProfile::Policy);

        // Prepopulate discovered REST API endpoint
        let mut ep = DiscoveredEndpoint::new("http://api.local/api/v1/users", "api.local", 80, "/api/v1/users");
        ep.content_type = Some("application/json".to_string());
        generic_state.endpoints.push(ep.clone());
        policy_state.endpoints.push(ep);

        let fixed_plan = IntelligencePlanner::plan(&fixed_state);
        let generic_plan = IntelligencePlanner::plan(&generic_state);
        let policy_plan = IntelligencePlanner::plan(&policy_state);

        let fixed_action = fixed_plan.recommended_action.expect("Fixed action");
        let generic_action = generic_plan.recommended_action.expect("Generic action");
        let policy_action = policy_plan.recommended_action.expect("Policy action");

        // Fixed pipeline rigidly executes subfinder regardless of API endpoint presence
        assert_eq!(fixed_action.tool, "subfinder");

        // Policy planner engages REST API policy
        assert_eq!(policy_plan.policy_name, Some("REST API Policy".to_string()));
        assert!(policy_action.policy_reasons.iter().any(|r| r.contains("REST API")));

        // Policy plan prioritizes API fuzzing/discovery over generic tools
        assert!(policy_action.action_type == ActionType::PathFuzz || policy_action.tool == "ffuf");
    }
}
