//! Evidence-Driven Adaptive Investigation Planner
//!
//! Evaluates the investigation state, checks explicit preconditions, detects redundancy,
//! computes explainable 0–100 scores across 23 typed security capabilities, and persists
//! decisions with complete provenance.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::intelligence::archetype::TargetArchetype;
use crate::intelligence::profiler::TargetProfiler;
use crate::intelligence::runner::StateSummary;
use crate::intelligence::state::{
    FindingConfidence, InvestigationProfile, InvestigationState, StopReason,
};
use crate::models::planner_decision::{save_planner_decision, PlannerDecision};
use crate::state::AppState;

/// 23 typed security capabilities for adaptive planning
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PlannerCapability {
    ReconSubdomains,
    ResolveDNS,
    DiscoverPorts,
    ProbeHTTP,
    CrawlApplication,
    CollectHistoricalURLs,
    DiscoverDirectories,
    DiscoverParameters,
    AnalyzeJavaScript,
    SearchSecrets,
    AnalyzeAPI,
    AnalyzeGraphQL,
    RunTechnologyTemplates,
    InvestigateXSS,
    InvestigateSQLi,
    InvestigateSSRF,
    InvestigateSSTI,
    InvestigateLFI,
    InvestigateJWT,
    InvestigateAuthorization,
    AnalyzeBehavior,
    GenerateThreatModel,
    VerifyFinding,
    Stop,
}

impl PlannerCapability {
    pub fn as_str(&self) -> &'static str {
        match self {
            PlannerCapability::ReconSubdomains => "recon_subdomains",
            PlannerCapability::ResolveDNS => "resolve_dns",
            PlannerCapability::DiscoverPorts => "discover_ports",
            PlannerCapability::ProbeHTTP => "probe_http",
            PlannerCapability::CrawlApplication => "crawl_application",
            PlannerCapability::CollectHistoricalURLs => "collect_historical_urls",
            PlannerCapability::DiscoverDirectories => "discover_directories",
            PlannerCapability::DiscoverParameters => "discover_parameters",
            PlannerCapability::AnalyzeJavaScript => "analyze_javascript",
            PlannerCapability::SearchSecrets => "search_secrets",
            PlannerCapability::AnalyzeAPI => "analyze_api",
            PlannerCapability::AnalyzeGraphQL => "analyze_graphql",
            PlannerCapability::RunTechnologyTemplates => "run_technology_templates",
            PlannerCapability::InvestigateXSS => "investigate_xss",
            PlannerCapability::InvestigateSQLi => "investigate_sqli",
            PlannerCapability::InvestigateSSRF => "investigate_ssrf",
            PlannerCapability::InvestigateSSTI => "investigate_ssti",
            PlannerCapability::InvestigateLFI => "investigate_lfi",
            PlannerCapability::InvestigateJWT => "investigate_jwt",
            PlannerCapability::InvestigateAuthorization => "investigate_authorization",
            PlannerCapability::AnalyzeBehavior => "analyze_behavior",
            PlannerCapability::GenerateThreatModel => "generate_threat_model",
            PlannerCapability::VerifyFinding => "verify_finding",
            PlannerCapability::Stop => "stop",
        }
    }

    pub fn default_tool(&self) -> &'static str {
        match self {
            PlannerCapability::ReconSubdomains => "subfinder",
            PlannerCapability::ResolveDNS => "dnsx",
            PlannerCapability::DiscoverPorts => "naabu",
            PlannerCapability::ProbeHTTP => "httpx",
            PlannerCapability::CrawlApplication => "katana",
            PlannerCapability::CollectHistoricalURLs => "gau",
            PlannerCapability::DiscoverDirectories => "ffuf",
            PlannerCapability::DiscoverParameters => "arjun",
            PlannerCapability::AnalyzeJavaScript => "linkfinder",
            PlannerCapability::SearchSecrets => "trufflehog",
            PlannerCapability::AnalyzeAPI => "httpx",
            PlannerCapability::AnalyzeGraphQL => "graphw00f",
            PlannerCapability::RunTechnologyTemplates => "nuclei",
            PlannerCapability::InvestigateXSS => "dalfox",
            PlannerCapability::InvestigateSQLi => "sqlmap",
            PlannerCapability::InvestigateSSRF => "ssrfmap",
            PlannerCapability::InvestigateSSTI => "sstimap",
            PlannerCapability::InvestigateLFI => "lfimap",
            PlannerCapability::InvestigateJWT => "jwt_tool",
            PlannerCapability::InvestigateAuthorization => "authz_engine",
            PlannerCapability::AnalyzeBehavior => "behavior_analyzer",
            PlannerCapability::GenerateThreatModel => "threat_model_engine",
            PlannerCapability::VerifyFinding => "deterministic_verifier",
            PlannerCapability::Stop => "none",
        }
    }
}

/// Normalized explainable score components (0–100 scale)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlannerScoreComponents {
    pub information_gain: f64,
    pub finding_potential: f64,
    pub target_relevance: f64,
    pub evidence_completeness: f64,
    pub execution_cost: f64,
    pub risk_penalty: f64,
    pub redundancy_penalty: f64,
    #[serde(default)]
    pub advisory_llm_bonus: f64,
}

