//! Intelligence Engine HTTP Handlers
//!
//! Exposes API endpoints for planning next investigation steps and auditing planner reasoning.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::intelligence::planner::{IntelligencePlanner, InvestigationPlan};
use crate::intelligence::runner::{
    list_investigation_actions, AutonomousInvestigationRunner, InvestigationRunSummary,
    RunInvestigationRequest,
};
use crate::intelligence::state::{
    DiscoveredTechnology, InvestigationProfile, InvestigationState, ScopeBoundary, StateFinding,
};
use crate::models::investigation_action::InvestigationAction;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PlanPayload {
    pub investigation_id: Option<Uuid>,
    pub target: Option<String>,
    pub scope: Option<ScopeBoundary>,
    pub profile: Option<InvestigationProfile>,
    pub state: Option<InvestigationState>,
}

/// Handler for POST /api/investigations/run
pub async fn run_investigation(
    State(app_state): State<AppState>,
    Json(payload): Json<RunInvestigationRequest>,
) -> Result<Json<InvestigationRunSummary>, (StatusCode, Json<serde_json::Value>)> {
    let summary = AutonomousInvestigationRunner::run(&app_state, payload).await?;
    Ok(Json(summary))
}

/// Handler for POST /api/investigations/:id/run
pub async fn run_investigation_by_id(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(mut payload): Json<RunInvestigationRequest>,
) -> Result<Json<InvestigationRunSummary>, (StatusCode, Json<serde_json::Value>)> {
    payload.investigation_id = Some(id);
    let summary = AutonomousInvestigationRunner::run(&app_state, payload).await?;
    Ok(Json(summary))
}

/// Handler for GET /api/investigations/:id/actions
pub async fn get_investigation_actions(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<InvestigationAction>>, (StatusCode, Json<serde_json::Value>)> {
    let actions = list_investigation_actions(&app_state, id).await;
    Ok(Json(actions))
}

/// Handler for GET /api/investigations/:id/outcomes
pub async fn get_investigation_outcomes(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::action_outcome::ActionOutcome>>, (StatusCode, Json<serde_json::Value>)> {
    let outcomes = crate::intelligence::telemetry::list_action_outcomes(&app_state, id).await;
    Ok(Json(outcomes))
}

#[derive(Debug, Deserialize)]
pub struct CreateHypothesisRequest {
    pub category: String,
    pub target: String,
    pub rationale: String,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub suggested_actions: Vec<String>,
    #[serde(default)]
    pub required_evidence: Vec<String>,
}

/// Handler for GET /api/investigations/:id/hypotheses (v0.5)
pub async fn get_investigation_hypotheses(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::hypothesis::SecurityHypothesis>>, (StatusCode, Json<serde_json::Value>)> {
    let hypotheses = crate::intelligence::llm::hypothesis::list_hypotheses(&app_state, id).await;
    Ok(Json(hypotheses))
}

/// Handler for POST /api/investigations/:id/hypotheses (v0.5)
pub async fn create_investigation_hypothesis(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateHypothesisRequest>,
) -> Result<Json<crate::models::hypothesis::SecurityHypothesis>, (StatusCode, Json<serde_json::Value>)> {
    let conf = payload.confidence.unwrap_or(0.70).clamp(0.0, 1.0);
    let hypothesis = crate::models::hypothesis::SecurityHypothesis::new(
        id,
        payload.category,
        payload.target,
        payload.rationale,
        conf,
        payload.suggested_actions,
        payload.required_evidence,
    );
    crate::intelligence::llm::hypothesis::save_hypothesis(&app_state, &hypothesis).await;
    Ok(Json(hypothesis))
}

/// Handler for GET /api/investigations/:id/context (v0.5)
pub async fn get_investigation_context(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::llm::context::StrategicContext>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let outcomes = crate::intelligence::telemetry::list_action_outcomes(&app_state, id).await;
    let historical_stats = crate::intelligence::telemetry::get_historical_tool_stats(&app_state).await;

    let ctx = crate::intelligence::llm::context::StrategicContext::build(
        id,
        &state,
        &outcomes,
        &historical_stats,
    );
    Ok(Json(ctx))
}

#[derive(Debug, Deserialize)]
pub struct SubmitHypothesesPayload {
    pub hypotheses: Vec<CreateHypothesisRequest>,
}

#[derive(Debug, Serialize)]
pub struct SubmitHypothesesResponse {
    pub accepted_count: usize,
    pub rejected_count: usize,
    pub accepted_hypotheses: Vec<crate::models::hypothesis::SecurityHypothesis>,
    pub rejected_reasons: Vec<String>,
}

/// Handler for POST /api/investigations/:id/hypothesize (v0.5)
pub async fn submit_investigation_hypotheses(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitHypothesesPayload>,
) -> Result<Json<SubmitHypothesesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let mut accepted = Vec::new();
    let mut rejected_reasons = Vec::new();

    for req in payload.hypotheses {
        let conf = req.confidence.unwrap_or(0.70);
        let hyp = crate::models::hypothesis::SecurityHypothesis::new(
            id,
            req.category,
            req.target,
            req.rationale,
            conf,
            req.suggested_actions,
            req.required_evidence,
        );

        match crate::intelligence::llm::validation::LlmOutputValidator::validate_hypothesis(&hyp, id, &state) {
            Ok(()) => {
                crate::intelligence::llm::hypothesis::save_hypothesis(&app_state, &hyp).await;
                accepted.push(hyp);
            }
            Err(e) => {
                rejected_reasons.push(e.to_string());
            }
        }
    }

    Ok(Json(SubmitHypothesesResponse {
        accepted_count: accepted.len(),
        rejected_count: rejected_reasons.len(),
        accepted_hypotheses: accepted,
        rejected_reasons,
    }))
}

#[derive(Debug, Deserialize)]
pub struct PrioritizePayload {
    pub hypotheses: Vec<crate::intelligence::llm::prioritization::RankedHypothesisInput>,
}

/// Handler for POST /api/investigations/:id/prioritize (v0.5)
pub async fn prioritize_investigation_hypotheses(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PrioritizePayload>,
) -> Result<Json<crate::intelligence::llm::prioritization::StrategicPrioritization>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;

    for item in &payload.hypotheses {
        if !state.is_in_scope(&item.target) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": format!("REJECTED: Target '{}' is out of scope", item.target)
                })),
            ));
        }
    }

    let prio = crate::intelligence::llm::prioritization::StrategicPrioritizer::prioritize_ranked_items(&payload.hypotheses);
    Ok(Json(prio))
}

