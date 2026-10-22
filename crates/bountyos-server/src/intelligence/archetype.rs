//! Target Archetype Classifier (v0.6)
//!
//! Classifies the investigation target from observed evidence (endpoints, content types,
//! technologies, HTTP status codes, parameter structures), rather than merely the hostname.
//!
//! Non-authoritative: updates dynamically as new observations arrive.

use serde::{Deserialize, Serialize};
use crate::intelligence::state::InvestigationState;

/// Controlled target archetype taxonomy
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TargetArchetype {
    WebLegacy,
    WebModern,
    RestApi,
    GraphqlApi,
    Spa,
    StaticSite,
    AuthBoundary,
    MultiHost,
    Unknown,
}

impl TargetArchetype {
    pub fn as_str(&self) -> &'static str {
        match self {
            TargetArchetype::WebLegacy => "web_legacy",
            TargetArchetype::WebModern => "web_modern",
            TargetArchetype::RestApi => "rest_api",
            TargetArchetype::GraphqlApi => "graphql_api",
            TargetArchetype::Spa => "spa",
            TargetArchetype::StaticSite => "static_site",
            TargetArchetype::AuthBoundary => "auth_boundary",
            TargetArchetype::MultiHost => "multi_host",
            TargetArchetype::Unknown => "unknown",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "web_legacy" => TargetArchetype::WebLegacy,
            "web_modern" => TargetArchetype::WebModern,
            "rest_api" => TargetArchetype::RestApi,
            "graphql_api" => TargetArchetype::GraphqlApi,
            "spa" => TargetArchetype::Spa,
            "static_site" => TargetArchetype::StaticSite,
            "auth_boundary" => TargetArchetype::AuthBoundary,
            "multi_host" => TargetArchetype::MultiHost,
            _ => TargetArchetype::Unknown,
        }
    }
}

/// Target archetype classification result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArchetypeClassification {
    pub archetype: TargetArchetype,
    pub confidence: f64,
    pub evidence: Vec<String>,
}

impl ArchetypeClassification {
    pub fn unknown() -> Self {
        Self {
            archetype: TargetArchetype::Unknown,
            confidence: 0.0,
            evidence: vec!["Insufficient observed evidence to classify target archetype".to_string()],
        }
    }
}

pub struct TargetArchetypeClassifier;