impl PlannerScoreComponents {
    pub fn total(&self) -> f64 {
        let gross = self.information_gain
            + self.finding_potential
            + self.target_relevance
            + self.evidence_completeness
            + self.advisory_llm_bonus;
        let deductions = self.execution_cost + self.risk_penalty + self.redundancy_penalty;
        let net = gross - deductions;
        net.clamp(0.0, 100.0).round()
    }
}

/// Typed planner action definition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlannerActionDef {
    pub action_id: String,
    pub capability: PlannerCapability,
    pub tool: String,
    pub target: String,
    pub required_state: String,
    pub produced_state: String,
    pub required_tools: Vec<String>,
    pub risk_level: String,
    pub estimated_cost: String,
    pub expected_information_gain: f64,
    pub expected_finding_value: f64,
    pub cooldown: u64,
    pub score: f64,
    pub score_components: PlannerScoreComponents,
    pub reason: String,
    pub context: HashMap<String, String>,
}

/// Record of a candidate action that failed preconditions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RejectedCandidate {
    pub capability: PlannerCapability,
    pub target: String,
    pub reason: String,
    pub missing_prerequisite: String,
}

/// Output of an adaptive planning evaluation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AdaptivePlan {
    pub investigation_id: Uuid,
    pub selected_action: Option<PlannerActionDef>,
    pub score: f64,
    pub score_components: Option<PlannerScoreComponents>,
    pub reason: String,
    pub alternatives: Vec<PlannerActionDef>,
    pub rejected_candidates: Vec<RejectedCandidate>,
    pub target_archetype: String,
    pub state_metrics: StateSummary,
    pub is_stop: bool,
    pub stop_reason: Option<String>,
}

pub struct PreconditionEngine;

