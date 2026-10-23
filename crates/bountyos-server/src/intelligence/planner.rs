//! Investigation Intelligence Planner
//!
//! Generates and prioritizes next actions based on deterministic rules,
//! attack surface state, coverage gaps, and epistemic uncertainty.
//!
//! Produces explainable plans with recommended actions, alternatives,
//! identified coverage gaps, and explicit stop conditions.

use crate::intelligence::actions::{ActionType, CandidateAction, PlannedAction};
use crate::intelligence::budgets::BudgetManager;
use crate::intelligence::coverage::{CoverageGap, CoverageModel};
use crate::intelligence::scoring::ActionScorer;
use crate::intelligence::state::{InvestigationState, StopReason};
use crate::intelligence::stopping::StoppingChecker;
use serde::{Deserialize, Serialize};

/// Output plan of the intelligence planner
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvestigationPlan {
    pub recommended_action: Option<PlannedAction>,
    pub alternatives: Vec<PlannedAction>,
    pub coverage_gaps: Vec<CoverageGap>,
    pub stop_reason: Option<StopReason>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strategic_summary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_profile: Option<crate::models::target_profile::TargetProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_decision: Option<crate::intelligence::policies::PolicyDecision>,
}

pub struct IntelligencePlanner;

impl IntelligencePlanner {
    /// Plan the next investigation step given current state (baseline deterministic)
    pub fn plan(state: &InvestigationState) -> InvestigationPlan {
        Self::plan_with_history(state, None)
    }

    /// Plan the next investigation step with optional empirical historical tool statistics (v0.4 Adaptive Scoring)
    pub fn plan_with_history(
        state: &InvestigationState,
        history: Option<&std::collections::HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>,
    ) -> InvestigationPlan {
        Self::plan_strategic(state, history, None)
    }

    /// Plan the next investigation step combining state, empirical historical stats, and strategic VulnLLM prioritization (v0.5)
    pub fn plan_strategic(
        state: &InvestigationState,
        history: Option<&std::collections::HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>,
        prioritization: Option<&crate::intelligence::llm::prioritization::StrategicPrioritization>,
    ) -> InvestigationPlan {
        Self::plan_experience(state, history, prioritization, None, None)
    }

    /// Plan the next investigation step with Global Experience Store, Target Archetype classification,
    /// cross-run waste pruning, and exploration vs. exploitation (v0.6)
    pub fn plan_experience(
        state: &InvestigationState,
        history: Option<&std::collections::HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>,
        prioritization: Option<&crate::intelligence::llm::prioritization::StrategicPrioritization>,
        experience: Option<&[crate::models::experience::ExperienceAction]>,
        archetype: Option<&crate::intelligence::archetype::ArchetypeClassification>,
    ) -> InvestigationPlan {
        Self::plan_with_policy(state, history, prioritization, experience, archetype, None)
    }