/// Handler for GET /api/intelligence/action-values
pub async fn get_action_values(
    State(app_state): State<AppState>,
) -> Result<Json<std::collections::HashMap<String, crate::intelligence::action_value::HistoricalToolStats>>, (StatusCode, Json<serde_json::Value>)> {
    let stats = crate::intelligence::telemetry::get_historical_tool_stats(&app_state).await;
    Ok(Json(stats))
}

/// Handler for POST /api/investigations/:id/pause
pub async fn pause_investigation(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut lock = app_state.in_memory_jobs().write().await;
    let mut paused_count = 0;
    for job in lock.iter_mut().filter(|j| j.program_id == id && j.status == "running") {
        job.status = "paused".to_string();
        job.updated_at = chrono::Utc::now();
        paused_count += 1;
    }
    Ok(Json(json!({
        "investigation_id": id,
        "status": "paused",
        "jobs_paused": paused_count,
        "message": format!("Investigation paused. {} running jobs paused.", paused_count)
    })))
}

/// Handler for POST /api/investigations/:id/resume
pub async fn resume_investigation(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut lock = app_state.in_memory_jobs().write().await;
    let mut resumed_count = 0;
    for job in lock.iter_mut().filter(|j| j.program_id == id && j.status == "paused") {
        job.status = "running".to_string();
        job.updated_at = chrono::Utc::now();
        resumed_count += 1;
    }
    Ok(Json(json!({
        "investigation_id": id,
        "status": "running",
        "jobs_resumed": resumed_count,
        "message": format!("Investigation resumed. {} jobs resumed.", resumed_count)
    })))
}

