//! Authentication Boundary Policy (v0.7)
//!
//! Prioritizes session handling, token validation, OAuth/SAML redirect analysis, and access control testing.

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::TargetProfile;

pub struct AuthBoundaryPolicy;

impl InvestigationPolicy for AuthBoundaryPolicy {
    fn name(&self) -> &'static str {
        "Authentication Boundary Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::AuthBoundary
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

        // 1. Session handling, JWT, and OAuth vulnerability scanning (nuclei)
        candidates.push(
            CandidateAction::new(
                ActionType::TechVulnerabilityScan,
                "nuclei",
                &base_target,
                "Audit OAuth 2.0, OpenID Connect, JWT signature bypass, and SSO redirection vulnerabilities",
            )
            .with_metrics(0.90, 0.90, 0.85, 0.30, 0.15)
            .with_context("mode", "auth_vulnerability_audit"),
        );

        // 2. Redirect URL and state parameter tampering (ffuf)
        candidates.push(
            CandidateAction::new(
                ActionType::PathFuzz,
                "ffuf",
                &base_target,
                "Fuzz redirect_uri, client_id, and state parameter validation on authentication endpoints",
            )
            .with_metrics(0.85, 0.85, 0.80, 0.20, 0.10)
            .with_context("mode", "auth_param_tampering"),
        );

        // 3. Auth endpoint route discovery (/auth, /oauth, /login, /saml)
        candidates.push(
            CandidateAction::new(
                ActionType::PathFuzz,
                "ffuf",
                &base_target,
                "Discover unlinked authentication and SSO callback routes (/oauth/callback, /saml/sso)",
            )
            .with_metrics(0.80, 0.85, 0.75, 0.15, 0.05)
            .with_context("mode", "auth_route_discovery"),
        );

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "tech_vulnerability_scan" => {
                    if action.tool == "nuclei" {
                        action.score += 0.40; // OAuth, JWT, login bypass templates
                        action.relevance += 0.30;
                    }
                }
                "parameter_fuzzing" | "path_fuzz" => {
                    action.score += 0.35; // Redirect URL / state parameter tampering
                }
                "endpoint_crawl" | "crawl" => {
                    action.score += 0.20;
                }
                _ => {}
            }

            // Technology weighting for auth providers
            if profile.has_technology("keycloak") || profile.has_technology("okta") || profile.has_technology("auth0") {
                if action.tool == "nuclei" {
                    action.score += 0.30;
                }
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, _profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as Authentication Boundary".to_string(),
        ];

        if action.tool == "nuclei" {
            reasons.push("authentication gateway detected; prioritized token, session, and SSO bypass validation".to_string());
        }
        if action.action_type.as_str().contains("fuzz") || action.tool == "ffuf" {
            reasons.push("prioritized redirect_uri, client_id, and state parameter testing on authentication flow".to_string());
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());

        reasons
    }
}