    /// Plan the next investigation step with Target-Specific Investigation Policies (v0.7)
    pub fn plan_with_policy(
        state: &InvestigationState,
        history: Option<&std::collections::HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>,
        prioritization: Option<&crate::intelligence::llm::prioritization::StrategicPrioritization>,
        experience: Option<&[crate::models::experience::ExperienceAction]>,
        _archetype: Option<&crate::intelligence::archetype::ArchetypeClassification>,
        profile_override: Option<&crate::models::target_profile::TargetProfile>,
    ) -> InvestigationPlan {
        // Strategy A: Fixed Pipeline (subfinder -> naabu -> httpx -> katana -> nuclei)
        if state.profile == crate::intelligence::state::InvestigationProfile::Fixed {
            let fixed_tool_order = ["subfinder", "naabu", "httpx", "katana", "nuclei"];
            let executed = state.executed_actions.len();
            if executed < fixed_tool_order.len() {
                let tool = fixed_tool_order[executed];
                let target = state.target.clone();
                let action_type = match tool {
                    "subfinder" => ActionType::SubdomainEnumeration,
                    "naabu" => ActionType::PortScan,
                    "httpx" => ActionType::HttpProbe,
                    "katana" => ActionType::EndpointCrawl,
                    "nuclei" => ActionType::TechVulnerabilityScan,
                    _ => ActionType::Stop,
                };
                let action = PlannedAction::new(
                    action_type,
                    tool,
                    target,
                    "Fixed pipeline execution sequence (v0.1 Strategy A)",
                    0.5,
                );
                return InvestigationPlan {
                    recommended_action: Some(action),
                    alternatives: Vec::new(),
                    coverage_gaps: Vec::new(),
                    stop_reason: None,
                    strategic_summary: None,
                    target_profile: None,
                    policy_name: Some("Fixed Pipeline Policy".to_string()),
                    policy_decision: None,
                };
            } else {
                return InvestigationPlan {
                    recommended_action: None,
                    alternatives: Vec::new(),
                    coverage_gaps: Vec::new(),
                    stop_reason: Some(StopReason::NoLegalActions),
                    strategic_summary: None,
                    target_profile: None,
                    policy_name: Some("Fixed Pipeline Policy".to_string()),
                    policy_decision: None,
                };
            }
        }

        // 1. Target Profile generation from observed evidence (v0.7)
        let fallback_profile;
        let target_profile = match profile_override {
            Some(p) => p,
            None => {
                fallback_profile = crate::intelligence::profiler::TargetProfiler::profile(uuid::Uuid::nil(), state);
                &fallback_profile
            }
        };

        // 2. Select Investigation Policy matching the target profile archetype
        let policy = crate::intelligence::policies::PolicyRegistry::get_policy_for(target_profile.archetype);

        // 3. Assess coverage gaps
        let coverage_report = CoverageModel::assess(state);
        let coverage_gaps = coverage_report.gaps;

        // 4. Generate candidate actions: baseline state candidates + policy-specific candidate actions (v0.7)
        let mut candidates = Self::generate_candidates(state);
        let is_policy_enabled = state.profile != crate::intelligence::state::InvestigationProfile::Standard;
        if is_policy_enabled {
            let policy_candidates = policy.generate_candidate_actions(state, target_profile);
            candidates.extend(policy_candidates);
        }

        // Deduplicate candidates by (action_type, tool, target)
        let mut seen = std::collections::HashSet::new();
        candidates.retain(|c| seen.insert((c.action_type, c.tool.clone(), c.target.clone())));

        // 5. Filter candidates by scope, execution history, and budget (Scope gate remains mandatory)
        candidates.retain(|cand| {
            if !state.is_in_scope(&cand.target) {
                return false;
            }
            if state.has_executed_tool_on_target(&cand.tool, &cand.target) {
                return false;
            }
            if BudgetManager::check(state, &cand.tool, cand.risk).is_err() {
                return false;
            }
            true
        });

        // Compute baseline prior score for each candidate
        for cand in candidates.iter_mut() {
            cand.score = ActionScorer::compute(cand.info_gain, cand.relevance, cand.confidence, cand.cost, cand.risk);
        }

        // 6. Apply Target Investigation Policy adjustments (v0.7)
        // Generic/Standard baseline does not apply target-specific policy weights (enables benchmark comparison)
        if is_policy_enabled {
            policy.adjust_candidate_actions(target_profile, &mut candidates);
        }

        // 7. Score candidates: Policy weighting + adaptive empirical stats + bounded VulnLLM strategic boost + global experience
        let is_adaptive = state.profile == crate::intelligence::state::InvestigationProfile::Adaptive
            || state.profile == crate::intelligence::state::InvestigationProfile::Strategic
            || state.profile == crate::intelligence::state::InvestigationProfile::Policy
            || history.is_some()
            || experience.is_some();

        let mut scored_actions: Vec<PlannedAction> = candidates
            .into_iter()
            .map(|c| {
                let prior_score = c.score;
                let (empirical_score, empirical_note) = if is_adaptive {
                    crate::intelligence::action_value::ActionValueModel::estimate_adaptive_score(
                        prior_score,
                        &c.tool,
                        history,
                    )
                } else {
                    (prior_score, String::new())
                };

                let llm_boost = if let Some(prio) = prioritization {
                    let tool_target = format!("{}:{}", c.tool.to_lowercase(), c.target.to_lowercase());
                    let act_target = format!("{}:{}", c.action_type.as_str().to_lowercase(), c.target.to_lowercase());
                    prio.action_boosts
                        .get(&tool_target)
                        .or_else(|| prio.action_boosts.get(&act_target))
                        .copied()
                        .unwrap_or(0.0)
                } else {
                    0.0
                };

                let (composite_score, score_note) = if llm_boost > 0.001 {
                    crate::intelligence::llm::prioritization::StrategicPrioritizer::compute_composite_score(
                        prior_score,
                        empirical_score,
                        llm_boost,
                    )
                } else {
                    (empirical_score, empirical_note)
                };

                // Cross-Investigation Experience Scoring & Pruning (v0.6)
                let (final_score, experience_note) = if let Some(exp_list) = experience {
                    let arch_str = target_profile.archetype.as_str();
                    let match_exp = exp_list.iter().find(|e| {
                        e.archetype == arch_str && e.tool == c.tool && e.action_type == c.action_type.as_str()
                    }).or_else(|| {
                        exp_list.iter().find(|e| {
                            e.archetype == "*" && e.tool == c.tool && e.action_type == c.action_type.as_str()
                        })
                    }).or_else(|| {
                        exp_list.iter().find(|e| e.tool == c.tool)
                    });

                    let eval = crate::intelligence::experience::GlobalExperienceStore::evaluate_action(
                        match_exp,
                        composite_score,
                        0.15,
                    );

                    let note = if eval.is_pruned {
                        format!("LOW_VALUE PRUNED: {}", eval.reason)
                    } else if eval.is_exploration {
                        format!("EXPLORATION: {}", eval.reason)
                    } else if eval.penalty > 0.0 {
                        format!("EXPERIENCE PENALTY: {}", eval.reason)
                    } else {
                        eval.reason
                    };

                    (eval.experience_score, note)
                } else {
                    (composite_score, String::new())
                };

                let mut reason_parts = vec![c.reason.clone()];
                if !score_note.is_empty() {
                    reason_parts.push(score_note);
                }
                if !experience_note.is_empty() {
                    reason_parts.push(experience_note);
                }
                let full_reason = reason_parts.join(" | ");

                // Policy Provenance (v0.7)
                let policy_reasons = policy.policy_reasons(&c, target_profile);
                let evidence_refs = policy.evidence_refs(&c, target_profile);

                let mut planned = PlannedAction::new(c.action_type, c.tool, c.target, full_reason, final_score)
                    .with_provenance(policy_reasons, evidence_refs);
                planned.context = c.context;
                planned
            })
            .collect();

        // Sort descending by score
        scored_actions.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        // Evaluate stopping conditions
        let best_score = scored_actions.first().map(|a| a.score);
        let stop_reason = StoppingChecker::evaluate(state, best_score, None);
        let strategic_summary = prioritization.map(|p| p.strategic_summary.clone());

        let policy_name_str = policy.name().to_string();

        if let Some(reason) = stop_reason {
            let reason_desc = match &reason {
                StopReason::NoLegalActions => "No legal actions remaining within scope and budget".to_string(),
                StopReason::BudgetExhausted(s) => format!("Budget exhausted: {}", s),
                StopReason::CoverageSufficient => "Attack surface coverage sufficient".to_string(),
                StopReason::BestActionScoreTooLow { score, threshold } => {
                    format!("Best action score ({:.2}) below threshold ({:.2})", score, threshold)
                }
                StopReason::InvestigationCancelled(s) => format!("Cancelled: {}", s),
                StopReason::MaxFindingsReached(n) => format!("Maximum findings reached ({})", n),
            };

            let stop_action = PlannedAction::stop(reason_desc);
            let policy_decision = Some(stop_action.to_policy_decision(&policy_name_str));

            return InvestigationPlan {
                recommended_action: Some(stop_action),
                alternatives: Vec::new(),
                coverage_gaps,
                stop_reason: Some(reason),
                strategic_summary,
                target_profile: Some(target_profile.clone()),
                policy_name: Some(policy_name_str),
                policy_decision,
            };
        }

        let recommended_action = scored_actions.first().cloned();
        let alternatives = if scored_actions.len() > 1 {
            scored_actions[1..].to_vec()
        } else {
            Vec::new()
        };

        let policy_decision = recommended_action.as_ref().map(|a| a.to_policy_decision(&policy_name_str));

        InvestigationPlan {
            recommended_action,
            alternatives,
            coverage_gaps,
            stop_reason: None,
            strategic_summary,
            target_profile: Some(target_profile.clone()),
            policy_name: Some(policy_name_str),
            policy_decision,
        }
    }

