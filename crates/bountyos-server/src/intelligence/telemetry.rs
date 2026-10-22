//! Empirical Telemetry Collector (Bounty OS v0.4)
//!
//! Captures pre- and post-execution state deltas to measure actual empirical yields:
//! new attack surface, new services, new endpoints, new parameters, findings generated,
//! verification confirmations, actual information gain, and prediction errors.

use std::collections::HashMap;
use uuid::Uuid;

use crate::intelligence::action_value::{ActionValueModel, HistoricalToolStats};
use crate::intelligence::actions::PlannedAction;
use crate::intelligence::state::InvestigationState;
use crate::models::action_outcome::ActionOutcome;
use crate::state::AppState;

/// Snapshot of state asset counts taken immediately prior to tool execution
#[derive(Debug, Clone, PartialEq, Default)]
pub struct StateSnapshot {
    pub subdomains_count: usize,
    pub hosts_count: usize,
    pub services_count: usize,
    pub endpoints_count: usize,
    pub parameters_count: usize,
    pub technologies_count: usize,
    pub findings_count: usize,
    pub verified_findings_count: usize,
}

impl StateSnapshot {
    /// Capture current asset counts from investigation state
    pub fn take(state: &InvestigationState) -> Self {
        let params_count = state.endpoints.iter().map(|e| e.params.len()).sum();
        let verified_count = state.findings.iter().filter(|f| f.verified).count();

        Self {
            subdomains_count: state.subdomains.len(),
            hosts_count: state.hosts.len(),
            services_count: state.services.len(),
            endpoints_count: state.endpoints.len(),
            parameters_count: params_count,
            technologies_count: state.technologies.len(),
            findings_count: state.findings.len(),
            verified_findings_count: verified_count,
        }
    }
}

pub struct TelemetryCollector;

impl TelemetryCollector {
    /// Calculate exact deltas between pre-execution snapshot and post-execution state
    #[allow(clippy::too_many_arguments)]
    pub fn collect_outcome(
        investigation_id: Uuid,
        action_id: Option<Uuid>,
        planned_action: &PlannedAction,
        pre: &StateSnapshot,
        post: &InvestigationState,
        execution_time_ms: i64,
        is_success: bool,
        observations_count: usize,
    ) -> ActionOutcome {
        let post_params: usize = post.endpoints.iter().map(|e| e.params.len()).sum();
        let post_verified = post.findings.iter().filter(|f| f.verified).count();

        let new_subdomains = (post.subdomains.len().saturating_sub(pre.subdomains_count)) as i32;
        let new_hosts = (post.hosts.len().saturating_sub(pre.hosts_count)) as i32;
        let new_services = (post.services.len().saturating_sub(pre.services_count)) as i32;
        let new_endpoints = (post.endpoints.len().saturating_sub(pre.endpoints_count)) as i32;
        let new_parameters = (post_params.saturating_sub(pre.parameters_count)) as i32;
        let new_technologies = (post.technologies.len().saturating_sub(pre.technologies_count)) as i32;
        let new_findings = (post.findings.len().saturating_sub(pre.findings_count)) as i32;
        let confirmed_findings = (post_verified.saturating_sub(pre.verified_findings_count)) as i32;

        let new_assets = new_subdomains
            + new_hosts
            + new_services
            + new_endpoints
            + new_parameters
            + new_technologies;

        // Verification determination
        let is_verification = planned_action.tool == "verification"
            || planned_action.action_type == crate::intelligence::actions::ActionType::FindingVerification;

        let verification_result = if is_verification {
            Some(is_success && confirmed_findings > 0)
        } else {
            None
        };

        // Compute actual information gain:
        // IG_actual = useful_observations / (total_observations + 1)
        let useful_units = (new_assets as f64 * 0.25)
            + (new_services as f64 * 0.50)
            + (new_endpoints as f64 * 0.75)
            + (new_findings as f64 * 1.50)
            + (confirmed_findings as f64 * 2.00);

        let total_denom = (observations_count as f64 + 1.0).max(1.0);
        let actual_ig = (useful_units / total_denom).clamp(0.0, 1.0);
        let actual_ig_rounded = (actual_ig * 100.0).round() / 100.0;

        let prediction_error = (planned_action.info_gain - actual_ig_rounded).abs();
        let prediction_error_rounded = (prediction_error * 100.0).round() / 100.0;

        // Calculate actual empirical value V(a)
        let actual_value = ActionValueModel::calculate_value(
            new_assets,
            new_services,
            new_endpoints,
            new_parameters,
            new_technologies,
            new_findings,
            confirmed_findings,
            (new_assets as f64 * 0.1).clamp(0.0, 1.0),
            execution_time_ms,
            planned_action.cost,
            planned_action.risk,
            None,
        );

        ActionOutcome::new(
            investigation_id,
            action_id,
            planned_action.action_type.as_str(),
            &planned_action.tool,
            &planned_action.target,
            planned_action.score,
            planned_action.info_gain,
            execution_time_ms,
            planned_action.cost,
            planned_action.risk,
            new_assets,
            new_services,
            new_endpoints,
            new_parameters,
            new_technologies,
            new_findings,
            confirmed_findings,
            0, // false positives
            verification_result,
            actual_ig_rounded,
            actual_value,
            prediction_error_rounded,
        )
    }
}