/// Handler for POST /api/investigations/:id/stop
pub async fn stop_investigation(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    {
        let mut lock = app_state.in_memory_programs().write().await;
        if let Some(p) = lock.iter_mut().find(|p| p.id == id) {
            p.active = false;
        }
    }
    let mut lock = app_state.in_memory_jobs().write().await;
    let mut cancelled_count = 0;
    for job in lock.iter_mut().filter(|j| j.program_id == id && (j.status == "running" || j.status == "queued")) {
        job.status = "cancelled".to_string();
        job.completed_at = Some(chrono::Utc::now());
        job.updated_at = chrono::Utc::now();
        cancelled_count += 1;
    }
    Ok(Json(json!({
        "investigation_id": id,
        "status": "stopped",
        "jobs_cancelled": cancelled_count,
        "message": "Investigation stopped and active jobs cancelled."
    })))
}

/// Handler for POST /api/investigations/plan
pub async fn plan_investigation(
    State(app_state): State<AppState>,
    Json(payload): Json<PlanPayload>,
) -> Result<Json<InvestigationPlan>, (StatusCode, Json<serde_json::Value>)> {
    // 1. If explicit state is provided, plan directly
    if let Some(state) = payload.state {
        let plan = IntelligencePlanner::plan(&state);
        return Ok(Json(plan));
    }

    // 2. If investigation_id is provided, reconstruct state from database / in-memory store
    if let Some(inv_id) = payload.investigation_id {
        let state = build_state_from_investigation(&app_state, inv_id).await?;
        let plan = IntelligencePlanner::plan(&state);
        return Ok(Json(plan));
    }

    // 3. If target is provided, create a fresh investigation state
    if let Some(target) = payload.target {
        let scope = payload.scope.unwrap_or_else(|| {
            let mut s = ScopeBoundary::new();
            s.domains.push(target.clone());
            s
        });
        let profile = payload.profile.unwrap_or_default();
        let state = InvestigationState::new(target, scope, profile);
        let plan = IntelligencePlanner::plan(&state);
        return Ok(Json(plan));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({
            "error": "Must provide either 'state', 'investigation_id', or 'target' in request body"
        })),
    ))
}

/// Handler for GET /api/investigations/:id/plan
pub async fn get_investigation_plan(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<InvestigationPlan>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let plan = IntelligencePlanner::plan(&state);
    Ok(Json(plan))
}