    /// Deterministic candidate action generation based on rule pipeline
    fn generate_candidates(state: &InvestigationState) -> Vec<CandidateAction> {
        let mut candidates = Vec::new();

        // Rule 1: High-confidence finding -> verification
        for finding in state.unverified_high_confidence_findings() {
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::FindingVerification);
            candidates.push(
                CandidateAction::new(
                    ActionType::FindingVerification,
                    "verification",
                    &finding.target,
                    format!("High-confidence finding '{}' requiring deterministic verification", finding.title),
                )
                .with_metrics(ig, r, c, cost, risk)
                .with_context("finding_id", &finding.id)
                .with_context("finding_title", &finding.title),
            );
        }

        // Rule 2: Parameterized endpoint + reflection -> dalfox (XSS analysis)
        for (ep, param) in state.endpoints_with_reflected_params() {
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::XssAnalysis);
            candidates.push(
                CandidateAction::new(
                    ActionType::XssAnalysis,
                    "dalfox",
                    &ep.url,
                    format!("Parameterized endpoint with reflected parameter '{}'", param.name),
                )
                .with_metrics(ig, r, c, cost, risk)
                .with_context("param_name", &param.name)
                .with_context("param_location", format!("{:?}", param.location)),
            );
        }

        // Rule 3: Technology identified -> targeted nuclei
        if !state.technologies.is_empty() {
            let tech_names: Vec<String> = state
                .technologies
                .iter()
                .map(|t| {
                    if let Some(ref v) = t.version {
                        format!("{} {}", t.name, v)
                    } else {
                        t.name.clone()
                    }
                })
                .collect();
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::TechVulnerabilityScan);
            candidates.push(
                CandidateAction::new(
                    ActionType::TechVulnerabilityScan,
                    "nuclei",
                    &state.target,
                    format!("Discovered technologies ({}) with matching vulnerability templates", tech_names.join(", ")),
                )
                .with_metrics(ig, r, c, cost, risk)
                .with_context("technologies", tech_names.join(", ")),
            );
        }

        // Rule 4: Interesting paths with incomplete content coverage -> ffuf
        for ep in &state.endpoints {
            if (ep.path.contains("/api") || ep.path.contains("/admin") || ep.path.contains("/v1") || ep.path.contains("/config"))
                && !ep.fuzzed
            {
                let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::PathFuzz);
                candidates.push(
                    CandidateAction::new(
                        ActionType::PathFuzz,
                        "ffuf",
                        &ep.url,
                        format!("Interesting path '{}' with incomplete content coverage", ep.path),
                    )
                    .with_metrics(ig, r, c, cost, risk)
                    .with_context("path", &ep.path),
                );
            }
        }

        // Rule 5: Historical coverage missing -> gau / waybackurls
        for svc in state.services.iter().filter(|s| s.http_probed) {
            let svc_target = format!("{}:{}", svc.host, svc.port);
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::HistoricalUrls);
            candidates.push(
                CandidateAction::new(
                    ActionType::HistoricalUrls,
                    "gau",
                    svc_target,
                    "Historical URL archive coverage absent for web service",
                )
                .with_metrics(ig, r, c, cost, risk),
            );
        }

        // Rule 6: Live web application without endpoint coverage -> katana
        for svc in state.services.iter().filter(|s| s.http_probed) {
            let has_endpoints = state.endpoints.iter().any(|e| e.host == svc.host && e.port == svc.port);
            if !has_endpoints {
                let svc_url = format!("http://{}:{}", svc.host, svc.port);
                let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::EndpointCrawl);
                candidates.push(
                    CandidateAction::new(
                        ActionType::EndpointCrawl,
                        "katana",
                        svc_url,
                        "Live web application without endpoint coverage",
                    )
                    .with_metrics(ig, r, c, cost, risk),
                );
            }
        }

        // Rule 7: Discovered service without HTTP metadata -> httpx
        for svc in state.unprobed_http_services() {
            let target = format!("{}:{}", svc.host, svc.port);
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::HttpProbe);
            candidates.push(
                CandidateAction::new(
                    ActionType::HttpProbe,
                    "httpx",
                    target,
                    format!("Discovered service on port {} without HTTP metadata", svc.port),
                )
                .with_metrics(ig, r, c, cost, risk)
                .with_context("port", svc.port.to_string()),
            );
        }

        // Rule 8: Resolved hosts without port coverage -> naabu
        for host in state.unscanned_hosts() {
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::PortScan);
            candidates.push(
                CandidateAction::new(
                    ActionType::PortScan,
                    "naabu",
                    &host.host,
                    format!("Resolved host '{}' without port coverage", host.host),
                )
                .with_metrics(ig, r, c, cost, risk),
            );
        }

        // Rule 9: New subdomains without DNS resolution -> dnsx
        for sub in state.unresolved_subdomains() {
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::DnsResolution);
            candidates.push(
                CandidateAction::new(
                    ActionType::DnsResolution,
                    "dnsx",
                    &sub.subdomain,
                    format!("New subdomain '{}' without DNS resolution", sub.subdomain),
                )
                .with_metrics(ig, r, c, cost, risk),
            );
        }

        // Rule 10: No subdomains discovered yet -> subfinder
        if state.subdomains.is_empty() {
            let (ig, r, c, cost, risk) = ActionScorer::default_metrics(ActionType::SubdomainEnumeration);
            candidates.push(
                CandidateAction::new(
                    ActionType::SubdomainEnumeration,
                    "subfinder",
                    &state.target,
                    "Root domain without subdomain coverage",
                )
                .with_metrics(ig, r, c, cost, risk),
            );
        }

        candidates
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{
        DiscoveredEndpoint, DiscoveredParam, DiscoveredTechnology, FindingConfidence, FindingSeverity,
        InvestigationProfile, ParamLocation, ScopeBoundary, StateFinding,
    };

    #[test]
    fn test_case_1_empty_target_selects_subfinder() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true; // prevent naabu on root host

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::SubdomainEnumeration);
        assert_eq!(action.tool, "subfinder");
        assert_eq!(action.target, "target.local");
    }

    #[test]
    fn test_case_2_subdomains_discovered_selects_dnsx() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        scope.wildcards.push("*.target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.add_subdomain("api.target.local", "subfinder");

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::DnsResolution);
        assert_eq!(action.tool, "dnsx");
        assert_eq!(action.target, "api.target.local");
    }

    #[test]
    fn test_case_3_dns_resolved_selects_naabu() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        scope.wildcards.push("*.target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.add_subdomain("api.target.local", "subfinder");
        state.mark_subdomain_dns_resolved("api.target.local", vec!["192.168.1.10".to_string()], vec![]);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::PortScan);
        assert_eq!(action.tool, "naabu");
    }

    #[test]
    fn test_case_4_port_discovered_selects_httpx() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.add_service("target.local", 443, "tcp", Some("https".to_string()), None);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::HttpProbe);
        assert_eq!(action.tool, "httpx");
        assert_eq!(action.target, "target.local:443");
    }

    #[test]
    fn test_case_5_live_app_no_endpoints_selects_katana() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.add_service("target.local", 8888, "tcp", Some("http".to_string()), None);
        state.mark_service_http_probed("target.local", 8888);
        state.record_executed_action("http_probe", "httpx", "target.local:8888", 100, true, None);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::EndpointCrawl);
        assert_eq!(action.tool, "katana");
        assert_eq!(action.target, "http://target.local:8888");
    }

    #[test]
    fn test_case_7_parameterized_reflected_endpoint_selects_dalfox() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.add_service("target.local", 8888, "tcp", Some("http".to_string()), None);
        state.mark_service_http_probed("target.local", 8888);
        state.record_executed_action("http_probe", "httpx", "target.local:8888", 100, true, None);

        let mut ep = DiscoveredEndpoint::new(
            "http://target.local:8888/search?q=test",
            "target.local",
            8888,
            "/search?q=test",
        );
        ep.params.push(DiscoveredParam {
            name: "q".to_string(),
            location: ParamLocation::Query,
            reflected: true,
            reflection_context: Some("body".to_string()),
            tested_for_xss: false,
            tested_for_sqli: false,
        });
        state.add_endpoint(ep);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::XssAnalysis);
        assert_eq!(action.tool, "dalfox");
        assert_eq!(action.target, "http://target.local:8888/search?q=test");
        assert!(action.score >= 0.85);
    }

    #[test]
    fn test_case_8_technology_identified_selects_nuclei() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.add_technology(DiscoveredTechnology {
            name: "Apache".to_string(),
            version: Some("2.4.41".to_string()),
            cpe: None,
            category: Some("Web Server".to_string()),
            templates_matched: vec![],
        });

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::TechVulnerabilityScan);
        assert_eq!(action.tool, "nuclei");
    }

    #[test]
    fn test_case_9_high_confidence_finding_selects_verification() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);

        let finding = StateFinding::new(
            "SQL Injection in admin login",
            FindingSeverity::High,
            FindingConfidence::Firm,
            "http://target.local/admin",
        );
        state.add_finding(finding);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected recommended action");
        assert_eq!(action.action_type, ActionType::FindingVerification);
        assert_eq!(action.tool, "verification");
        assert_eq!(action.target, "http://target.local/admin");
    }

    #[test]
    fn test_case_10_no_valuable_unexplored_surface_stops() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        state.record_executed_action("port_scan", "naabu", "target.local", 100, true, None);

        let plan = IntelligencePlanner::plan(&state);
        let action = plan.recommended_action.expect("Expected stop action");
        assert!(action.is_stop());
        assert!(plan.stop_reason.is_some());
    }

    #[test]
    fn test_case_11_out_of_scope_target_excluded() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        // Explicitly exclude out-of-scope domain
        scope.excluded_hosts.push("forbidden.target.local".to_string());

        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);
        // Add out-of-scope subdomain
        state.add_subdomain("forbidden.target.local", "subfinder");

        let plan = IntelligencePlanner::plan(&state);
        // forbidden.target.local must NOT be chosen for dnsx or any action
        if let Some(action) = &plan.recommended_action {
            assert_ne!(action.target, "forbidden.target.local");
        }
    }

    #[test]
    fn test_case_12_already_executed_not_duplicated() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;

        // Subfinder already executed on target.local
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 100, true, None);

        let plan = IntelligencePlanner::plan(&state);
        if let Some(action) = &plan.recommended_action {
            assert!(
                action.tool != "subfinder" || action.target != "target.local",
                "Subfinder on target.local was duplicated"
            );
        }
    }

    #[test]
    fn test_case_13_strategic_prioritization_boosts_action() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Strategic);
        state.hosts[0].ports_scanned = true;

        // Add endpoint with reflected parameter
        let mut ep = DiscoveredEndpoint::new("http://target.local/search?q=test", "target.local", 80, "/search?q=test");
        ep.params.push(DiscoveredParam {
            name: "q".to_string(),
            location: ParamLocation::Query,
            reflected: true,
            reflection_context: Some("attribute".to_string()),
            tested_for_xss: false,
            tested_for_sqli: false,
        });
        state.add_endpoint(ep);

        // Baseline plan without strategic boost
        let baseline_plan = IntelligencePlanner::plan(&state);
        let baseline_score = baseline_plan.recommended_action.as_ref().unwrap().score;

        // Create a SecurityHypothesis boosting xss_analysis
        let mut hypothesis = crate::models::hypothesis::SecurityHypothesis::new(
            uuid::Uuid::new_v4(),
            "xss".to_string(),
            "http://target.local/search?q=test".to_string(),
            "Reflected parameter 'q' suggests potential XSS vulnerability".to_string(),
            0.85,
            vec!["xss_analysis".to_string()],
            vec!["reflection probe".to_string()],
        );
        let prio = crate::intelligence::llm::prioritization::StrategicPrioritizer::prioritize(&[hypothesis]);

        let strategic_plan = IntelligencePlanner::plan_strategic(&state, None, Some(&prio));
        let rec = strategic_plan.recommended_action.expect("Expected recommended action");
        assert_eq!(rec.tool, "dalfox");
        // Score should be boosted, but bounded
        assert!(rec.score > baseline_score);
        assert!(rec.score <= 1.0);
        assert!(rec.reason.contains("LLM Boost"));
        assert!(strategic_plan.strategic_summary.is_some());
    }

    #[test]
    fn test_case_14_cross_run_experience_prunes_waste_on_archetype() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true;

        // Populate REST API endpoint
        let mut ep = DiscoveredEndpoint::new("http://target.local/api/v1/config", "target.local", 80, "/api/v1/config");
        ep.content_type = Some("application/json".to_string());
        state.endpoints.push(ep);

        // Add technology to generate nuclei candidate action
        state.technologies.push(DiscoveredTechnology {
            name: "nginx".to_string(),
            version: Some("1.20".to_string()),
            cpe: None,
            category: Some("Web Server".to_string()),
            templates_matched: Vec::new(),
        });

        let mut subfinder_exp = crate::models::experience::ExperienceAction::new(
            "rest_api",
            "*",
            "subdomain_enumeration",
            "subfinder",
            0.03,
        );
        subfinder_exp.sample_count = 35;
        subfinder_exp.actual_value = 0.03;

        let experience_list = vec![subfinder_exp];
        let plan = IntelligencePlanner::plan_experience(&state, None, None, Some(&experience_list), None);
        let rec = plan.recommended_action.expect("Expected recommended action");
        // With subfinder pruned due to low empirical value (0.03 over 35 runs on rest_api),
        // another high-value action (nuclei) should be selected over subfinder.
        assert_ne!(rec.tool, "subfinder", "Pruned tool with 35 low-value runs must not be recommended");
    }

    #[test]
    fn test_case_15_exploration_prevents_premature_pruning() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.hosts[0].ports_scanned = true; // prevent naabu on root host

        // Experience with only 3 samples: must not be pruned despite low value
        let mut subfinder_exp = crate::models::experience::ExperienceAction::new(
            "unknown",
            "*",
            "subdomain_enumeration",
            "subfinder",
            0.02,
        );
        subfinder_exp.sample_count = 3;
        subfinder_exp.actual_value = 0.02;

        let experience_list = vec![subfinder_exp];
        let plan = IntelligencePlanner::plan_experience(&state, None, None, Some(&experience_list), None);
        let rec = plan.recommended_action.expect("Expected recommended action");
        // Subfinder with n=3 is protected by exploration safeguard (n < 10)
        assert_eq!(rec.tool, "subfinder");
        assert!(rec.reason.contains("Sample count 3 < 10: pruning disabled"));
    }

    #[test]
    fn test_case_16_target_policy_differentiation_rest_vs_web() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("api.target.local".to_string());
        let mut state = InvestigationState::new("api.target.local", scope, InvestigationProfile::Policy);
        state.hosts[0].ports_scanned = true;

        let mut ep = DiscoveredEndpoint::new("http://api.target.local/v1/users", "api.target.local", 80, "/v1/users");
        ep.content_type = Some("application/json".to_string());
        state.endpoints.push(ep);

        let plan = IntelligencePlanner::plan(&state);
        assert!(plan.target_profile.is_some());
        let profile = plan.target_profile.unwrap();
        assert_eq!(profile.archetype, crate::intelligence::archetype::TargetArchetype::RestApi);
        assert_eq!(plan.policy_name, Some("REST API Policy".to_string()));

        let rec = plan.recommended_action.expect("Expected recommendation");
        assert!(!rec.policy_reasons.is_empty(), "Decision must contain policy reasons");
        assert!(!rec.evidence_refs.is_empty(), "Decision must contain evidence references");
    }

    #[test]
    fn test_case_17_target_policy_provenance_and_technology_weighting() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("blog.target.local".to_string());
        let mut state = InvestigationState::new("blog.target.local", scope, InvestigationProfile::Policy);
        state.hosts[0].ports_scanned = true;

        state.technologies.push(DiscoveredTechnology {
            name: "WordPress".to_string(),
            version: Some("6.2".to_string()),
            cpe: None,
            category: Some("CMS".to_string()),
            templates_matched: Vec::new(),
        });

        let ep = DiscoveredEndpoint::new("http://blog.target.local/wp-login.php", "blog.target.local", 80, "/wp-login.php");
        state.endpoints.push(ep);

        let plan = IntelligencePlanner::plan(&state);
        let profile = plan.target_profile.expect("Profile must be generated");
        assert!(profile.has_technology("wordpress"));
        assert_eq!(plan.policy_name, Some("Web Legacy Application Policy".to_string()));

        let rec = plan.recommended_action.expect("Recommended action present");
        assert!(rec.policy_reasons.iter().any(|r| r.contains("WordPress") || r.contains("Web Legacy")));
    }

    #[test]
    fn test_case_18_policy_scope_gate_strictness() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("allowed.local".to_string());
        scope.excluded_hosts.push("forbidden.allowed.local".to_string());

        let mut state = InvestigationState::new("allowed.local", scope, InvestigationProfile::Policy);
        state.hosts[0].ports_scanned = true;

        // Attempting to add an endpoint on forbidden host
        let ep = DiscoveredEndpoint::new("http://forbidden.allowed.local/api/v1/keys", "forbidden.allowed.local", 80, "/api/v1/keys");
        state.endpoints.push(ep);

        let plan = IntelligencePlanner::plan(&state);
        if let Some(rec) = plan.recommended_action {
            assert_ne!(rec.target, "forbidden.allowed.local");
            assert!(!rec.target.contains("forbidden"));
        }
    }
}


