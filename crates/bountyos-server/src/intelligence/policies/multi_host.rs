//! Multi-Host Investigation Policy (v0.7)
//!
//! Prioritizes asset discovery, subdomain enumeration, port mapping, and host correlation
//! across broad targets before deep single-endpoint scanning.

use crate::intelligence::actions::{ActionType, CandidateAction};
use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::policies::InvestigationPolicy;
use crate::intelligence::state::InvestigationState;
use crate::models::target_profile::TargetProfile;

pub struct MultiHostPolicy;

impl InvestigationPolicy for MultiHostPolicy {
    fn name(&self) -> &'static str {
        "Multi-Host Infrastructure Policy"
    }

    fn archetype(&self) -> TargetArchetype {
        TargetArchetype::MultiHost
    }

    fn generate_candidate_actions(
        &self,
        state: &InvestigationState,
        _profile: &TargetProfile,
    ) -> Vec<CandidateAction> {
        let mut candidates = Vec::new();

        // 1. Broad subdomain enumeration (subfinder)
        candidates.push(
            CandidateAction::new(
                ActionType::SubdomainEnumeration,
                "subfinder",
                &state.target,
                "Enumerate multi-host subdomain infrastructure across broad domain target",
            )
            .with_metrics(0.90, 0.95, 0.90, 0.20, 0.05)
            .with_context("mode", "multi_host_discovery"),
        );

        // 2. Multi-host port mapping (naabu)
        for host in state.unscanned_hosts() {
            candidates.push(
                CandidateAction::new(
                    ActionType::PortScan,
                    "naabu",
                    &host.host,
                    format!("Port and service mapping on infrastructure host '{}'", host.host),
                )
                .with_metrics(0.85, 0.90, 0.85, 0.25, 0.10)
                .with_context("host", &host.host),
            );
        }

        // 3. HTTP probing across discovered service ports (httpx)
        for svc in state.unprobed_http_services() {
            let target = format!("{}:{}", svc.host, svc.port);
            candidates.push(
                CandidateAction::new(
                    ActionType::HttpProbe,
                    "httpx",
                    target,
                    format!("Probe HTTP service metadata on host '{}:{}'", svc.host, svc.port),
                )
                .with_metrics(0.80, 0.85, 0.80, 0.15, 0.05),
            );
        }

        candidates
    }

    fn adjust_candidate_actions(&self, profile: &TargetProfile, actions: &mut [CandidateAction]) {
        for action in actions.iter_mut() {
            match action.action_type.as_str() {
                "subdomain_enumeration" | "asset_discovery" => {
                    action.score += 0.50;
                    action.relevance += 0.40;
                }
                "port_scan" | "service_discovery" => {
                    action.score += 0.40;
                    action.relevance += 0.30;
                }
                "endpoint_crawl" | "crawl" => {
                    action.score -= 0.15;
                }
                "parameter_fuzzing" | "route_fuzzing" => {
                    action.score -= 0.25;
                    action.relevance -= 0.15;
                }
                "tech_vulnerability_scan" => {
                    if !profile.exposed_services.is_empty() {
                        action.score += 0.35;
                    }
                }
                _ => {}
            }

            // Tool adjustments
            if action.tool == "subfinder" || action.tool == "naabu" {
                action.score += 0.40;
            }
        }
    }

    fn policy_reasons(&self, action: &CandidateAction, _profile: &TargetProfile) -> Vec<String> {
        let mut reasons = vec![
            "target classified as Multi-Host infrastructure".to_string(),
        ];

        if action.action_type.as_str() == "subdomain_enumeration" || action.tool == "subfinder" {
            reasons.push("broad attack surface requires thorough host discovery prior to deep fuzzing".to_string());
        }
        if action.action_type.as_str() == "port_scan" || action.tool == "naabu" {
            reasons.push("multiple hosts require open service mapping to identify perimeter exposures".to_string());
        }
        if action.action_type.as_str().contains("fuzz") {
            reasons.push("deprioritized single-host fuzzing to conserve bandwidth during perimeter expansion".to_string());
        }
        reasons.push("historical experience shows high information gain".to_string());
        reasons.push("action has not been executed in current investigation".to_string());

        reasons
    }
}
