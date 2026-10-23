//! GraphQL API Policy (v0.7)
//!
//! Prioritizes GraphQL schema introspection, query batching checks, and field suggestion enumeration.

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::TargetProfile;

pub struct GraphqlPolicy;

impl InvestigationPolicy for GraphqlPolicy {
    fn name(&self) -> &'static str {
        "GraphQL API Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::GraphqlApi
    }

    fn generate_candidate_actions(
        &self,
        state: &InvestigationState,
        _profile: &TargetProfile,
    ) -> Vec<CandidateAction> {
        let mut candidates = Vec::new();
        let base_target = if let Some(first_ep) = state.endpoints.first() {
            first_ep.url.clone()
        } else {
            state.target.clone()
        };

        // 1. GraphQL endpoint discovery (ffuf)
        candidates.push(
            CandidateAction::new(
                ActionType::PathFuzz,
                "ffuf",
                &base_target,
                "Discover GraphQL entrypoints (/graphql, /graphiql, /api/graphql, /query)",
            )
            .with_metrics(0.85, 0.90, 0.85, 0.15, 0.05)
            .with_context("mode", "graphql_endpoint_discovery"),
        );

        // 2. Schema introspection & query batching checks (nuclei)
        candidates.push(
            CandidateAction::new(
                ActionType::TechVulnerabilityScan,
                "nuclei",
                &base_target,
                "Audit GraphQL schema introspection, circular query DoS, and batching vulnerability templates",
            )
            .with_metrics(0.90, 0.90, 0.80, 0.30, 0.15)
            .with_context("mode", "graphql_schema_audit"),
        );

        // 3. Monolithic gateway parameter fuzzing
        for ep in &state.endpoints {
            if ep.path.contains("graphql") {
                candidates.push(
                    CandidateAction::new(
                        ActionType::PathFuzz,
                        "ffuf",
                        &ep.url,
                        format!("GraphQL query parameter tampering on gateway '{}'", ep.path),
                    )
                    .with_metrics(0.75, 0.80, 0.70, 0.20, 0.10)
                    .with_context("path", &ep.path),
                );
            }
        }

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "tech_vulnerability_scan" => {
                    if action.tool == "nuclei" {
                        action.score += 0.45; // Schema-related checks & introspection
                        action.relevance += 0.35;
                    }
                }
                "parameter_fuzzing" | "path_fuzz" => {
                    action.score += 0.40; // GraphQL endpoint discovery & query fuzzing
                }
                "endpoint_crawl" | "crawl" => {
                    action.score -= 0.35; // GraphQL endpoints are monolithic (/graphql)
                }
                "subdomain_enumeration" => {
                    action.score -= 0.20;
                }
                _ => {}
            }

            // Technology-specific action weighting (Section 4)
            if profile.has_technology("graphql") || profile.has_technology("apollo") || profile.has_technology("hasura") {
                if action.tool == "nuclei" {
                    action.score += 0.30;
                }
                if action.tool == "ffuf" {
                    action.score += 0.25;
                }
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as GraphQL API".to_string(),
        ];

        if action.tool == "nuclei" {
            reasons.push("GraphQL endpoint identified; elevated priority for schema introspection and batch query checks".to_string());
        }
        if action.tool == "ffuf" || action.action_type == ActionType::PathFuzz {
            reasons.push("GraphQL endpoint discovery prioritized to map /graphql and /graphiql entrypoints".to_string());
        }
        if action.action_type.as_str() == "endpoint_crawl" {
            reasons.push("monolithic POST gateways render multi-page HTML crawling unproductive".to_string());
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());

        reasons
    }
}
