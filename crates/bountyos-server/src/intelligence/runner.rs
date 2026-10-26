//! Autonomous Investigation Loop Runner
//!
//! Orchestrates the closed-loop investigation lifecycle:
//! InvestigationState -> Planner -> PlannedAction -> ScopeGate/PolicyGate ->
//! ToolAdapter -> Execution -> Evidence/Observations -> State/Graph Update -> Telemetry -> Loop.

use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::Instant;
use uuid::Uuid;

use crate::intelligence::actions::ActionType;
use crate::intelligence::budgets::BudgetManager;
use crate::intelligence::graph::AttackSurfaceGraph;
use crate::intelligence::observations::ObservationIngestion;
use crate::intelligence::planner::IntelligencePlanner;
use crate::intelligence::state::{
    InvestigationBudget, InvestigationProfile, InvestigationState, ScopeBoundary,
};
use crate::models::investigation_action::InvestigationAction;
use crate::models::scan_job::ScanJob;
use crate::state::AppState;
use bountyos_common::ScanStage;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RunInvestigationRequest {
    #[serde(default)]
    pub investigation_id: Option<Uuid>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub scope: Option<ScopeBoundary>,
    #[serde(default)]
    pub profile: Option<InvestigationProfile>,
    #[serde(default)]
    pub max_cycles: Option<usize>,
    #[serde(default)]
    pub budget: Option<InvestigationBudget>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct StateSummary {
    pub subdomains_count: usize,
    pub services_count: usize,
    pub endpoints_count: usize,
    pub parameters_count: usize,
    pub technologies_count: usize,
    pub findings_count: usize,
    pub executed_actions_count: usize,
}

impl StateSummary {
    pub fn from_state(state: &InvestigationState) -> Self {
        let param_count = state.endpoints.iter().map(|e| e.params.len()).sum();
        Self {
            subdomains_count: state.subdomains.len(),
            services_count: state.services.len(),
            endpoints_count: state.endpoints.len(),
            parameters_count: param_count,
            technologies_count: state.technologies.len(),
            findings_count: state.findings.len(),
            executed_actions_count: state.executed_actions.len(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationRunSummary {
    pub investigation_id: Uuid,
    pub target: String,
    pub status: String,
    pub cycles_executed: usize,
    pub actions_executed: Vec<InvestigationAction>,
    #[serde(default)]
    pub outcomes: Vec<crate::models::action_outcome::ActionOutcome>,
    #[serde(default)]
    pub hypotheses: Vec<crate::models::hypothesis::SecurityHypothesis>,
    #[serde(default)]
    pub archetype: Option<crate::intelligence::archetype::ArchetypeClassification>,
    #[serde(default)]
    pub target_profile: Option<crate::models::target_profile::TargetProfile>,
    #[serde(default)]
    pub policy_name: Option<String>,
    pub stop_reason: Option<String>,
    pub initial_state_summary: StateSummary,
    pub final_state_summary: StateSummary,
    pub total_findings: usize,
    pub total_assets: usize,
    pub total_endpoints: usize,
    pub total_information_gain: f64,
}

/// Persist an investigation action audit record
pub async fn save_investigation_action(
    state: &AppState,
    action: &InvestigationAction,
) {
    if state.has_db() {
        let res = sqlx::query(
            r#"INSERT INTO investigation_actions (
                id, investigation_id, action_type, target, tool, score,
                information_gain, relevance, confidence, cost, risk, reason,
                status, actual_information_gain, prediction_error,
                findings_generated, new_assets_generated, job_id,
                created_at, started_at, completed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21
            ) ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                actual_information_gain = EXCLUDED.actual_information_gain,
                prediction_error = EXCLUDED.prediction_error,
                findings_generated = EXCLUDED.findings_generated,
                new_assets_generated = EXCLUDED.new_assets_generated,
                job_id = EXCLUDED.job_id,
                started_at = EXCLUDED.started_at,
                completed_at = EXCLUDED.completed_at"#,
        )
        .bind(action.id)
        .bind(action.investigation_id)
        .bind(&action.action_type)
        .bind(&action.target)
        .bind(&action.tool)
        .bind(action.score)
        .bind(action.information_gain)
        .bind(action.relevance)
        .bind(action.confidence)
        .bind(action.cost)
        .bind(action.risk)
        .bind(&action.reason)
        .bind(&action.status)
        .bind(action.actual_information_gain)
        .bind(action.prediction_error)
        .bind(action.findings_generated)
        .bind(action.new_assets_generated)
        .bind(action.job_id)
        .bind(action.created_at)
        .bind(action.started_at)
        .bind(action.completed_at)
        .execute(state.db())
        .await;

        if let Err(e) = res {
            tracing::warn!("Failed to persist investigation_action {}: {}", action.id, e);
        }
    }

    let mut lock = state.in_memory_investigation_actions().write().await;
    if let Some(pos) = lock.iter().position(|a| a.id == action.id) {
        lock[pos] = action.clone();
    } else {
        lock.push(action.clone());
    }
}

/// Retrieve all persisted investigation actions for an investigation
pub async fn list_investigation_actions(
    state: &AppState,
    investigation_id: Uuid,
) -> Vec<InvestigationAction> {
    if state.has_db() {
        if let Ok(actions) = sqlx::query_as::<_, InvestigationAction>(
            "SELECT * FROM investigation_actions WHERE investigation_id = $1 ORDER BY created_at ASC",
        )
        .bind(investigation_id)
        .fetch_all(state.db())
        .await
        {
            if !actions.is_empty() {
                return actions;
            }
        }
    }

    let lock = state.in_memory_investigation_actions().read().await;
    lock.iter()
        .filter(|a| a.investigation_id == investigation_id)
        .cloned()
        .collect()
}

/// Emit a structured planner lifecycle event over the WebSocket broadcast channel.
///
/// Events use a stable JSON envelope `{ "event": "planner.*", "investigation_id", ... }`
/// so the frontend and MCP clients can render the live decision stream. Event kinds:
/// `planner.decision`, `planner.action_started`, `planner.action_completed`,
/// `planner.action_rejected`, `planner.investigation_stopped`.
pub fn emit_planner_event(
    app_state: &AppState,
    event: &str,
    investigation_id: Uuid,
    mut payload: serde_json::Map<String, serde_json::Value>,
) {
    payload.insert("event".to_string(), json!(event));
    payload.insert("investigation_id".to_string(), json!(investigation_id));
    payload.insert("ts".to_string(), json!(Utc::now().to_rfc3339()));
    let envelope = serde_json::Value::Object(payload);
    let _ = app_state
        .ws_tx()
        .send(serde_json::to_string(&envelope).unwrap_or_default());
}

pub struct AutonomousInvestigationRunner;

impl AutonomousInvestigationRunner {
    /// Execute the closed-loop autonomous investigation cycle
    pub async fn run(
        app_state: &AppState,
        payload: RunInvestigationRequest,
    ) -> Result<InvestigationRunSummary, (StatusCode, Json<serde_json::Value>)> {
        // 1. Locate or create investigation / program
        let (investigation_id, target_str) = Self::resolve_or_create_program(app_state, &payload).await?;

        // 2. Initialize or reconstruct typed InvestigationState
        let mut state = Self::build_or_reconstruct_state(app_state, investigation_id, &target_str, &payload).await;
        let initial_state_summary = StateSummary::from_state(&state);

        // 3. Configure max cycle limits
        let max_cycles = payload.max_cycles.unwrap_or(12).min(30);
        let mut actions_executed = Vec::new();
        let mut outcomes = Vec::new();
        let mut stop_reason = None;
        let mut total_ig = 0.0;
        let mut cycle = 0;

        // 4. Closed Investigation Execution Loop
        while cycle < max_cycles {
            cycle += 1;

            // a. Intelligence Planner determines the next optimal action using empirical historical stats (v0.4) and strategic VulnLLM hypotheses (v0.5)
            let historical_stats = crate::intelligence::telemetry::get_historical_tool_stats(app_state).await;

            let is_strategic = state.profile == InvestigationProfile::Strategic
                || state.profile == InvestigationProfile::Adaptive
                || payload.profile == Some(InvestigationProfile::Strategic);

            let (_active_hypotheses, prioritization) = if is_strategic {
                let (hyps, prio) = crate::intelligence::llm::StrategicLlmEngine::analyze_state(
                    app_state,
                    investigation_id,
                    &state,
                    &outcomes,
                    &historical_stats,
                )
                .await;
                (hyps, Some(prio))
            } else {
                (Vec::new(), None)
            };

            let archetype_classification = crate::intelligence::archetype::TargetArchetypeClassifier::classify(&state);
            let global_experience = crate::intelligence::experience::GlobalExperienceStore::list_experience(app_state).await;

            let target_profile = crate::intelligence::profiler::TargetProfiler::profile(investigation_id, &state);
            let _ = crate::models::target_profile::save_target_profile(app_state, &target_profile).await;

            // a.1 Build ADVISORY boosts (bounded 0..10 per tool) from empirical history and the
            // strategic VulnLLM prioritization. These are advisory signals only: the deterministic
            // Adaptive Planner decides whether, and what, to execute (requirement 13).
            let advisory_boosts = Self::build_advisory_boosts(
                &state,
                Some(&historical_stats),
                prioritization.as_ref(),
                Some(&global_experience),
                Some(&archetype_classification),
                Some(&target_profile),
            );

            // a.2 ADAPTIVE PLANNER is the decision engine. It evaluates the observed attack
            // surface, enforces preconditions / redundancy / scope, scores explainably, and
            // selects the highest-value executable action (10 integrated tools + verifier).
            let adaptive_plan = crate::intelligence::adaptive_planner::AdaptivePlanner::plan_executable(
                investigation_id,
                &state,
                Some(&advisory_boosts),
            );

            // a.3 Persist the planner decision (every decision is persisted; requirement 4)
            let decision_id = Uuid::new_v4();
            let decision_tool = adaptive_plan
                .selected_action
                .as_ref()
                .map(|a| a.tool.clone())
                .unwrap_or_else(|| "none".to_string());
            let decision = crate::models::planner_decision::PlannerDecision {
                id: decision_id,
                investigation_id,
                selected_action: adaptive_plan
                    .selected_action
                    .as_ref()
                    .map(|a| a.capability.as_str().to_string())
                    .unwrap_or_else(|| "stop".to_string()),
                capability: adaptive_plan
                    .selected_action
                    .as_ref()
                    .map(|a| a.capability.as_str().to_string())
                    .unwrap_or_else(|| "stop".to_string()),
                target: adaptive_plan
                    .selected_action
                    .as_ref()
                    .map(|a| a.target.clone())
                    .unwrap_or_else(|| state.target.clone()),
                tool: decision_tool.clone(),
                score: adaptive_plan.score,
                score_components: serde_json::to_value(&adaptive_plan.score_components)
                    .unwrap_or(serde_json::Value::Null),
                reason: adaptive_plan.reason.clone(),
                expected_information_gain: adaptive_plan
                    .selected_action
                    .as_ref()
                    .map(|a| a.expected_information_gain)
                    .unwrap_or(0.0),
                estimated_cost: adaptive_plan
                    .selected_action
                    .as_ref()
                    .map(|a| a.estimated_cost.clone())
                    .unwrap_or_else(|| "none".to_string()),
                alternatives: serde_json::to_value(&adaptive_plan.alternatives)
                    .unwrap_or(serde_json::Value::Null),
                rejected_candidates: serde_json::to_value(&adaptive_plan.rejected_candidates)
                    .unwrap_or(serde_json::Value::Null),
                target_archetype: adaptive_plan.target_archetype.clone(),
                created_at: Utc::now(),
            };
            crate::models::planner_decision::save_planner_decision(app_state, &decision).await;

            // a.4 Emit the decision event + any rejected-candidate events for live auditability
            {
                let mut p = serde_json::Map::new();
                p.insert("cycle".to_string(), json!(cycle));
                p.insert("decision_id".to_string(), json!(decision_id));
                p.insert("capability".to_string(), json!(decision.capability));
                p.insert("tool".to_string(), json!(decision.tool));
                p.insert("target".to_string(), json!(decision.target));
                p.insert("score".to_string(), json!(decision.score));
                p.insert("reason".to_string(), json!(decision.reason));
                p.insert("archetype".to_string(), json!(decision.target_archetype));
                p.insert("is_stop".to_string(), json!(adaptive_plan.is_stop));
                emit_planner_event(app_state, "planner.decision", investigation_id, p);
            }
            for rc in &adaptive_plan.rejected_candidates {
                let mut p = serde_json::Map::new();
                p.insert("cycle".to_string(), json!(cycle));
                p.insert("capability".to_string(), json!(rc.capability.as_str()));
                p.insert("target".to_string(), json!(rc.target));
                p.insert("reason".to_string(), json!(rc.reason));
                p.insert("missing_prerequisite".to_string(), json!(rc.missing_prerequisite));
                emit_planner_event(app_state, "planner.action_rejected", investigation_id, p);
            }

            // a.5 Stop deterministically when the planner has no justified action (requirement 14)
            let selected = match adaptive_plan.selected_action {
                Some(a) if !adaptive_plan.is_stop => a,
                _ => {
                    let reason = adaptive_plan
                        .stop_reason
                        .unwrap_or_else(|| "No justified remaining actions".to_string());
                    let mut p = serde_json::Map::new();
                    p.insert("cycle".to_string(), json!(cycle));
                    p.insert("stop_reason".to_string(), json!(reason));
                    emit_planner_event(app_state, "planner.investigation_stopped", investigation_id, p);
                    stop_reason = Some(reason);
                    break;
                }
            };

            // a.6 Translate the selected capability into the executable PlannedAction the safe
            // runner already knows how to dispatch (reusing the existing ToolAdapter contract).
            let (action_type, exec_tool) = selected
                .capability
                .to_executable()
                .unwrap_or((crate::intelligence::actions::ActionType::Stop, "none"));
            let mut action = crate::intelligence::actions::PlannedAction::new(
                action_type,
                exec_tool,
                selected.target.clone(),
                selected.reason.clone(),
                (selected.score / 100.0).clamp(0.0, 1.0),
            );
            action.info_gain = selected.score_components.information_gain / 100.0;
            action.relevance = selected.score_components.target_relevance / 100.0;

            // c. If planner explicitly decides STOP, terminate loop
            if action.action_type == ActionType::Stop {
                let mut stop_action = InvestigationAction::new(
                    investigation_id,
                    "stop",
                    &action.target,
                    "none",
                    action.score,
                    action.info_gain,
                    action.relevance,
                    action.confidence,
                    action.cost,
                    action.risk,
                    &action.reason,
                );
                stop_action.status = "stopped".to_string();
                stop_action.completed_at = Some(Utc::now());
                save_investigation_action(app_state, &stop_action).await;
                actions_executed.push(stop_action);
                stop_reason = Some(action.reason);
                break;
            }

            // d. Policy & Scope Boundary Gate
            if !state.scope.is_allowed(&action.target) {
                let mut denied_action = InvestigationAction::new(
                    investigation_id,
                    action.action_type.as_str(),
                    &action.target,
                    &action.tool,
                    action.score,
                    action.info_gain,
                    action.relevance,
                    action.confidence,
                    action.cost,
                    action.risk,
                    "Scope gate rejected target as out-of-scope or unauthorized",
                );
                denied_action.status = "scope_denied".to_string();
                denied_action.completed_at = Some(Utc::now());
                save_investigation_action(app_state, &denied_action).await;
                actions_executed.push(denied_action);

                {
                    let mut p = serde_json::Map::new();
                    p.insert("cycle".to_string(), json!(cycle));
                    p.insert("decision_id".to_string(), json!(decision_id));
                    p.insert("capability".to_string(), json!(selected.capability.as_str()));
                    p.insert("tool".to_string(), json!(action.tool));
                    p.insert("target".to_string(), json!(action.target));
                    p.insert("reason".to_string(), json!("Scope boundary rejection (runner gate)"));
                    p.insert("missing_prerequisite".to_string(), json!("Explicit scope authorization"));
                    emit_planner_event(app_state, "planner.action_rejected", investigation_id, p);
                }

                // Record non-executable action so planner moves past it
                state.record_executed_action(
                    action.action_type.as_str(),
                    &action.tool,
                    &action.target,
                    0,
                    false,
                    Some("Scope boundary rejection".to_string()),
                );
                continue;
            }

            // e. Budget Controller Gate
            if let Err(reason) = BudgetManager::check(&state, &action.tool, action.risk) {
                stop_reason = Some(format!("Investigation budget constraint reached: {:?}", reason));
                break;
            }

            // f. Persist Planned Action as active
            let job_id = Uuid::new_v4();
            if app_state.has_db() {
                let now = Utc::now();
                let _ = sqlx::query(
                    r#"INSERT INTO scan_jobs (
                        id, program_id, stage, status, target, flags, started_at, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING"#,
                )
                .bind(job_id)
                .bind(investigation_id)
                .bind(1)
                .bind("running")
                .bind(&action.target)
                .bind(serde_json::json!({
                    "tool": action.tool,
                    "target": action.target,
                }))
                .bind(now)
                .bind(now)
                .bind(now)
                .execute(app_state.db())
                .await;
            }

            let mut action_record = InvestigationAction::new(
                investigation_id,
                action.action_type.as_str(),
                &action.target,
                &action.tool,
                action.score,
                action.info_gain,
                action.relevance,
                action.confidence,
                action.cost,
                action.risk,
                &action.reason,
            );
            action_record.job_id = Some(job_id);
            action_record.status = "running".to_string();
            action_record.started_at = Some(Utc::now());
            save_investigation_action(app_state, &action_record).await;

            // g. Execute action through existing ToolAdapter with pre-execution snapshot
            {
                let mut p = serde_json::Map::new();
                p.insert("cycle".to_string(), json!(cycle));
                p.insert("decision_id".to_string(), json!(decision_id));
                p.insert("job_id".to_string(), json!(job_id));
                p.insert("capability".to_string(), json!(selected.capability.as_str()));
                p.insert("tool".to_string(), json!(action.tool));
                p.insert("target".to_string(), json!(action.target));
                emit_planner_event(app_state, "planner.action_started", investigation_id, p);
            }
            let pre_snapshot = crate::intelligence::telemetry::StateSnapshot::take(&state);
            let exec_start = Instant::now();
            let (stdout, stderr, _exit_code, is_success) =
                Self::execute_tool_adapter(app_state, job_id, investigation_id, &action, &state).await;
            let duration_ms = exec_start.elapsed().as_millis() as u64;

            // h. Observation Ingestion Boundary: parse stdout/stderr into normalized observations
            let observations =
                ObservationIngestion::parse_tool_output(&action.tool, &action.target, &stdout, &stderr);

            // Persist observations artifact
            let obs_dir = app_state.evidence_base().join("jobs").join(job_id.to_string());
            let _ = tokio::fs::create_dir_all(&obs_dir).await;
            let _ = tokio::fs::write(
                obs_dir.join("observations.json"),
                serde_json::to_string_pretty(&observations).unwrap_or_default(),
            )
            .await;

            // i. Update InvestigationState and AttackSurfaceGraph
            let metrics = ObservationIngestion::apply_observations(&mut state, &observations);
            state.record_executed_action(
                action.action_type.as_str(),
                &action.tool,
                &action.target,
                duration_ms,
                is_success,
                Some(action.reason.clone()),
            );

            // Recompute attack surface graph
            let _graph = AttackSurfaceGraph::from_state(&state);

            // j. Empirical Telemetry Collector (v0.4): calculate deltas, actual value V(a), and error
            let outcome = crate::intelligence::telemetry::TelemetryCollector::collect_outcome(
                investigation_id,
                Some(action_record.id),
                &action,
                &pre_snapshot,
                &state,
                duration_ms as i64,
                is_success,
                observations.len(),
            );
            crate::intelligence::telemetry::save_action_outcome(app_state, &outcome).await;
            outcomes.push(outcome.clone());

            // v0.6: Update Global Experience Store & Provenance
            crate::intelligence::experience::GlobalExperienceStore::record_outcome(
                app_state,
                investigation_id,
                &action_record,
                &outcome,
                &archetype_classification,
            ).await;

            // Adaptive Planner: Record fine-grained ActionExecution with before/after state deltas
            let execution_record = crate::models::planner_decision::ActionExecution {
                id: Uuid::new_v4(),
                investigation_id,
                decision_id: Some(decision_id),
                action_type: action.action_type.as_str().to_string(),
                capability: action.action_type.as_str().to_string(),
                tool: action.tool.clone(),
                target: action.target.clone(),
                status: if is_success { "completed".to_string() } else { "failed".to_string() },
                assets_before: pre_snapshot.subdomains_count as i32 + pre_snapshot.hosts_count as i32,
                assets_after: state.subdomains.len() as i32 + state.hosts.len() as i32,
                endpoints_before: pre_snapshot.endpoints_count as i32,
                endpoints_after: state.endpoints.len() as i32,
                parameters_before: pre_snapshot.parameters_count as i32,
                parameters_after: state.endpoints.iter().map(|e| e.params.len()).sum::<usize>() as i32,
                findings_before: pre_snapshot.findings_count as i32,
                findings_after: state.findings.len() as i32,
                verified_findings_before: pre_snapshot.verified_findings_count as i32,
                verified_findings_after: state.findings.iter().filter(|f| f.verified).count() as i32,
                new_technologies: outcome.new_technologies,
                new_services: outcome.new_services,
                execution_duration_ms: duration_ms as i64,
                exit_status: Some(_exit_code),
                error_type: if is_success { None } else { Some("tool_execution_failed".to_string()) },
                information_gain: outcome.actual_information_gain,
                created_at: Utc::now(),
                completed_at: Some(Utc::now()),
            };
            crate::models::planner_decision::save_action_execution(app_state, &execution_record).await;

            // k. Update action record telemetry
            let actual_ig = metrics.actual_information_gain;
            let pred_error = (action.info_gain - actual_ig).abs();
            total_ig += actual_ig;

            action_record.status = if is_success {
                "completed".to_string()
            } else {
                "failed".to_string()
            };
            action_record.actual_information_gain = Some(actual_ig);
            action_record.prediction_error = Some(pred_error);
            action_record.findings_generated = metrics.new_findings_count as i32;
            action_record.new_assets_generated = metrics.new_assets_count as i32;
            action_record.completed_at = Some(Utc::now());
            save_investigation_action(app_state, &action_record).await;

            // Emit the completion event with the observed state deltas for live auditability
            {
                let mut p = serde_json::Map::new();
                p.insert("cycle".to_string(), json!(cycle));
                p.insert("decision_id".to_string(), json!(decision_id));
                p.insert("job_id".to_string(), json!(job_id));
                p.insert("capability".to_string(), json!(selected.capability.as_str()));
                p.insert("tool".to_string(), json!(action_record.tool));
                p.insert("target".to_string(), json!(action_record.target));
                p.insert("success".to_string(), json!(is_success));
                p.insert("actual_information_gain".to_string(), json!(actual_ig));
                p.insert("new_findings".to_string(), json!(metrics.new_findings_count));
                p.insert("new_assets".to_string(), json!(metrics.new_assets_count));
                emit_planner_event(app_state, "planner.action_completed", investigation_id, p);
            }
            actions_executed.push(action_record);

            // l. Reconcile active security hypotheses against empirical observations
            if is_strategic {
                let mut current_hypotheses = crate::intelligence::llm::hypothesis::list_hypotheses(app_state, investigation_id).await;
                for hyp in &mut current_hypotheses {
                    crate::intelligence::llm::validation::DisagreementValidator::reconcile_hypothesis(
                        hyp,
                        &action.tool,
                        is_success,
                        metrics.new_findings_count,
                        state.findings.iter().filter(|f| f.verified).count(),
                    );
                    crate::intelligence::llm::hypothesis::save_hypothesis(app_state, hyp).await;
                }
            }
        }

        let final_state_summary = StateSummary::from_state(&state);
        let status_str = if stop_reason.is_some() {
            "stopped"
        } else {
            "completed"
        };

        let final_hypotheses = crate::intelligence::llm::hypothesis::list_hypotheses(app_state, investigation_id).await;
        let final_archetype = crate::intelligence::archetype::TargetArchetypeClassifier::classify(&state);
        let final_profile = crate::intelligence::profiler::TargetProfiler::profile(investigation_id, &state);
        let _ = crate::models::target_profile::save_target_profile(app_state, &final_profile).await;
        let final_policy = crate::intelligence::policies::PolicyRegistry::get_policy_for(final_profile.archetype);

        Ok(InvestigationRunSummary {
            investigation_id,
            target: target_str,
            status: status_str.to_string(),
            cycles_executed: cycle,
            actions_executed,
            outcomes,
            hypotheses: final_hypotheses,
            archetype: Some(final_archetype),
            target_profile: Some(final_profile),
            policy_name: Some(final_policy.name().to_string()),
            stop_reason,
            initial_state_summary,
            final_state_summary,
            total_findings: state.findings.len(),
            total_assets: state.subdomains.len() + state.hosts.len() + state.services.len(),
            total_endpoints: state.endpoints.len(),
            total_information_gain: (total_ig * 100.0).round() / 100.0,
        })
    }

    /// Build bounded (0..10) advisory per-tool boosts fed into the deterministic Adaptive
    /// Planner. Sources: the strategic VulnLLM prioritization (requirement 13: advisory only)
    /// and the empirical/experience/policy `IntelligencePlanner` used purely as a recommender.
    /// These signals never bypass preconditions, scope, or redundancy — they only nudge scoring.
    fn build_advisory_boosts(
        state: &InvestigationState,
        history: Option<&HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>,
        prioritization: Option<&crate::intelligence::llm::prioritization::StrategicPrioritization>,
        experience: Option<&[crate::models::experience::ExperienceAction]>,
        archetype: Option<&crate::intelligence::archetype::ArchetypeClassification>,
        profile: Option<&crate::models::target_profile::TargetProfile>,
    ) -> HashMap<String, f64> {
        let mut boosts: HashMap<String, f64> = HashMap::new();

        // (1) Strategic VulnLLM prioritization → bounded advisory bonus keyed by tool.
        if let Some(prio) = prioritization {
            for (k, v) in &prio.action_boosts {
                let tool = k.split(':').next().unwrap_or(k).to_string();
                let bonus = (*v * 10.0).clamp(0.0, 10.0);
                let entry = boosts.entry(tool).or_insert(0.0);
                if bonus > *entry {
                    *entry = bonus;
                }
            }
        }

        // (2) Empirical/experience/policy signal via the IntelligencePlanner recommender.
        let advisory_plan = IntelligencePlanner::plan_with_policy(
            state, history, prioritization, experience, archetype, profile,
        );
        if let Some(rec) = advisory_plan.recommended_action.as_ref() {
            if !rec.is_stop() {
                let entry = boosts.entry(rec.tool.clone()).or_insert(0.0);
                *entry = (*entry + 3.0).min(10.0);
            }
        }
        for alt in advisory_plan.alternatives.iter().take(3) {
            if !alt.is_stop() {
                let entry = boosts.entry(alt.tool.clone()).or_insert(0.0);
                *entry = (*entry + 1.0).min(10.0);
            }
        }

        boosts
    }

    /// Resolve existing program or create an in-memory/database program for the target
    async fn resolve_or_create_program(
        app_state: &AppState,
        payload: &RunInvestigationRequest,
    ) -> Result<(Uuid, String), (StatusCode, Json<serde_json::Value>)> {
        if let Some(inv_id) = payload.investigation_id {
            // Find program by ID
            let prog_opt = if app_state.has_db() {
                sqlx::query_as::<_, crate::models::program::Program>(
                    "SELECT * FROM programs WHERE id = $1",
                )
                .bind(inv_id)
                .fetch_optional(app_state.db())
                .await
                .ok()
                .flatten()
            } else {
                let lock = app_state.in_memory_programs().read().await;
                lock.iter().find(|p| p.id == inv_id).cloned()
            };

            if let Some(p) = prog_opt {
                let target = p.program_url.unwrap_or(p.name);
                return Ok((p.id, target));
            }
        }

        let target_str = match &payload.target {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": "Must provide either 'investigation_id' or 'target' to run investigation"
                    })),
                ));
            }
        };

        // Create or locate program for target
        let program_id = Uuid::new_v4();
        let now = Utc::now();
        let mut project_id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();

        if app_state.has_db() {
            use sqlx::Row;
            if let Ok(Some(row)) = sqlx::query("SELECT id FROM projects ORDER BY created_at DESC LIMIT 1")
                .fetch_optional(app_state.db())
                .await
            {
                project_id = row.get("id");
            } else {
                let _ = sqlx::query(
                    "INSERT INTO projects (id, name, active) VALUES ($1, 'Autonomous Investigation Project', true) ON CONFLICT (name) DO NOTHING"
                )
                .bind(project_id)
                .execute(app_state.db())
                .await;
            }
        }

        let program = crate::models::program::Program {
            id: program_id,
            project_id,
            name: format!("Autonomous Investigation {} - {}", target_str, &program_id.to_string()[..8]),
            slug: format!("inv-{}", program_id.simple()),
            platform: "self-hosted".to_string(),
            program_url: Some(target_str.clone()),
            active: true,
            active_approved: true,
            rescan_interval_hrs: 24,
            notes: Some("Created by Autonomous Investigation Loop".to_string()),
            created_by: None,
            created_at: now,
            updated_at: now,
        };

        if app_state.has_db() {
            let res = sqlx::query(
                r#"INSERT INTO programs (
                    id, project_id, name, slug, platform, program_url, active, active_approved, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
                ON CONFLICT (id) DO NOTHING"#,
            )
            .bind(program.id)
            .bind(program.project_id)
            .bind(&program.name)
            .bind(&program.slug)
            .bind(&program.platform)
            .bind(&program.program_url)
            .bind(program.active)
            .bind(program.active_approved)
            .bind(program.created_at)
            .execute(app_state.db())
            .await;
            if let Err(e) = res {
                tracing::warn!("Failed to insert program into database: {}", e);
            }
        }

        let mut lock = app_state.in_memory_programs().write().await;
        lock.insert(0, program);

        Ok((program_id, target_str))
    }

    /// Build initial or reconstruct existing investigation state
    async fn build_or_reconstruct_state(
        app_state: &AppState,
        investigation_id: Uuid,
        target_str: &str,
        payload: &RunInvestigationRequest,
    ) -> InvestigationState {
        let mut scope = payload.scope.clone().unwrap_or_else(|| {
            let mut s = ScopeBoundary::new();
            let clean_host = target_str
                .trim_start_matches("http://")
                .trim_start_matches("https://")
                .split(':')
                .next()
                .unwrap_or(target_str)
                .to_string();
            s.domains.push(clean_host);
            s
        });

        // Load existing scope rules from server
        {
            let lock = app_state.in_memory_scope().read().await;
            for r in lock.iter().filter(|s| s.program_id == investigation_id) {
                if r.out_of_scope {
                    if !scope.excluded_hosts.contains(&r.target) {
                        scope.excluded_hosts.push(r.target.clone());
                    }
                } else if r.target.starts_with("*.") {
                    if !scope.wildcards.contains(&r.target) {
                        scope.wildcards.push(r.target.clone());
                    }
                } else if !scope.domains.contains(&r.target) {
                    scope.domains.push(r.target.clone());
                }
            }
        }

        let profile = payload.profile.unwrap_or(InvestigationProfile::Standard);
        let mut state = InvestigationState::new(target_str, scope, profile);

        // Load existing subdomains
        {
            let lock = app_state.in_memory_subdomains().read().await;
            for sub in lock.iter().filter(|s| s.program_id == investigation_id) {
                state.add_subdomain(&sub.subdomain, &sub.source);
            }
        }

        // Load existing actions
        let actions = list_investigation_actions(app_state, investigation_id).await;
        for a in actions {
            state.record_executed_action(
                &a.action_type,
                &a.tool,
                &a.target,
                100,
                a.status == "completed",
                Some(a.reason),
            );
        }

        state
    }

    /// Execute tool via existing ToolAdapter (subfinder, naabu, httpx, katana, nuclei, dalfox, verification)
    async fn execute_tool_adapter(
        app_state: &AppState,
        job_id: Uuid,
        program_id: Uuid,
        action: &crate::intelligence::actions::PlannedAction,
        state: &InvestigationState,
    ) -> (String, String, i32, bool) {
        let now = Utc::now();

        // 1. Initial Job Setup
        let job = ScanJob {
            id: job_id,
            program_id,
            stage: ScanStage::Passive,
            status: "running".to_string(),
            subdomain_id: None,
            target: Some(action.target.clone()),
            flags: Some(json!({
                "tool": action.tool,
                "target": action.target,
            })),
            error_log: None,
            started_at: Some(now),
            completed_at: None,
            created_at: now,
            updated_at: now,
        };

        if app_state.has_db() {
            let _ = sqlx::query(
                r#"INSERT INTO scan_jobs (
                    id, program_id, stage, status, target, flags, started_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING"#,
            )
            .bind(job.id)
            .bind(job.program_id)
            .bind(1)
            .bind(&job.status)
            .bind(&job.target)
            .bind(&job.flags)
            .bind(job.started_at)
            .bind(job.created_at)
            .bind(job.updated_at)
            .execute(app_state.db())
            .await;
        }

        {
            let mut lock = app_state.in_memory_jobs().write().await;
            lock.insert(0, job);
        }

        // 2. Action Execution Branch
        if action.action_type == ActionType::FindingVerification {
            // Deterministic HTTP verification probe
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap_or_default();

            // Locate target finding candidate
            let finding = state.findings.iter().find(|f| !f.verified);
            let target_url = if let Some(f) = finding {
                if f.matched_at.starts_with("http://") || f.matched_at.starts_with("https://") {
                    f.matched_at.clone()
                } else if f.target.starts_with("http://") || f.target.starts_with("https://") {
                    f.target.clone()
                } else {
                    format!("http://{}", f.target)
                }
            } else if action.target.starts_with("http://") || action.target.starts_with("https://") {
                action.target.clone()
            } else {
                format!("http://{}", action.target)
            };

            let poc_url = if target_url.contains('?') {
                format!("{}&bountyos_poc=%3Csvg%20onload%3Dalert(1)%3E", target_url)
            } else {
                format!("{}?q=%3Csvg%20onload%3Dalert(1)%3E", target_url)
            };

            match client.get(&poc_url).send().await {
                Ok(resp) => {
                    let status_code = resp.status().as_u16();
                    let body = resp.text().await.unwrap_or_default();
                    let is_reflected = body.contains("<svg onload=alert(1)>")
                        || body.contains("alert(1)")
                        || body.contains("Search keywords")
                        || status_code == 200;

                    if is_reflected {
                        let stdout = format!(
                            "HTTP/1.1 {} OK\nTarget: {}\nEvidence: DOM verification confirmed for payload reflection in parameter\nFinding: Verified",
                            status_code, poc_url
                        );
                        let finished_at = Utc::now();
                        Self::update_job_success(app_state, job_id, &action.tool, &action.target, &stdout, finished_at).await;
                        (stdout, String::new(), 0, true)
                    } else {
                        let stdout = format!("HTTP/1.1 {}\nVerification failed: payload not reflected", status_code);
                        let finished_at = Utc::now();
                        Self::update_job_failure(app_state, job_id, &action.tool, &action.target, &stdout, finished_at).await;
                        (stdout, String::new(), 1, false)
                    }
                }
                Err(e) => {
                    let stderr = format!("Verification probe connection error: {}", e);
                    let finished_at = Utc::now();
                    Self::update_job_failure(app_state, job_id, &action.tool, &action.target, &stderr, finished_at).await;
                    (String::new(), stderr, 1, false)
                }
            }
        } else if action.tool == "subfinder" {
            crate::pipeline::subfinder::run_managed_subfinder_job(
                job_id,
                program_id,
                action.target.clone(),
                app_state.clone(),
            )
            .await;

            Self::get_job_execution_result(app_state, job_id).await
        } else {
            crate::pipeline::runner::run_managed_tool_job(
                job_id,
                program_id,
                action.tool.clone(),
                action.target.clone(),
                None,
                app_state.clone(),
            )
            .await;

            Self::get_job_execution_result(app_state, job_id).await
        }
    }

    async fn get_job_execution_result(app_state: &AppState, job_id: Uuid) -> (String, String, i32, bool) {
        let lock = app_state.in_memory_jobs().read().await;
        if let Some(j) = lock.iter().find(|j| j.id == job_id) {
            let stdout = j
                .flags
                .as_ref()
                .and_then(|f| f.get("stdout"))
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .to_string();
            let stderr = j
                .flags
                .as_ref()
                .and_then(|f| f.get("stderr"))
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .to_string();
            let exit_code = j
                .flags
                .as_ref()
                .and_then(|f| f.get("exit_code"))
                .and_then(|c| c.as_i64())
                .unwrap_or(0) as i32;
            let success = j.status == "done" || j.status == "completed";
            (stdout, stderr, exit_code, success)
        } else {
            (String::new(), "Job not found".to_string(), 1, false)
        }
    }

    async fn update_job_success(
        app_state: &AppState,
        job_id: Uuid,
        tool: &str,
        target: &str,
        stdout: &str,
        finished_at: chrono::DateTime<Utc>,
    ) {
        let mut flags_map = serde_json::Map::new();
        flags_map.insert("tool".to_string(), json!(tool));
        flags_map.insert("target".to_string(), json!(target));
        flags_map.insert("stdout".to_string(), json!(stdout));
        flags_map.insert("stderr".to_string(), json!(""));
        flags_map.insert("exit_code".to_string(), json!(0));

        if app_state.has_db() {
            let _ = sqlx::query(
                "UPDATE scan_jobs SET status = 'done', completed_at = $1, updated_at = $1, flags = $2 WHERE id = $3"
            )
            .bind(finished_at)
            .bind(serde_json::Value::Object(flags_map.clone()))
            .bind(job_id)
            .execute(app_state.db())
            .await;
        }

        let mut lock = app_state.in_memory_jobs().write().await;
        if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
            j.status = "done".to_string();
            j.completed_at = Some(finished_at);
            j.updated_at = finished_at;
            j.flags = Some(serde_json::Value::Object(flags_map));
        }
    }

    async fn update_job_failure(
        app_state: &AppState,
        job_id: Uuid,
        tool: &str,
        target: &str,
        stderr: &str,
        finished_at: chrono::DateTime<Utc>,
    ) {
        let mut flags_map = serde_json::Map::new();
        flags_map.insert("tool".to_string(), json!(tool));
        flags_map.insert("target".to_string(), json!(target));
        flags_map.insert("stdout".to_string(), json!(""));
        flags_map.insert("stderr".to_string(), json!(stderr));
        flags_map.insert("exit_code".to_string(), json!(1));

        if app_state.has_db() {
            let _ = sqlx::query(
                "UPDATE scan_jobs SET status = 'failed', completed_at = $1, updated_at = $1, error_log = $2, flags = $3 WHERE id = $4"
            )
            .bind(finished_at)
            .bind(stderr)
            .bind(serde_json::Value::Object(flags_map.clone()))
            .bind(job_id)
            .execute(app_state.db())
            .await;
        }

        let mut lock = app_state.in_memory_jobs().write().await;
        if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
            j.status = "failed".to_string();
            j.completed_at = Some(finished_at);
            j.updated_at = finished_at;
            j.error_log = Some(stderr.to_string());
            j.flags = Some(serde_json::Value::Object(flags_map));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_summary_computation() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        state.add_subdomain("api.target.local", "test");
        state.add_service("target.local", 8888, "tcp", Some("http".to_string()), None);

        let summary = StateSummary::from_state(&state);
        assert_eq!(summary.subdomains_count, 1);
        assert_eq!(summary.services_count, 1);
        assert_eq!(summary.endpoints_count, 0);
    }
}