/// Persist an action outcome to PostgreSQL and local in-memory store
pub async fn save_action_outcome(state: &AppState, outcome: &ActionOutcome) {
    if state.has_db() {
        let res = sqlx::query(
            r#"INSERT INTO action_outcomes (
                id, investigation_id, action_id, action_type, tool, target,
                planner_score, predicted_information_gain, execution_time_ms,
                resource_cost, risk, new_assets, new_services, new_endpoints,
                new_parameters, new_technologies, new_findings, confirmed_findings,
                false_positives, verification_result, actual_information_gain,
                actual_value, prediction_error, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
            ) ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(outcome.id)
        .bind(outcome.investigation_id)
        .bind(outcome.action_id)
        .bind(&outcome.action_type)
        .bind(&outcome.tool)
        .bind(&outcome.target)
        .bind(outcome.planner_score)
        .bind(outcome.predicted_information_gain)
        .bind(outcome.execution_time_ms)
        .bind(outcome.resource_cost)
        .bind(outcome.risk)
        .bind(outcome.new_assets)
        .bind(outcome.new_services)
        .bind(outcome.new_endpoints)
        .bind(outcome.new_parameters)
        .bind(outcome.new_technologies)
        .bind(outcome.new_findings)
        .bind(outcome.confirmed_findings)
        .bind(outcome.false_positives)
        .bind(outcome.verification_result)
        .bind(outcome.actual_information_gain)
        .bind(outcome.actual_value)
        .bind(outcome.prediction_error)
        .bind(outcome.created_at)
        .execute(state.db())
        .await;

        if let Err(e) = res {
            tracing::warn!("Failed to persist action_outcome {}: {}", outcome.id, e);
        }
    }

    let mut lock = state.in_memory_action_outcomes().write().await;
    lock.push(outcome.clone());
}

/// Retrieve outcomes for a specific investigation
pub async fn list_action_outcomes(state: &AppState, investigation_id: Uuid) -> Vec<ActionOutcome> {
    if state.has_db() {
        if let Ok(outcomes) = sqlx::query_as::<_, ActionOutcome>(
            "SELECT * FROM action_outcomes WHERE investigation_id = $1 ORDER BY created_at ASC",
        )
        .bind(investigation_id)
        .fetch_all(state.db())
        .await
        {
            if !outcomes.is_empty() {
                return outcomes;
            }
        }
    }

    let lock = state.in_memory_action_outcomes().read().await;
    lock.iter()
        .filter(|o| o.investigation_id == investigation_id)
        .cloned()
        .collect()
}

/// Retrieve all action outcomes across all investigations
pub async fn list_all_action_outcomes(state: &AppState) -> Vec<ActionOutcome> {
    if state.has_db() {
        if let Ok(outcomes) = sqlx::query_as::<_, ActionOutcome>(
            "SELECT * FROM action_outcomes ORDER BY created_at ASC",
        )
        .fetch_all(state.db())
        .await
        {
            if !outcomes.is_empty() {
                return outcomes;
            }
        }
    }

    let lock = state.in_memory_action_outcomes().read().await;
    lock.clone()
}

/// Retrieve aggregated historical tool statistics across all recorded outcomes
pub async fn get_historical_tool_stats(state: &AppState) -> HashMap<String, HistoricalToolStats> {
    let all_outcomes = list_all_action_outcomes(state).await;
    ActionValueModel::aggregate_history(&all_outcomes)
}