/// Reconstruct typed InvestigationState from live server storage
async fn build_state_from_investigation(
    app_state: &AppState,
    investigation_id: Uuid,
) -> Result<InvestigationState, (StatusCode, Json<serde_json::Value>)> {
    // 1. Locate program (Database or in-memory)
    let program = if app_state.has_db() {
        sqlx::query_as::<_, crate::models::program::Program>(
            "SELECT * FROM programs WHERE id = $1",
        )
        .bind(investigation_id)
        .fetch_optional(app_state.db())
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    let program = match program {
        Some(p) => p,
        None => {
            let lock = app_state.in_memory_programs().read().await;
            match lock.iter().find(|p| p.id == investigation_id).cloned() {
                Some(p) => p,
                None => {
                    return Err((
                        StatusCode::NOT_FOUND,
                        Json(json!({"error": format!("Investigation '{}' not found", investigation_id)})),
                    ));
                }
            }
        }
    };

    let target = program.program_url.clone().unwrap_or_else(|| program.name.clone());

    // 2. Load scope targets
    let mut scope = ScopeBoundary::new();
    if app_state.has_db() {
        if let Ok(targets) = sqlx::query_as::<_, crate::models::scope::ScopeTarget>(
            "SELECT * FROM scope_targets WHERE program_id = $1",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            for s in targets {
                if s.out_of_scope {
                    scope.excluded_hosts.push(s.target);
                } else if s.target.starts_with("*.") {
                    scope.wildcards.push(s.target);
                } else {
                    scope.domains.push(s.target);
                }
            }
        }
    }

    if scope.domains.is_empty() && scope.wildcards.is_empty() {
        let lock = app_state.in_memory_scope().read().await;
        for s in lock.iter().filter(|s| s.program_id == investigation_id) {
            if s.out_of_scope {
                scope.excluded_hosts.push(s.target.clone());
            } else if s.target.starts_with("*.") {
                scope.wildcards.push(s.target.clone());
            } else {
                scope.domains.push(s.target.clone());
            }
        }
    }

    if scope.domains.is_empty() && scope.wildcards.is_empty() {
        scope.domains.push(target.clone());
    }

    let mut state = InvestigationState::new(target, scope, InvestigationProfile::Standard);

    // 3. Load subdomains
    {
        let lock = app_state.in_memory_subdomains().read().await;
        for sub in lock.iter().filter(|s| s.program_id == investigation_id) {
            state.add_subdomain(&sub.subdomain, &sub.source);
            if let Some(ref ip) = sub.ip_address {
                state.mark_subdomain_dns_resolved(&sub.subdomain, vec![ip.clone()], vec![]);
            }
            if let Some(ref ws) = sub.web_server {
                state.add_technology(DiscoveredTechnology {
                    name: ws.clone(),
                    version: None,
                    cpe: None,
                    category: Some("Web Server".to_string()),
                    templates_matched: vec![],
                });
            }
            for t in &sub.tech {
                state.add_technology(DiscoveredTechnology {
                    name: t.clone(),
                    version: None,
                    cpe: None,
                    category: None,
                    templates_matched: vec![],
                });
            }
        }
    }

    // 4. Load findings
    {
        let lock = app_state.in_memory_findings().read().await;
        for f in lock.iter().filter(|f| f.program_id == investigation_id) {
            let sev = match f.severity.to_lowercase().as_str() {
                "critical" => crate::intelligence::state::FindingSeverity::Critical,
                "high" => crate::intelligence::state::FindingSeverity::High,
                "medium" => crate::intelligence::state::FindingSeverity::Medium,
                "low" => crate::intelligence::state::FindingSeverity::Low,
                _ => crate::intelligence::state::FindingSeverity::Info,
            };
            let verified = f.status.eq_ignore_ascii_case("verified") || f.status.eq_ignore_ascii_case("confirmed");
            let conf = if verified {
                crate::intelligence::state::FindingConfidence::Confirmed
            } else {
                crate::intelligence::state::FindingConfidence::Firm
            };

            let endpoint = f.matched_at.clone().unwrap_or_else(|| f.title.clone());
            let mut sf = StateFinding::new(&f.title, sev, conf, endpoint);
            sf.id = f.id.to_string();
            sf.verified = verified;
            state.add_finding(sf);
        }
    }

    // 5. Load executed jobs
    {
        let lock = app_state.in_memory_jobs().read().await;
        for j in lock.iter().filter(|j| j.program_id == investigation_id) {
            let tool = j
                .flags
                .as_ref()
                .and_then(|fl| fl.get("tool"))
                .and_then(|t| t.as_str())
                .unwrap_or("unknown");
            let target_str = j.target.as_deref().unwrap_or("");
            if j.status == "completed" || j.status == "done" {
                state.record_executed_action("scan", tool, target_str, 1000, true, None);
            }
        }
    }

    Ok(state)
}

#[derive(Debug, Deserialize)]
pub struct ProvenanceQuery {
    pub archetype: Option<String>,
    pub tool: Option<String>,
}

/// Handler for GET /api/experience/actions (v0.6)
pub async fn get_experience_actions(
    State(app_state): State<AppState>,
) -> Result<Json<Vec<crate::models::experience::ExperienceAction>>, (StatusCode, Json<serde_json::Value>)> {
    let actions = crate::intelligence::experience::GlobalExperienceStore::list_experience(&app_state).await;
    Ok(Json(actions))
}

/// Handler for GET /api/experience/provenance (v0.6)
pub async fn get_experience_provenance(
    State(app_state): State<AppState>,
    Query(query): Query<ProvenanceQuery>,
) -> Result<Json<Vec<crate::models::experience::ExperienceProvenanceRecord>>, (StatusCode, Json<serde_json::Value>)> {
    let audit = crate::intelligence::experience::GlobalExperienceStore::get_provenance_audit(
        &app_state,
        query.archetype.as_deref(),
        query.tool.as_deref(),
    ).await;
    Ok(Json(audit))
}

/// Handler for GET /api/investigations/:id/archetype (v0.6)
pub async fn get_investigation_archetype(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::archetype::ArchetypeClassification>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let classification = crate::intelligence::archetype::TargetArchetypeClassifier::classify(&state);
    Ok(Json(classification))
}

/// Handler for GET /api/investigations/:id/profile (v0.7)
pub async fn get_investigation_profile(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::models::target_profile::TargetProfile>, (StatusCode, Json<serde_json::Value>)> {
    if let Some(profile) = crate::models::target_profile::get_target_profile(&app_state, id).await {
        return Ok(Json(profile));
    }

    let state = build_state_from_investigation(&app_state, id).await?;
    let profile = crate::intelligence::profiler::TargetProfiler::profile(id, &state);
    let _ = crate::models::target_profile::save_target_profile(&app_state, &profile).await;
    Ok(Json(profile))
}

/// Handler for GET /api/investigations/:id/policy (v0.7)
pub async fn get_investigation_policy(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let profile = match crate::models::target_profile::get_target_profile(&app_state, id).await {
        Some(p) => p,
        None => {
            let state = build_state_from_investigation(&app_state, id).await?;
            let p = crate::intelligence::profiler::TargetProfiler::profile(id, &state);
            let _ = crate::models::target_profile::save_target_profile(&app_state, &p).await;
            p
        }
    };

    let policy = crate::intelligence::policies::PolicyRegistry::get_policy_for(profile.archetype);

    let state = build_state_from_investigation(&app_state, id).await?;
    let plan = IntelligencePlanner::plan_with_policy(&state, None, None, None, None, Some(&profile));

    Ok(Json(json!({
        "investigation_id": id,
        "policy_name": policy.name(),
        "archetype": profile.archetype.as_str(),
        "confidence": profile.confidence,
        "target_profile": profile,
        "recommended_action": plan.recommended_action,
        "alternatives": plan.alternatives,
    })))
}

/// Handler for GET /api/investigations/:id/education (Ars0n Phase 12)
pub async fn get_investigation_education(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::education::EducationLesson>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let lesson = crate::intelligence::education::EducationEngine::generate_lesson(&state);
    Ok(Json(lesson))
}

/// Handler for GET /api/investigations/:id/threats (Ars0n Phase 11)
pub async fn get_investigation_threats(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<crate::intelligence::threat_model::ThreatItem>>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let threats = crate::intelligence::threat_model::ThreatModelEngine::generate_model(&state);
    Ok(Json(threats))
}

/// Handler for GET /api/investigations/:id/prioritization (Ars0n Phase 13)
pub async fn get_investigation_prioritization(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::roi::TargetPrioritizationScore>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let profile = match crate::models::target_profile::get_target_profile(&app_state, id).await {
        Some(p) => p,
        None => {
            let p = crate::intelligence::profiler::TargetProfiler::profile(id, &state);
            let _ = crate::models::target_profile::save_target_profile(&app_state, &p).await;
            p
        }
    };
    let score = crate::intelligence::roi::RoiEngine::prioritize_target(&state.target, &state, &profile, Some(0.35));
    Ok(Json(score))
}

#[derive(Debug, Deserialize)]
pub struct BehaviorRequest {
    pub target_url: String,
}

/// Handler for POST /api/investigations/:id/behavior (Ars0n Phase 10)
pub async fn analyze_investigation_behavior(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<BehaviorRequest>,
) -> Result<Json<crate::intelligence::behavior::BehaviorReport>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_default();

    let report = crate::intelligence::behavior::BehaviorAnalyzer::analyze_target_behavior(
        &client,
        &payload.target_url,
        &state.scope,
    )
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e }))))?;

    Ok(Json(report))
}