impl PreconditionEngine {
    /// Validates whether the prerequisites for a capability are satisfied by the current state
    pub fn evaluate(
        capability: &PlannerCapability,
        target: &str,
        state: &InvestigationState,
    ) -> Result<(), (String, String)> {
        match capability {
            PlannerCapability::ReconSubdomains => {
                let is_clean = !target.is_empty();
                if !is_clean {
                    return Err((
                        "Root domain or scope hostname is missing".to_string(),
                        "Authorized domain target".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::ResolveDNS => {
                let has_unresolved = !state.unresolved_subdomains().is_empty()
                    || state.hosts.iter().any(|h| h.ip.is_none());
                if !has_unresolved {
                    return Err((
                        "All discovered subdomains and hosts already have DNS resolved".to_string(),
                        "Unresolved subdomains or unmapped hosts".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::DiscoverPorts => {
                let has_host = state.hosts.iter().any(|h| !h.ports_scanned);
                if !has_host && !state.services.is_empty() {
                    return Err((
                        "All resolved hosts already have port coverage".to_string(),
                        "Unscanned resolved host".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::ProbeHTTP => {
                let has_unprobed = !state.unprobed_http_services().is_empty();
                if !has_unprobed {
                    return Err((
                        "No unprobed web services awaiting HTTP metadata".to_string(),
                        "Discovered port or service without HTTP metadata".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::CrawlApplication => {
                let has_live_http = state.services.iter().any(|s| s.http_probed);
                if !has_live_http {
                    return Err((
                        "No live HTTP service detected to crawl".to_string(),
                        "Live HTTP service (port 80/443/8000/8888)".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::CollectHistoricalURLs => {
                let has_live_http = state.services.iter().any(|s| s.http_probed);
                if !has_live_http {
                    return Err((
                        "Web service must be confirmed live before archive mining".to_string(),
                        "Live HTTP service".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::DiscoverDirectories => {
                let has_web = state.services.iter().any(|s| s.http_probed);
                if !has_web {
                    return Err((
                        "Requires live web service before directory fuzzing".to_string(),
                        "Live web application".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::DiscoverParameters => {
                if state.endpoints.is_empty() {
                    return Err((
                        "No live endpoints discovered to analyze for parameters".to_string(),
                        "Discovered endpoints".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::AnalyzeJavaScript => {
                let has_js = state.endpoints.iter().any(|e| e.path.ends_with(".js"));
                if !has_js {
                    return Err((
                        "No JavaScript assets discovered on target to analyze".to_string(),
                        "JavaScript (.js) endpoint assets".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::SearchSecrets => {
                let has_content = !state.endpoints.is_empty();
                if !has_content {
                    return Err((
                        "No crawled endpoints or content assets to inspect for secrets".to_string(),
                        "Crawled application endpoints".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::AnalyzeAPI => {
                let has_api = state.endpoints.iter().any(|e| {
                    e.path.contains("/api") || e.path.contains("/v1") || e.path.contains("/v2")
                }) || state.technologies.iter().any(|t| t.name.to_lowercase().contains("rest") || t.name.to_lowercase().contains("express") || t.name.to_lowercase().contains("fastapi"));
                if !has_api {
                    return Err((
                        "No REST or API endpoint indicators detected on target".to_string(),
                        "API path (/api/, /v1/) or API framework technology".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::AnalyzeGraphQL => {
                let has_gql = state.endpoints.iter().any(|e| {
                    e.path.contains("graphql") || e.path.contains("gql") || e.path.contains("graphiql")
                }) || state.technologies.iter().any(|t| t.name.to_lowercase().contains("graphql") || t.name.to_lowercase().contains("apollo"));
                if !has_gql {
                    return Err((
                        "No GraphQL indicator or endpoint observed on target".to_string(),
                        "GraphQL endpoint or schema indicator".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::RunTechnologyTemplates => {
                if state.technologies.is_empty() {
                    return Err((
                        "No specific technologies discovered to match vulnerability templates".to_string(),
                        "Detected technology or banner".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateXSS => {
                let has_params = state.endpoints.iter().any(|e| !e.params.is_empty());
                if !has_params {
                    return Err((
                        "No endpoints with input parameters found for XSS analysis".to_string(),
                        "Parameterized endpoint".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateSQLi => {
                let has_params = state.endpoints.iter().any(|e| !e.params.is_empty());
                if !has_params {
                    return Err((
                        "No parameterized endpoints found for SQL injection testing".to_string(),
                        "Parameterized endpoint".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateSSRF => {
                let has_url_param = state.endpoints.iter().any(|e| {
                    e.params.iter().any(|p| {
                        let n = p.name.to_lowercase();
                        n == "url" || n == "dest" || n == "target" || n == "redirect" || n == "uri" || n == "link" || n == "next"
                    })
                });
                if !has_url_param {
                    return Err((
                        "No endpoints with URL/redirect parameter indicators found for SSRF testing".to_string(),
                        "Parameter matching url, target, dest, redirect, uri".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateSSTI => {
                let has_template_tech = state.technologies.iter().any(|t| {
                    let n = t.name.to_lowercase();
                    n.contains("jinja") || n.contains("twig") || n.contains("freemarker") || n.contains("handlebars") || n.contains("thymeleaf")
                });
                let has_reflected = state.endpoints.iter().any(|e| e.has_reflected_parameters());
                if !has_template_tech && !has_reflected {
                    return Err((
                        "No template engine technology or reflected input observed for SSTI testing".to_string(),
                        "Template technology or reflected input".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateLFI => {
                let has_file_param = state.endpoints.iter().any(|e| {
                    e.params.iter().any(|p| {
                        let n = p.name.to_lowercase();
                        n == "file" || n == "page" || n == "path" || n == "doc" || n == "include" || n == "view"
                    })
                });
                if !has_file_param {
                    return Err((
                        "No endpoints with file/path parameters found for LFI testing".to_string(),
                        "Parameter matching file, page, path, doc, include".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateJWT => {
                let has_jwt = state.endpoints.iter().any(|e| {
                    e.path.contains("/auth") || e.path.contains("/login") || e.path.contains("/token")
                });
                if !has_jwt {
                    return Err((
                        "No JWT token or token authentication endpoint discovered".to_string(),
                        "JWT token or token endpoint".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::InvestigateAuthorization => {
                let has_auth = state.endpoints.iter().any(|e| {
                    e.path.contains("/api") || e.path.contains("/admin") || e.path.contains("/user") || e.path.contains("/account")
                });
                if !has_auth {
                    return Err((
                        "No authenticated or privileged endpoint boundaries identified for authorization testing".to_string(),
                        "Protected or user/admin endpoint boundary".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::AnalyzeBehavior => {
                let has_live = state.services.iter().any(|s| s.http_probed) || !state.endpoints.is_empty();
                if !has_live {
                    return Err((
                        "Target HTTP service must be live before behavioral analysis".to_string(),
                        "Live HTTP service".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::GenerateThreatModel => {
                let has_surface = !state.hosts.is_empty() || !state.endpoints.is_empty() || !state.services.is_empty();
                let has_active_testing = state.executed_actions.iter().any(|a| a.action_type.contains("crawl") || a.action_type.contains("xss") || a.action_type.contains("probe") || a.tool == "katana" || a.tool == "httpx");
                if !has_surface || !has_active_testing {
                    return Err((
                        "Requires active crawling or live service probing prior to synthesizing threat model".to_string(),
                        "Active application crawl or probe".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::VerifyFinding => {
                let has_unverified = state.findings.iter().any(|f| !f.verified && (f.confidence == FindingConfidence::Firm || f.confidence == FindingConfidence::Confirmed));
                if !has_unverified {
                    return Err((
                        "No high-confidence findings awaiting deterministic verification".to_string(),
                        "Unverified finding with Firm/Confirmed confidence".to_string(),
                    ));
                }
                Ok(())
            }
            PlannerCapability::Stop => Ok(()),
        }
    }
}

pub struct RedundancyEngine;

impl RedundancyEngine {
    /// Evaluates redundancy and cooldown for a capability on a specific target
    pub fn evaluate(
        capability: &PlannerCapability,
        tool: &str,
        target: &str,
        state: &InvestigationState,
    ) -> (bool, f64, String) {
        let matching_executions: Vec<_> = state
            .executed_actions
            .iter()
            .filter(|a| {
                a.tool == tool
                    && (a.target == target
                        || a.target.contains(target)
                        || target.contains(&a.target)
                        || a.action_type == capability.as_str())
            })
            .collect();

        if matching_executions.is_empty() {
            return (false, 0.0, "New unexplored attack surface".to_string());
        }

        // If executed once, check if new attack surface or endpoints arrived since
        let last_exec = matching_executions.last().unwrap();
        let new_endpoints_after = state
            .endpoints
            .iter()
            .filter(|e| e.first_seen > last_exec.executed_at)
            .count();

        if new_endpoints_after > 0 {
            return (
                false,
                5.0,
                format!("Target re-evaluation: {} new endpoints appeared since last run", new_endpoints_after),
            );
        }

        // Action exhausted without new evidence: immediate complete redundancy to suppress duplicate executions
        let count = matching_executions.len();
        let penalty = (count as f64 * 15.0).min(35.0);
        let is_completely_redundant = count >= 1;

        (
            is_completely_redundant,
            penalty,
            format!("Repeated execution (count: {}) without new evidence", count),
        )
    }
}

pub struct AdaptiveScorer;

impl AdaptiveScorer {
    /// Computes explainable score components normalized to 0–100
    pub fn score_action(
        capability: &PlannerCapability,
        tool: &str,
        target: &str,
        archetype: &TargetArchetype,
        state: &InvestigationState,
        redundancy_penalty: f64,
        llm_bonus: f64,
    ) -> (PlannerScoreComponents, String) {
        let mut info_gain = 15.0;
        let mut finding_potential = 10.0;
        let mut target_relevance = 15.0;
        let mut evidence_completeness = 10.0;
        let mut execution_cost = 2.0;
        let mut risk_penalty = 1.0;
        let mut reason = String::new();

        match capability {
            PlannerCapability::VerifyFinding => {
                info_gain = 12.0;
                finding_potential = 35.0;
                target_relevance = 25.0;
                evidence_completeness = 20.0;
                execution_cost = 1.0;
                risk_penalty = 1.0;
                reason = "High-confidence finding candidate requires deterministic verification to confirm".to_string();
            }
            PlannerCapability::InvestigateXSS => {
                let has_reflected = state.endpoints.iter().any(|e| e.has_reflected_parameters());
                info_gain = 20.0;
                finding_potential = if has_reflected { 32.0 } else { 22.0 };
                target_relevance = 22.0;
                evidence_completeness = if has_reflected { 20.0 } else { 12.0 };
                execution_cost = 3.0;
                risk_penalty = 2.0;
                reason = if has_reflected {
                    "Live parameterized endpoint with reflected parameter inputs awaiting XSS payload verification".to_string()
                } else {
                    "Parameterized endpoint input surface eligible for XSS fuzzing".to_string()
                };
            }
            PlannerCapability::InvestigateSQLi => {
                info_gain = 18.0;
                finding_potential = 34.0;
                target_relevance = 20.0;
                evidence_completeness = 14.0;
                execution_cost = 4.0;
                risk_penalty = 3.0;
                reason = "Parameterized endpoint with query parameters eligible for SQL injection audit".to_string();
            }
            PlannerCapability::InvestigateAuthorization => {
                info_gain = 22.0;
                finding_potential = 32.0;
                target_relevance = if *archetype == TargetArchetype::RestApi || *archetype == TargetArchetype::AuthBoundary { 25.0 } else { 18.0 };
                evidence_completeness = 16.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "API/account resource boundary observed; comparative BOLA/IDOR testing eligible".to_string();
            }
            PlannerCapability::InvestigateSSRF => {
                info_gain = 20.0;
                finding_potential = 30.0;
                target_relevance = 20.0;
                evidence_completeness = 15.0;
                execution_cost = 3.0;
                risk_penalty = 2.0;
                reason = "Outbound URL / destination parameter observed eligible for SSRF verification".to_string();
            }
            PlannerCapability::InvestigateSSTI => {
                info_gain = 18.0;
                finding_potential = 28.0;
                target_relevance = 18.0;
                evidence_completeness = 14.0;
                execution_cost = 3.0;
                risk_penalty = 2.0;
                reason = "Template engine technology or reflected input observed eligible for SSTI testing".to_string();
            }
            PlannerCapability::InvestigateLFI => {
                info_gain = 18.0;
                finding_potential = 28.0;
                target_relevance = 18.0;
                evidence_completeness = 14.0;
                execution_cost = 3.0;
                risk_penalty = 2.0;
                reason = "File/path parameter observed eligible for local file inclusion verification".to_string();
            }
            PlannerCapability::InvestigateJWT => {
                info_gain = 18.0;
                finding_potential = 26.0;
                target_relevance = 20.0;
                evidence_completeness = 15.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "JWT token boundary observed eligible for signature and algorithm confusion testing".to_string();
            }
            PlannerCapability::AnalyzeAPI => {
                info_gain = 24.0;
                finding_potential = 18.0;
                target_relevance = if *archetype == TargetArchetype::RestApi { 25.0 } else { 18.0 };
                evidence_completeness = 15.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "REST API paths and versions identified; endpoint schema discovery eligible".to_string();
            }
            PlannerCapability::AnalyzeGraphQL => {
                info_gain = 25.0;
                finding_potential = 22.0;
                target_relevance = if *archetype == TargetArchetype::GraphqlApi { 25.0 } else { 18.0 };
                evidence_completeness = 18.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "GraphQL endpoint observed; introspection and schema field exploration eligible".to_string();
            }
            PlannerCapability::RunTechnologyTemplates => {
                info_gain = 20.0;
                finding_potential = 25.0;
                target_relevance = 20.0;
                evidence_completeness = 18.0;
                execution_cost = 3.0;
                risk_penalty = 2.0;
                let tech_list: Vec<_> = state.technologies.iter().map(|t| t.name.clone()).collect();
                reason = format!("Discovered technologies ({}) match known vulnerability templates", tech_list.join(", "));
            }
            PlannerCapability::CrawlApplication => {
                info_gain = 26.0;
                finding_potential = 12.0;
                target_relevance = 20.0;
                evidence_completeness = 14.0;
                execution_cost = 4.0;
                risk_penalty = 1.0;
                reason = "Live web application identified without full recursive endpoint crawl coverage".to_string();
            }
            PlannerCapability::DiscoverParameters => {
                info_gain = 24.0;
                finding_potential = 16.0;
                target_relevance = 20.0;
                evidence_completeness = 14.0;
                execution_cost = 3.0;
                risk_penalty = 1.0;
                reason = "Live endpoints discovered; deep parameter discovery eligible to expand input surface".to_string();
            }
            PlannerCapability::AnalyzeJavaScript => {
                info_gain = 22.0;
                finding_potential = 14.0;
                target_relevance = 18.0;
                evidence_completeness = 14.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "JavaScript assets present; static endpoint extraction and API route mining eligible".to_string();
            }
            PlannerCapability::SearchSecrets => {
                info_gain = 18.0;
                finding_potential = 22.0;
                target_relevance = 18.0;
                evidence_completeness = 14.0;
                execution_cost = 3.0;
                risk_penalty = 1.0;
                reason = "Client-side code and assets eligible for credential and API token discovery".to_string();
            }
            PlannerCapability::DiscoverDirectories => {
                info_gain = 20.0;
                finding_potential = 14.0;
                target_relevance = 16.0;
                evidence_completeness = 12.0;
                execution_cost = 4.0;
                risk_penalty = 2.0;
                reason = "Interesting path prefixes observed; content and hidden directory fuzzing eligible".to_string();
            }
            PlannerCapability::CollectHistoricalURLs => {
                info_gain = 18.0;
                finding_potential = 12.0;
                target_relevance = 16.0;
                evidence_completeness = 12.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "Web service confirmed; archive mining (Wayback/CommonCrawl) eligible for historical URLs".to_string();
            }
            PlannerCapability::AnalyzeBehavior => {
                info_gain = 18.0;
                finding_potential = 10.0;
                target_relevance = 16.0;
                evidence_completeness = 14.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "Live target accessible; observable WAF detection, latency deltas, and rate-limit audit eligible".to_string();
            }
            PlannerCapability::ProbeHTTP => {
                info_gain = 24.0;
                finding_potential = 8.0;
                target_relevance = 20.0;
                evidence_completeness = 16.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "Open port discovered; HTTP metadata probing required to identify web services".to_string();
            }
            PlannerCapability::DiscoverPorts => {
                info_gain = 24.0;
                finding_potential = 6.0;
                target_relevance = 20.0;
                evidence_completeness = 14.0;
                execution_cost = 3.0;
                risk_penalty = 2.0;
                reason = "Resolved host observed without port scan coverage; discovering active network services".to_string();
            }
            PlannerCapability::ResolveDNS => {
                info_gain = 22.0;
                finding_potential = 4.0;
                target_relevance = 20.0;
                evidence_completeness = 14.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "Discovered subdomains awaiting DNS resolution to establish reachable IP addresses".to_string();
            }
            PlannerCapability::ReconSubdomains => {
                info_gain = 22.0;
                finding_potential = 4.0;
                target_relevance = 18.0;
                evidence_completeness = 12.0;
                execution_cost = 2.0;
                risk_penalty = 1.0;
                reason = "Root target domain observed without comprehensive passive subdomain enumeration".to_string();
            }
            PlannerCapability::GenerateThreatModel => {
                info_gain = 16.0;
                finding_potential = 12.0;
                target_relevance = 18.0;
                evidence_completeness = 16.0;
                execution_cost = 1.0;
                risk_penalty = 1.0;
                reason = "Attack surface baseline established; synthesizing STRIDE threat model".to_string();
            }
            PlannerCapability::Stop => {
                info_gain = 0.0;
                finding_potential = 0.0;
                target_relevance = 0.0;
                evidence_completeness = 0.0;
                execution_cost = 0.0;
                risk_penalty = 0.0;
                reason = "Investigation stopping condition reached".to_string();
            }
        }

        // --- EMPIRICAL FEEDBACK LOOP RULES ---
        // 1. Technology + parameterized endpoint affinity:
        // Backends (PHP, WordPress, Node, Express, Python) with parameterized inputs
        // historically yield higher vulnerability rates.
        let has_backend_tech = state.technologies.iter().any(|t| {
            let n = t.name.to_lowercase();
            n.contains("php")
                || n.contains("wordpress")
                || n.contains("node")
                || n.contains("express")
                || n.contains("python")
                || n.contains("flask")
                || n.contains("django")
        });
        let has_parameters = state.endpoints.iter().any(|e| !e.params.is_empty());

        if has_backend_tech && has_parameters {
            match capability {
                PlannerCapability::InvestigateXSS => {
                    finding_potential += 6.0;
                    target_relevance += 4.0;
                    reason = format!("{}; backend technology & parameterized input surface statistically increases XSS yield", reason);
                }
                PlannerCapability::InvestigateSQLi => {
                    finding_potential += 6.0;
                    target_relevance += 4.0;
                    reason = format!("{}; backend technology & query parameters statistically increases SQLi yield", reason);
                }
                _ => {}
            }
        }

        // 2. Static asset / zero yield penalty:
        // Directory fuzzing and parameter discovery on static assets (.png, .css, .ico, etc.)
        // have repeatedly zero yield.
        let is_static_asset = target.ends_with(".png")
            || target.ends_with(".jpg")
            || target.ends_with(".jpeg")
            || target.ends_with(".css")
            || target.ends_with(".ico")
            || target.ends_with(".svg")
            || target.ends_with(".woff")
            || target.ends_with(".woff2");

        if is_static_asset {
            match capability {
                PlannerCapability::DiscoverDirectories | PlannerCapability::DiscoverParameters => {
                    finding_potential = if finding_potential > 10.0 { finding_potential - 10.0 } else { 0.0 };
                    execution_cost += 6.0;
                    risk_penalty += 4.0;
                    reason = format!("{}; static asset target historically has zero yield, priority decreased", reason);
                }
                _ => {}
            }
        }

        // 3. Failed execution outcome penalty:
        // If a prior execution of this tool on this target failed, penalize to prioritize
        // alternate candidate attack vectors.
        let prior_failure = state
            .executed_actions
            .iter()
            .any(|a| a.tool == tool && a.target == target && !a.success);

        if prior_failure {
            execution_cost += 8.0;
            risk_penalty += 8.0;
            reason = format!("{}; prior execution failed, penalized to prioritize alternative actions", reason);
        }

        // 4. Graph-driven unexplored surface boost:
        // Prioritize candidates targeting unexplored portions of the attack surface graph.
        match capability {
            PlannerCapability::InvestigateXSS => {
                if state.endpoints.iter().any(|e| e.has_reflected_parameters()) {
                    info_gain += 10.0;
                    finding_potential += 8.0;
                    reason = format!("{}; attack surface graph highlights unexplored reflected parameter", reason);
                }
            }
            PlannerCapability::CrawlApplication => {
                let has_unexplored_web = state.services.iter().any(|s| s.http_probed && state.endpoints.is_empty());
                if has_unexplored_web {
                    info_gain += 12.0;
                    target_relevance += 8.0;
                    reason = format!("{}; attack surface graph highlights unexplored live HTTP service", reason);
                }
            }
            PlannerCapability::ResolveDNS => {
                let has_unresolved = state.subdomains.iter().any(|s| !s.dns_resolved);
                if has_unresolved {
                    info_gain += 10.0;
                    reason = format!("{}; attack surface graph highlights unexplored unmapped subdomains", reason);
                }
            }
            _ => {}
        }

        let components = PlannerScoreComponents {
            information_gain: info_gain,
            finding_potential,
            target_relevance,
            evidence_completeness,
            execution_cost,
            risk_penalty,
            redundancy_penalty,
            advisory_llm_bonus: llm_bonus.clamp(0.0, 10.0),
        };

        (components, reason)
    }
}

pub struct AdaptivePlanner;

impl AdaptivePlanner {
    /// Generates candidate action definitions for an investigation state
    pub fn plan(
        investigation_id: Uuid,
        state: &InvestigationState,
        advisory_llm_boosts: Option<&HashMap<String, f64>>,
    ) -> AdaptivePlan {
        let state_metrics = StateSummary::from_state(state);
        let profile = TargetProfiler::profile(investigation_id, state);
        let target_archetype_str = profile.archetype.as_str().to_string();

        let all_capabilities = [
            PlannerCapability::VerifyFinding,
            PlannerCapability::InvestigateXSS,
            PlannerCapability::InvestigateSQLi,
            PlannerCapability::InvestigateAuthorization,
            PlannerCapability::InvestigateSSRF,
            PlannerCapability::InvestigateSSTI,
            PlannerCapability::InvestigateLFI,
            PlannerCapability::InvestigateJWT,
            PlannerCapability::AnalyzeAPI,
            PlannerCapability::AnalyzeGraphQL,
            PlannerCapability::RunTechnologyTemplates,
            PlannerCapability::CrawlApplication,
            PlannerCapability::DiscoverParameters,
            PlannerCapability::AnalyzeJavaScript,
            PlannerCapability::SearchSecrets,
            PlannerCapability::DiscoverDirectories,
            PlannerCapability::CollectHistoricalURLs,
            PlannerCapability::AnalyzeBehavior,
            PlannerCapability::ProbeHTTP,
            PlannerCapability::DiscoverPorts,
            PlannerCapability::ResolveDNS,
            PlannerCapability::ReconSubdomains,
            PlannerCapability::GenerateThreatModel,
        ];

        let mut eligible_actions = Vec::new();
        let mut rejected_candidates = Vec::new();

        for cap in all_capabilities {
            // Determine representative target
            let target = Self::resolve_target_for_capability(&cap, state);

            // Precondition evaluation
            if let Err((reason, missing_prereq)) = PreconditionEngine::evaluate(&cap, &target, state) {
                rejected_candidates.push(RejectedCandidate {
                    capability: cap,
                    target: target.clone(),
                    reason,
                    missing_prerequisite: missing_prereq,
                });
                continue;
            }

            // Scope gate evaluation
            if !state.scope.is_allowed(&target) {
                rejected_candidates.push(RejectedCandidate {
                    capability: cap,
                    target: target.clone(),
                    reason: "Scope boundary rejection: Target is out-of-scope".to_string(),
                    missing_prerequisite: "Explicit scope authorization".to_string(),
                });
                continue;
            }

            // Redundancy evaluation
            let tool = cap.default_tool();
            let (is_redundant, redundancy_penalty, red_reason) =
                RedundancyEngine::evaluate(&cap, tool, &target, state);

            if is_redundant {
                rejected_candidates.push(RejectedCandidate {
                    capability: cap,
                    target: target.clone(),
                    reason: format!("Redundant action excluded: {}", red_reason),
                    missing_prerequisite: "New evidence or expired cooldown".to_string(),
                });
                continue;
            }

            // Advisory LLM bonus
            let llm_bonus = advisory_llm_boosts
                .and_then(|m| m.get(cap.as_str()).or_else(|| m.get(tool)).copied())
                .unwrap_or(0.0);

            // Action scoring
            let (score_components, reason) = AdaptiveScorer::score_action(
                &cap,
                tool,
                &target,
                &profile.archetype,
                state,
                redundancy_penalty,
                llm_bonus,
            );
            let score = score_components.total();

            let action_id = format!("{}:{}:{}", cap.as_str(), tool, target);

            let (req_desc, prod_desc, cost_desc, risk_desc) = Self::describe_capability(&cap);

            eligible_actions.push(PlannerActionDef {
                action_id,
                capability: cap,
                tool: tool.to_string(),
                target,
                required_state: req_desc.to_string(),
                produced_state: prod_desc.to_string(),
                required_tools: vec![tool.to_string()],
                risk_level: risk_desc.to_string(),
                estimated_cost: cost_desc.to_string(),
                expected_information_gain: score_components.information_gain,
                expected_finding_value: score_components.finding_potential,
                cooldown: 300,
                score,
                score_components,
                reason,
                context: HashMap::new(),
            });
        }

        // Sort descending by score
        eligible_actions.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        if eligible_actions.is_empty() {
            return AdaptivePlan {
                investigation_id,
                selected_action: None,
                score: 0.0,
                score_components: None,
                reason: "No legal actions remaining within scope, prerequisites, and budget".to_string(),
                alternatives: Vec::new(),
                rejected_candidates,
                target_archetype: target_archetype_str,
                state_metrics,
                is_stop: true,
                stop_reason: Some("No legal actions remaining".to_string()),
            };
        }

        let selected = eligible_actions[0].clone();
        let alternatives = if eligible_actions.len() > 1 {
            eligible_actions[1..].iter().take(5).cloned().collect()
        } else {
            Vec::new()
        };

        AdaptivePlan {
            investigation_id,
            selected_action: Some(selected.clone()),
            score: selected.score,
            score_components: Some(selected.score_components.clone()),
            reason: selected.reason.clone(),
            alternatives,
            rejected_candidates,
            target_archetype: target_archetype_str,
            state_metrics,
            is_stop: false,
            stop_reason: None,
        }
    }

    /// Resolves the optimal target string for a capability given the current state
    fn resolve_target_for_capability(cap: &PlannerCapability, state: &InvestigationState) -> String {
        match cap {
            PlannerCapability::VerifyFinding => state
                .findings
                .iter()
                .find(|f| !f.verified)
                .map(|f| f.target.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::InvestigateXSS => state
                .endpoints
                .iter()
                .find(|e| e.has_reflected_parameters())
                .or_else(|| state.endpoints.iter().find(|e| !e.params.is_empty()))
                .map(|e| e.url.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::InvestigateSQLi => state
                .endpoints
                .iter()
                .find(|e| !e.params.is_empty())
                .map(|e| e.url.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::InvestigateSSRF => state
                .endpoints
                .iter()
                .find(|e| {
                    e.params.iter().any(|p| {
                        let n = p.name.to_lowercase();
                        n == "url" || n == "dest" || n == "target" || n == "redirect"
                    })
                })
                .map(|e| e.url.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::InvestigateAuthorization => state
                .endpoints
                .iter()
                .find(|e| e.path.contains("/api") || e.path.contains("/admin") || e.path.contains("/user"))
                .map(|e| e.url.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::AnalyzeAPI => state
                .endpoints
                .iter()
                .find(|e| e.path.contains("/api") || e.path.contains("/v1"))
                .map(|e| e.url.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::AnalyzeGraphQL => state
                .endpoints
                .iter()
                .find(|e| e.path.contains("graphql"))
                .map(|e| e.url.clone())
                .unwrap_or_else(|| format!("{}/graphql", state.target.trim_end_matches('/'))),
            PlannerCapability::CrawlApplication => state
                .services
                .iter()
                .find(|s| s.http_probed)
                .map(|s| format!("http://{}:{}", s.host, s.port))
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::ProbeHTTP => state
                .unprobed_http_services()
                .first()
                .map(|s| format!("{}:{}", s.host, s.port))
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::DiscoverPorts => state
                .unscanned_hosts()
                .first()
                .map(|h| h.host.clone())
                .unwrap_or_else(|| state.target.clone()),
            PlannerCapability::ResolveDNS => state
                .unresolved_subdomains()
                .first()
                .map(|s| s.subdomain.clone())
                .unwrap_or_else(|| state.target.clone()),
            _ => state.target.clone(),
        }
    }

    fn describe_capability(cap: &PlannerCapability) -> (&'static str, &'static str, &'static str, &'static str) {
        match cap {
            PlannerCapability::VerifyFinding => ("Unverified finding candidate", "Verified / rejected finding confirmation", "Low", "Low"),
            PlannerCapability::InvestigateXSS => ("Parameterized endpoint", "XSS vulnerability proof / candidate", "Medium", "Medium"),
            PlannerCapability::InvestigateSQLi => ("Parameterized endpoint", "SQL injection candidate", "High", "High"),
            PlannerCapability::InvestigateAuthorization => ("Authenticated endpoint boundary", "BOLA / IDOR differential access proof", "Low", "Low"),
            PlannerCapability::InvestigateSSRF => ("URL/redirect parameter", "Outbound network interaction proof", "Medium", "Medium"),
            PlannerCapability::InvestigateSSTI => ("Template reflection", "Remote code execution candidate", "Medium", "Medium"),
            PlannerCapability::InvestigateLFI => ("File path parameter", "Arbitrary file disclosure proof", "Medium", "Medium"),
            PlannerCapability::InvestigateJWT => ("JWT token boundary", "Token forgery / key confusion finding", "Low", "Low"),
            PlannerCapability::AnalyzeAPI => ("API routes / versions", "API schema and method attack surface", "Low", "Low"),
            PlannerCapability::AnalyzeGraphQL => ("GraphQL endpoint", "Introspection schema and field catalog", "Low", "Low"),
            PlannerCapability::RunTechnologyTemplates => ("Identified software stack", "CVE template match findings", "Medium", "Medium"),
            PlannerCapability::CrawlApplication => ("Live HTTP service", "Discovered endpoints and form parameters", "Medium", "Low"),
            PlannerCapability::DiscoverParameters => ("Live endpoints", "Discovered hidden parameter inputs", "Medium", "Low"),
            PlannerCapability::AnalyzeJavaScript => ("JavaScript assets", "Extracted REST routes and tokens", "Low", "Low"),
            PlannerCapability::SearchSecrets => ("Crawled web assets", "Secret / credential candidates", "Medium", "Low"),
            PlannerCapability::DiscoverDirectories => ("Live web service", "Exposed backup files and admin paths", "Medium", "Medium"),
            PlannerCapability::CollectHistoricalURLs => ("Confirmed web target", "Historical URLs from public archives", "Low", "Low"),
            PlannerCapability::AnalyzeBehavior => ("Reachable web application", "WAF signature and rate limit profile", "Low", "Low"),
            PlannerCapability::ProbeHTTP => ("Open network port", "HTTP response status and tech banner", "Low", "Low"),
            PlannerCapability::DiscoverPorts => ("Resolved hostname", "Open TCP service ports", "Medium", "Low"),
            PlannerCapability::ResolveDNS => ("Discovered subdomains", "Active IP addresses and CNAME records", "Low", "Low"),
            PlannerCapability::ReconSubdomains => ("Root domain in scope", "Discovered subdomain catalog", "Low", "Low"),
            PlannerCapability::GenerateThreatModel => ("Attack surface baseline", "STRIDE threat matrix", "Low", "Low"),
            PlannerCapability::Stop => ("Exhausted or complete state", "Investigation termination", "Low", "Low"),
        }
    }
}
