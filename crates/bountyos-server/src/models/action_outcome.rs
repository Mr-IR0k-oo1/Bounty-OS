//! Action Outcome Empirical Telemetry Model
//!
//! Stores granular post-execution observations, asset discovery deltas,
//! finding confirmation status, and computed action values.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct ActionOutcome {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub action_id: Option<Uuid>,
    pub action_type: String,
    pub tool: String,
    pub target: String,
    pub planner_score: f64,
    pub predicted_information_gain: f64,
    pub execution_time_ms: i64,
    pub resource_cost: f64,
    pub risk: f64,
    pub new_assets: i32,
    pub new_services: i32,
    pub new_endpoints: i32,
    pub new_parameters: i32,
    pub new_technologies: i32,
    pub new_findings: i32,
    pub confirmed_findings: i32,
    pub false_positives: i32,
    pub verification_result: Option<bool>,
    pub actual_information_gain: f64,
    pub actual_value: f64,
    pub prediction_error: f64,
    pub created_at: DateTime<Utc>,
}

impl ActionOutcome {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        investigation_id: Uuid,
        action_id: Option<Uuid>,
        action_type: impl Into<String>,
        tool: impl Into<String>,
        target: impl Into<String>,
        planner_score: f64,
        predicted_ig: f64,
        execution_time_ms: i64,
        resource_cost: f64,
        risk: f64,
        new_assets: i32,
        new_services: i32,
        new_endpoints: i32,
        new_parameters: i32,
        new_technologies: i32,
        new_findings: i32,
        confirmed_findings: i32,
        false_positives: i32,
        verification_result: Option<bool>,
        actual_ig: f64,
        actual_value: f64,
        prediction_error: f64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            investigation_id,
            action_id,
            action_type: action_type.into(),
            tool: tool.into(),
            target: target.into(),
            planner_score,
            predicted_information_gain: predicted_ig,
            execution_time_ms,
            resource_cost,
            risk,
            new_assets,
            new_services,
            new_endpoints,
            new_parameters,
            new_technologies,
            new_findings,
            confirmed_findings,
            false_positives,
            verification_result,
            actual_information_gain: actual_ig,
            actual_value,
            prediction_error,
            created_at: Utc::now(),
        }
    }
}