#[derive(Debug, Deserialize)]
pub struct FlowExecuteRequest {
    pub flow: crate::intelligence::flows::RequestFlow,
    #[serde(default)]
    pub dry_run: bool,
}

/// Handler for POST /api/investigations/:id/flows/replay (Ars0n Phase 9)
pub async fn replay_investigation_flow(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<FlowExecuteRequest>,
) -> Result<Json<crate::intelligence::flows::FlowReplayResult>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_default();

    let result = crate::intelligence::flows::FlowEngine::execute_flow(
        &client,
        &payload.flow,
        payload.dry_run,
        &state.scope,
    )
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e }))))?;

    Ok(Json(result))
}

#[derive(Debug, Deserialize)]
pub struct AuthzTestRequest {
    pub endpoint_template: String,
    pub resource_id_a: String,
    pub identity_b: crate::intelligence::authz::Identity,
}

/// Handler for POST /api/investigations/:id/authz/test (Ars0n Phase 8)
pub async fn test_investigation_authz(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AuthzTestRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_default();

    let obs_opt = crate::intelligence::authz::AuthzEngine::test_bola_access(
        &client,
        &payload.endpoint_template,
        &payload.resource_id_a,
        &payload.identity_b,
        &state.scope,
    )
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e }))))?;

    Ok(Json(json!({
        "investigation_id": id,
        "vulnerability_candidate": obs_opt,
    })))
}

