//! Planner Decision and Action Execution Models (Adaptive Investigation Planner)
//!
//! Tracks deterministic decision loop provenance and empirical execution deltas.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

/// Persisted record of a deterministic planner decision
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlannerDecision {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub selected_action: String,
    pub capability: String,
    pub target: String,
    pub tool: String,
    pub score: f64,
    pub score_components: serde_json::Value,
    pub reason: String,
    pub expected_information_gain: f64,
    pub estimated_cost: String,
    pub alternatives: serde_json::Value,
    pub rejected_candidates: serde_json::Value,
    pub target_archetype: String,
    pub created_at: DateTime<Utc>,
}

/// Persisted record of a tool execution with before-and-after state deltas
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ActionExecution {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub decision_id: Option<Uuid>,
    pub action_type: String,
    pub capability: String,
    pub tool: String,
    pub target: String,
    pub status: String,
    pub assets_before: i32,
    pub assets_after: i32,
    pub endpoints_before: i32,
    pub endpoints_after: i32,
    pub parameters_before: i32,
    pub parameters_after: i32,
    pub findings_before: i32,
    pub findings_after: i32,
    pub verified_findings_before: i32,
    pub verified_findings_after: i32,
    pub new_technologies: i32,
    pub new_services: i32,
    pub execution_duration_ms: i64,
    pub exit_status: Option<i32>,
    pub error_type: Option<String>,
    pub information_gain: f64,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Persist a planner decision in database or in-memory fallback
pub async fn save_planner_decision(app_state: &AppState, decision: &PlannerDecision) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO planner_decisions (
                id, investigation_id, selected_action, capability, target, tool,
                score, score_components, reason, expected_information_gain,
                estimated_cost, alternatives, rejected_candidates,
                target_archetype, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)"#,
        )
        .bind(decision.id)
        .bind(decision.investigation_id)
        .bind(&decision.selected_action)
        .bind(&decision.capability)
        .bind(&decision.target)
        .bind(&decision.tool)
        .bind(decision.score)
        .bind(&decision.score_components)
        .bind(&decision.reason)
        .bind(decision.expected_information_gain)
        .bind(&decision.estimated_cost)
        .bind(&decision.alternatives)
        .bind(&decision.rejected_candidates)
        .bind(&decision.target_archetype)
        .bind(decision.created_at)
        .execute(app_state.db())
        .await;
    }
}

/// Get the latest planner decision for an investigation
pub async fn get_latest_planner_decision(
    app_state: &AppState,
    investigation_id: Uuid,
) -> Option<PlannerDecision> {
    if app_state.has_db() {
        if let Ok(decision) = sqlx::query_as::<_, PlannerDecision>(
            "SELECT * FROM planner_decisions WHERE investigation_id = $1 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(investigation_id)
        .fetch_optional(app_state.db())
        .await
        {
            return decision;
        }
    }
    None
}

/// List recent planner decisions for an investigation
pub async fn list_planner_decisions(
    app_state: &AppState,
    investigation_id: Uuid,
) -> Vec<PlannerDecision> {
    if app_state.has_db() {
        if let Ok(decisions) = sqlx::query_as::<_, PlannerDecision>(
            "SELECT * FROM planner_decisions WHERE investigation_id = $1 ORDER BY created_at DESC LIMIT 50",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            return decisions;
        }
    }
    Vec::new()
}

/// Persist an action execution record
pub async fn save_action_execution(app_state: &AppState, execution: &ActionExecution) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO action_executions (
                id, investigation_id, decision_id, action_type, capability, tool, target,
                status, assets_before, assets_after, endpoints_before, endpoints_after,
                parameters_before, parameters_after, findings_before, findings_after,
                verified_findings_before, verified_findings_after, new_technologies,
                new_services, execution_duration_ms, exit_status, error_type,
                information_gain, created_at, completed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
            )"#,
        )
        .bind(execution.id)
        .bind(execution.investigation_id)
        .bind(execution.decision_id)
        .bind(&execution.action_type)
        .bind(&execution.capability)
        .bind(&execution.tool)
        .bind(&execution.target)
        .bind(&execution.status)
        .bind(execution.assets_before)
        .bind(execution.assets_after)
        .bind(execution.endpoints_before)
        .bind(execution.endpoints_after)
        .bind(execution.parameters_before)
        .bind(execution.parameters_after)
        .bind(execution.findings_before)
        .bind(execution.findings_after)
        .bind(execution.verified_findings_before)
        .bind(execution.verified_findings_after)
        .bind(execution.new_technologies)
        .bind(execution.new_services)
        .bind(execution.execution_duration_ms)
        .bind(execution.exit_status)
        .bind(&execution.error_type)
        .bind(execution.information_gain)
        .bind(execution.created_at)
        .bind(execution.completed_at)
        .execute(app_state.db())
        .await;
    }
}
