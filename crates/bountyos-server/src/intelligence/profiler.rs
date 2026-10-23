//! Target Profiler (v0.7 Target-Specific Investigation Policies)
//!
//! Generates a normalized, evidence-grounded TargetProfile from observed attack surface state.
//! Never allows LLMs to declare target types without backing evidence.

use uuid::Uuid;
use crate::intelligence::archetype::{TargetArchetype, TargetArchetypeClassifier};
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::{AuthenticationState, TargetProfile};

pub struct TargetProfiler;

impl TargetProfiler {
    /// Build a normalized TargetProfile from the live investigation state
    pub fn profile(investigation_id: Uuid, state: &InvestigationState) -> TargetProfile {
        // 1. Inferred Archetype & Evidence from classifier
        let archetype_res = TargetArchetypeClassifier::classify(state);
        let archetype = archetype_res.archetype;
        let mut evidence = archetype_res.evidence;
        let mut confidence = archetype_res.confidence;

        // 2. Discover technologies from state entities
        let mut technologies = Vec::new();
        let mut exposed_services = Vec::new();
        let mut api_indicators = false;
        let mut javascript_heavy = false;
        let total_endpoints = state.endpoints.len();
        let mut historical_urls = 0;
        let mut auth_state = AuthenticationState::None;

        for tech in &state.technologies {
            if !technologies.contains(&tech.name) {
                technologies.push(tech.name.clone());
            }
        }

        for svc in &state.services {
            let label = if let Some(ref name) = svc.service_name {
                format!("{}:{}", name, svc.port)
            } else {
                format!("{}:{}", svc.protocol, svc.port)
            };
            if !exposed_services.contains(&label) {
                exposed_services.push(label);
            }
        }

        for ep in &state.endpoints {
            let path = ep.path.to_lowercase();

            if path.contains("/api") || path.contains("/v1") || path.contains("/v2") || path.contains(".json") {
                api_indicators = true;
            }
            if path.ends_with(".js") || path.contains("/bundle") || path.contains("/chunk") || path.contains("/static/js") {
                javascript_heavy = true;
            }
            if path.contains("login") || path.contains("auth") || path.contains("oauth") || path.contains("signin") || path.contains("token") {
                if auth_state == AuthenticationState::None {
                    auth_state = AuthenticationState::Unauthenticated;
                }
            }
            if ep.historical {
                historical_urls += 1;
            }
            if let Some(ref ct) = ep.content_type {
                let ct_lower = ct.to_lowercase();
                if ct_lower.contains("application/json") {
                    api_indicators = true;
                }
                if ct_lower.contains("javascript") {
                    javascript_heavy = true;
                }
            }
            for tech in &ep.technologies {
                if !technologies.contains(tech) {
                    technologies.push(tech.clone());
                }
            }
        }

        // Infer technologies from state target if not populated
        let target_lower = state.target.to_lowercase();
        if target_lower.contains("api") || target_lower.contains("json") {
            api_indicators = true;
            if !evidence.contains(&"Target URL implies API service".to_string()) {
                evidence.push("Target URL implies API service".to_string());
            }
        }

        let historical_url_density = if total_endpoints > 0 {
            historical_urls as f64 / total_endpoints as f64
        } else {
            0.0
        };

        // Determine application type
        let application_type = match archetype {
            TargetArchetype::RestApi => "rest_api".to_string(),
            TargetArchetype::GraphqlApi => "graphql_api".to_string(),
            TargetArchetype::Spa => "single_page_application".to_string(),
            TargetArchetype::WebLegacy => "legacy_web_app".to_string(),
            TargetArchetype::WebModern => "modern_web_app".to_string(),
            TargetArchetype::AuthBoundary => "auth_gateway".to_string(),
            TargetArchetype::MultiHost => "multi_host_infrastructure".to_string(),
            TargetArchetype::StaticSite => "static_content".to_string(),
            TargetArchetype::Unknown => "unknown_architecture".to_string(),
        };

        // Add technology-specific evidence cues
        for tech in &technologies {
            let cue = format!("Observed running technology: {}", tech);
            if !evidence.contains(&cue) {
                evidence.push(cue);
            }
        }
        if api_indicators {
            let cue = "Identified structured API indicators (/api/, JSON payload content)".to_string();
            if !evidence.contains(&cue) {
                evidence.push(cue);
            }
        }
        if javascript_heavy {
            let cue = "Client-side JavaScript bundle distribution identified".to_string();
            if !evidence.contains(&cue) {
                evidence.push(cue);
            }
        }
        if auth_state != AuthenticationState::None && auth_state != AuthenticationState::Unknown {
            let cue = format!("Authentication boundary detected: {:?}", auth_state);
            if !evidence.contains(&cue) {
                evidence.push(cue);
            }
        }

        if confidence < 0.3 && !evidence.is_empty() {
            confidence = (evidence.len() as f64 * 0.25).min(0.95);
        }

        TargetProfile::new(
            investigation_id,
            archetype,
            technologies,
            exposed_services,
            application_type,
            auth_state,
            api_indicators,
            javascript_heavy,
            historical_url_density,
            evidence,
            confidence,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{DiscoveredEndpoint, InvestigationProfile, ScopeBoundary};

    #[test]
    fn test_target_profiling_rest_api() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("http://api.target.local:8888/v1/config", scope, InvestigationProfile::Policy);
        let mut ep = DiscoveredEndpoint::new(
            "http://api.target.local:8888/api/v1/users",
            "api.target.local",
            8888,
            "/api/v1/users",
        );
        ep.content_type = Some("application/json".to_string());
        state.endpoints.push(ep);

        let profile = TargetProfiler::profile(Uuid::new_v4(), &state);
        assert!(profile.api_indicators);
        assert!(profile.confidence > 0.0);
    }
}