/// Handler for GET /api/investigations/:id/adaptive-plan
pub async fn get_adaptive_plan(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::adaptive_planner::AdaptivePlan>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let plan = crate::intelligence::adaptive_planner::AdaptivePlanner::plan(id, &state, None);

    if let Some(ref action) = plan.selected_action {
        let decision = crate::models::planner_decision::PlannerDecision {
            id: Uuid::new_v4(),
            investigation_id: id,
            selected_action: action.action_id.clone(),
            capability: action.capability.as_str().to_string(),
            target: action.target.clone(),
            tool: action.tool.clone(),
            score: action.score,
            score_components: serde_json::to_value(&action.score_components).unwrap_or_default(),
            reason: action.reason.clone(),
            expected_information_gain: action.expected_information_gain,
            estimated_cost: action.estimated_cost.clone(),
            alternatives: serde_json::to_value(&plan.alternatives).unwrap_or_default(),
            rejected_candidates: serde_json::to_value(&plan.rejected_candidates).unwrap_or_default(),
            target_archetype: plan.target_archetype.clone(),
            created_at: chrono::Utc::now(),
        };
        crate::models::planner_decision::save_planner_decision(&app_state, &decision).await;
    }

    Ok(Json(plan))
}

/// Handler for GET /api/investigations/:id/next-action
pub async fn get_next_action(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let plan = crate::intelligence::adaptive_planner::AdaptivePlanner::plan(id, &state, None);

    if let Some(action) = plan.selected_action {
        Ok(Json(json!({
            "investigation_id": id,
            "action": action.action_id,
            "capability": action.capability.as_str(),
            "tool": action.tool,
            "target": action.target,
            "score": action.score,
            "score_components": action.score_components,
            "reason": action.reason,
            "required_tools": action.required_tools,
            "estimated_cost": action.estimated_cost,
            "risk_level": action.risk_level,
            "expected_information_gain": action.expected_information_gain,
            "target_archetype": plan.target_archetype,
        })))
    } else {
        Ok(Json(json!({
            "investigation_id": id,
            "action": "stop",
            "score": 0.0,
            "reason": plan.reason,
            "stop_reason": plan.stop_reason,
        })))
    }
}

/// Handler for GET /api/investigations/:id/explain-decision
pub async fn explain_decision(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state = build_state_from_investigation(&app_state, id).await?;
    let plan = crate::intelligence::adaptive_planner::AdaptivePlanner::plan(id, &state, None);
    let latest_decision = crate::models::planner_decision::get_latest_planner_decision(&app_state, id).await;

    Ok(Json(json!({
        "investigation_id": id,
        "current_plan": {
            "selected_action": plan.selected_action,
            "score": plan.score,
            "score_components": plan.score_components,
            "reason": plan.reason,
            "target_archetype": plan.target_archetype,
            "state_metrics": plan.state_metrics,
            "alternatives": plan.alternatives,
            "rejected_candidates": plan.rejected_candidates,
        },
        "persisted_decision": latest_decision,
    })))
}

/// Handler for POST /api/investigations/:id/replan
pub async fn replan_investigation(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::intelligence::adaptive_planner::AdaptivePlan>, (StatusCode, Json<serde_json::Value>)> {
    get_adaptive_plan(State(app_state), Path(id)).await
}