impl TargetArchetypeClassifier {
    /// Classify target archetype strictly from observed evidence in investigation state
    pub fn classify(state: &InvestigationState) -> ArchetypeClassification {
        let mut api_score = 0.0;
        let mut api_evidence = Vec::new();

        let mut graphql_score = 0.0;
        let mut graphql_evidence = Vec::new();

        let mut legacy_score = 0.0;
        let mut legacy_evidence = Vec::new();

        let mut modern_score = 0.0;
        let mut modern_evidence = Vec::new();

        let mut spa_score = 0.0;
        let mut spa_evidence = Vec::new();

        let mut auth_score = 0.0;
        let mut auth_evidence = Vec::new();

        let mut static_score = 0.0;
        let mut static_evidence = Vec::new();

        let mut multi_host_score = 0.0;
        let mut multi_host_evidence = Vec::new();

        // 1. Inspect endpoints and parameter structures
        for ep in &state.endpoints {
            let path_lower = ep.path.to_lowercase();
            let url_lower = ep.url.to_lowercase();

            // REST API signals
            if path_lower.contains("/api/") || path_lower.starts_with("/api") || path_lower.contains("/v1/") || path_lower.contains("/v2/") {
                api_score += 0.35;
                api_evidence.push(format!("API route pattern detected: {}", ep.path));
            }

            if let Some(ct) = &ep.content_type {
                let ct_lower = ct.to_lowercase();
                if ct_lower.contains("application/json") || ct_lower.contains("application/problem+json") {
                    api_score += 0.40;
                    api_evidence.push(format!("JSON content-type: {} on {}", ct, ep.path));
                }
            }

            if ep.method == "PUT" || ep.method == "DELETE" || ep.method == "PATCH" {
                api_score += 0.25;
                api_evidence.push(format!("RESTful HTTP method {} on {}", ep.method, ep.path));
            }

            // GraphQL signals
            if path_lower.contains("/graphql") || path_lower.contains("/graphiql") {
                graphql_score += 0.60;
                graphql_evidence.push(format!("GraphQL endpoint identified: {}", ep.path));
            }

            // Auth boundary signals
            if path_lower.contains("/admin") || path_lower.contains("/login") || path_lower.contains("/auth") || path_lower.contains("/oauth") {
                auth_score += 0.35;
                auth_evidence.push(format!("Authentication / admin path detected: {}", ep.path));
            }

            if ep.status_code == Some(401) || ep.status_code == Some(403) {
                auth_score += 0.40;
                auth_evidence.push(format!("HTTP {} access restricted status code on {}", ep.status_code.unwrap(), ep.path));
            }

            // Legacy web signals
            if path_lower.ends_with(".php") || path_lower.ends_with(".asp") || path_lower.ends_with(".aspx") || path_lower.ends_with(".jsp") {
                legacy_score += 0.45;
                legacy_evidence.push(format!("Server-side script extension: {}", ep.path));
            }

            if ep.params.iter().any(|p| p.name == "search" || p.name == "q" || p.name == "id" || p.name == "page") {
                legacy_score += 0.20;
                legacy_evidence.push(format!("Form query parameters present on {}", ep.path));
            }
        }

        // 2. Inspect detected technologies
        for tech in &state.technologies {
            let name_lower = tech.name.to_lowercase();
            let cat_lower = tech.category.as_deref().unwrap_or("").to_lowercase();

            if name_lower.contains("php") || name_lower.contains("apache") || name_lower.contains("iis") || name_lower.contains("wordpress") {
                legacy_score += 0.30;
                legacy_evidence.push(format!("Legacy technology detected: {}", tech.name));
            }

            if name_lower.contains("react") || name_lower.contains("vue") || name_lower.contains("angular") || cat_lower.contains("spa") {
                spa_score += 0.45;
                spa_evidence.push(format!("Client-side SPA framework detected: {}", tech.name));
            }

            if name_lower.contains("next.js") || name_lower.contains("nuxt") || name_lower.contains("svelte") || name_lower.contains("tailwind") {
                modern_score += 0.40;
                modern_evidence.push(format!("Modern web framework detected: {}", tech.name));
            }
        }

        // 3. Inspect multi-host topology
        let active_hosts = state.hosts.len();
        let subdomains_count = state.subdomains.len();
        if active_hosts > 1 || subdomains_count > 3 {
            multi_host_score += 0.40;
            multi_host_evidence.push(format!("Multi-host topology: {} active hosts, {} subdomains", active_hosts, subdomains_count));
        }

        // 4. Static site fallback check
        if state.endpoints.len() >= 2 && state.endpoints.iter().all(|e| e.params.is_empty() && (e.path.ends_with(".html") || e.path == "/")) && legacy_score == 0.0 && api_score == 0.0 {
            static_score += 0.50;
            static_evidence.push("Static HTML documents with zero dynamic parameters".to_string());
        }

        // 5. Select highest scoring archetype
        let candidates = [
            (TargetArchetype::RestApi, api_score, api_evidence),
            (TargetArchetype::GraphqlApi, graphql_score, graphql_evidence),
            (TargetArchetype::AuthBoundary, auth_score, auth_evidence),
            (TargetArchetype::Spa, spa_score, spa_evidence),
            (TargetArchetype::WebLegacy, legacy_score, legacy_evidence),
            (TargetArchetype::WebModern, modern_score, modern_evidence),
            (TargetArchetype::MultiHost, multi_host_score, multi_host_evidence),
            (TargetArchetype::StaticSite, static_score, static_evidence),
        ];

        let mut best_archetype = TargetArchetype::Unknown;
        let mut best_score: f64 = 0.0;
        let mut best_evidence = Vec::new();

        for (arch, score, evidence) in candidates {
            if score > best_score && score >= 0.30 {
                best_score = score;
                best_archetype = arch;
                best_evidence = evidence;
            }
        }

        if best_archetype == TargetArchetype::Unknown {
            ArchetypeClassification::unknown()
        } else {
            let confidence = (best_score.min(0.95) * 100.0).round() / 100.0;
            ArchetypeClassification {
                archetype: best_archetype,
                confidence,
                evidence: best_evidence,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{DiscoveredEndpoint, DiscoveredTechnology, ScopeBoundary, InvestigationProfile};

    #[test]
    fn test_classify_unknown_with_empty_state() {
        let state = InvestigationState::new("http://example.com", ScopeBoundary::new(), InvestigationProfile::Standard);
        let classification = TargetArchetypeClassifier::classify(&state);
        assert_eq!(classification.archetype, TargetArchetype::Unknown);
        assert_eq!(classification.confidence, 0.0);
    }

    #[test]
    fn test_classify_rest_api_from_endpoints() {
        let mut state = InvestigationState::new("http://example.com", ScopeBoundary::new(), InvestigationProfile::Standard);
        let mut ep = DiscoveredEndpoint::new("http://example.com/api/v1/config", "example.com", 80, "/api/v1/config");
        ep.content_type = Some("application/json".to_string());
        ep.method = "GET".to_string();
        state.endpoints.push(ep);

        let classification = TargetArchetypeClassifier::classify(&state);
        assert_eq!(classification.archetype, TargetArchetype::RestApi);
        assert!(classification.confidence >= 0.70);
        assert!(classification.evidence.iter().any(|e| e.contains("application/json")));
    }

    #[test]
    fn test_classify_web_legacy_from_php_and_forms() {
        let mut state = InvestigationState::new("http://example.com", ScopeBoundary::new(), InvestigationProfile::Standard);
        let mut ep = DiscoveredEndpoint::new("http://example.com/search.php", "example.com", 80, "/search.php");
        ep.params.push(crate::intelligence::state::DiscoveredParam {
            name: "q".to_string(),
            location: crate::intelligence::state::ParamLocation::Query,
            reflected: true,
            reflection_context: None,
            tested_for_xss: false,
            tested_for_sqli: false,
        });
        state.endpoints.push(ep);
        state.technologies.push(DiscoveredTechnology {
            name: "PHP".to_string(),
            version: Some("7.4".to_string()),
            cpe: None,
            category: Some("Programming Language".to_string()),
            templates_matched: Vec::new(),
        });

        let classification = TargetArchetypeClassifier::classify(&state);
        assert_eq!(classification.archetype, TargetArchetype::WebLegacy);
        assert!(classification.confidence >= 0.60);
    }

    #[test]
    fn test_classify_auth_boundary_from_401_and_admin() {
        let mut state = InvestigationState::new("http://example.com", ScopeBoundary::new(), InvestigationProfile::Standard);
        let mut ep = DiscoveredEndpoint::new("http://example.com/admin", "example.com", 80, "/admin");
        ep.status_code = Some(401);
        state.endpoints.push(ep);

        let classification = TargetArchetypeClassifier::classify(&state);
        assert_eq!(classification.archetype, TargetArchetype::AuthBoundary);
        assert!(classification.confidence >= 0.60);
    }
}
