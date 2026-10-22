//! Bounded Strategic Context for VulnLLM Reasoning (v0.5)
//!
//! Extracts, compresses, and bounds the current attack surface graph, evidence,
//! coverage gaps, and action outcomes into a concise, high-signal prompt payload.
//!
//! CRITICAL PRINCIPLE: Never send unbounded raw scanner outputs to the model.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::intelligence::state::InvestigationState;
use crate::models::action_outcome::ActionOutcome;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeSummary {
    pub target: String,
    pub allowed_domains: Vec<String>,
    pub excluded_hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceContextItem {
    pub port: u16,
    pub protocol: String,
    pub service_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointContextItem {
    pub url: String,
    pub method: String,
    pub parameters: Vec<String>,
    pub status_code: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionOutcomeContextItem {
    pub tool: String,
    pub target: String,
    pub actual_value: f64,
    pub actual_ig: f64,
    pub new_findings: usize,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateActionContextItem {
    pub action_type: String,
    pub tool: String,
    pub target: String,
    pub score: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingContextItem {
    pub title: String,
    pub severity: String,
    pub target: String,
    pub verified: bool,
}

/// Bounded Context for Strategic LLM Reasoning (v0.5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategicContext {
    pub investigation_id: Uuid,
    pub target: String,
    pub scope: ScopeSummary,
    #[serde(default)]
    pub assets: Vec<String>,
    pub services: Vec<ServiceContextItem>,
    pub endpoints: Vec<EndpointContextItem>,
    #[serde(default)]
    pub parameters: Vec<String>,
    pub technologies: Vec<String>,
    pub coverage_gaps: Vec<String>,
    pub existing_findings: Vec<FindingContextItem>,
    #[serde(default)]
    pub action_values: HashMap<String, f64>,
    #[serde(default)]
    pub historical_tool_values: HashMap<String, f64>,
    #[serde(default)]
    pub candidate_actions: Vec<CandidateActionContextItem>,
    #[serde(default)]
    pub recent_actions: Vec<ActionOutcomeContextItem>,
}

impl StrategicContext {
    /// Construct bounded context from current investigation state and telemetry
    pub fn build(
        investigation_id: Uuid,
        state: &InvestigationState,
        outcomes: &[ActionOutcome],
        historical_stats: &HashMap<String, crate::intelligence::action_value::HistoricalToolStats>,
    ) -> Self {
        let scope = ScopeSummary {
            target: state.target.clone(),
            allowed_domains: state.scope.domains.clone(),
            excluded_hosts: state.scope.excluded_hosts.clone(),
        };

        // Extract assets (hosts, subdomains, IPs - max 20)
        let mut assets = Vec::new();
        assets.push(state.target.clone());
        for h in &state.hosts {
            if !assets.contains(&h.host) {
                assets.push(h.host.clone());
            }
            if let Some(ref ip) = h.ip {
                if !assets.contains(ip) {
                    assets.push(ip.clone());
                }
            }
        }
        for s in &state.subdomains {
            if !assets.contains(&s.subdomain) {
                assets.push(s.subdomain.clone());
            }
        }
        assets.truncate(20);

        // Extract technologies (unique, max 12)
        let mut technologies: Vec<String> = state
            .technologies
            .iter()
            .map(|t| t.name.clone())
            .collect();
        technologies.sort();
        technologies.dedup();
        technologies.truncate(12);

        // Extract open services (max 10)
        let services: Vec<ServiceContextItem> = state
            .services
            .iter()
            .take(10)
            .map(|s| ServiceContextItem {
                port: s.port,
                protocol: s.protocol.clone(),
                service_name: s.service_name.clone().unwrap_or_else(|| "unknown".to_string()),
            })
            .collect();

        // Extract endpoints & parameters (max 15)
        let endpoints: Vec<EndpointContextItem> = state
            .endpoints
            .iter()
            .take(15)
            .map(|e| EndpointContextItem {
                url: e.url.clone(),
                method: e.method.clone(),
                parameters: e.params.iter().map(|p| p.name.clone()).collect(),
                status_code: e.status_code,
            })
            .collect();

        // Extract distinct parameter names
        let mut parameters: Vec<String> = state
            .endpoints
            .iter()
            .flat_map(|e| e.params.iter().map(|p| p.name.clone()))
            .collect();
        parameters.sort();
        parameters.dedup();
        parameters.truncate(20);

        // Coverage gaps
        let coverage_report = crate::intelligence::coverage::CoverageModel::assess(state);
        let coverage_gaps: Vec<String> = coverage_report
            .gaps
            .iter()
            .take(6)
            .map(|g| format!("{}: {}", g.gap_type.as_str(), g.description))
            .collect();

        // Recent action outcomes (max 8)
        let recent_actions: Vec<ActionOutcomeContextItem> = outcomes
            .iter()
            .rev()
            .take(8)
            .map(|o| ActionOutcomeContextItem {
                tool: o.tool.clone(),
                target: o.target.clone(),
                actual_value: o.actual_value,
                actual_ig: o.actual_information_gain,
                new_findings: o.new_findings as usize,
                success: o.execution_time_ms < 60000,
            })
            .collect();

        // Existing findings
        let existing_findings: Vec<FindingContextItem> = state
            .findings
            .iter()
            .take(10)
            .map(|f| FindingContextItem {
                title: f.title.clone(),
                severity: format!("{:?}", f.severity),
                target: f.target.clone(),
                verified: f.verified,
            })
            .collect();

        // Historical tool values
        let mut action_values = HashMap::new();
        for (tool, st) in historical_stats {
            action_values.insert(tool.clone(), st.avg_actual_value);
        }
        let historical_tool_values = action_values.clone();

        // Extract sample candidate actions for LLM ranking
        let mut candidate_actions = Vec::new();
        for ep in state.endpoints.iter().take(4) {
            candidate_actions.push(CandidateActionContextItem {
                action_type: "xss_analysis".to_string(),
                tool: "dalfox".to_string(),
                target: ep.url.clone(),
                score: 0.85,
                reason: "Reflected endpoint candidate".to_string(),
            });
        }
        if candidate_actions.is_empty() {
            candidate_actions.push(CandidateActionContextItem {
                action_type: "http_probe".to_string(),
                tool: "httpx".to_string(),
                target: state.target.clone(),
                score: 0.70,
                reason: "Initial web probe".to_string(),
            });
        }

        Self {
            investigation_id,
            target: state.target.clone(),
            scope,
            assets,
            services,
            endpoints,
            parameters,
            technologies,
            coverage_gaps,
            recent_actions,
            existing_findings,
            action_values,
            historical_tool_values,
            candidate_actions,
        }
    }

    /// Render system prompt for VulnLLM-R-7B
    pub fn system_prompt() -> &'static str {
        "You are VulnLLM Strategic Layer for Bounty OS.
Your role is to reason over the structured attack surface graph and hypothesize potential security vulnerabilities.
CRITICAL RULES:
1. You do NOT have execution authority. You cannot execute commands or confirm vulnerabilities.
2. Formulate 1 to 3 testable security hypotheses (category, target, rationale, confidence [0.0-1.0], suggested_actions, required_evidence).
3. Recommend investigation priorities based on attack surface and historical tool effectiveness.
4. Output strictly valid JSON matching the requested schema."
    }

    /// Render bounded user prompt for inference
    pub fn user_prompt(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }
}
