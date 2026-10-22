//! Global Experience Models (v0.6)
//!
//! Stores cross-investigation empirical action values conditional on target archetype
//! and technology stack, together with full Bayesian updating telemetry and provenance.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct ExperienceAction {
    pub id: Uuid,
    pub archetype: String,
    pub technology: String,
    pub action_type: String,
    pub tool: String,
    pub predicted_value: f64,
    pub actual_value: f64,
    pub avg_execution_time_ms: f64,
    pub total_new_assets: i64,
    pub total_new_endpoints: i64,
    pub total_new_parameters: i64,
    pub total_new_findings: i64,
    pub total_confirmed_findings: i64,
    pub total_false_positives: i64,
    pub success_rate: f64,
    pub sample_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ExperienceAction {
    pub fn new(
        archetype: impl Into<String>,
        technology: impl Into<String>,
        action_type: impl Into<String>,
        tool: impl Into<String>,
        initial_value: f64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            archetype: archetype.into(),
            technology: technology.into(),
            action_type: action_type.into(),
            tool: tool.into(),
            predicted_value: initial_value,
            actual_value: initial_value,
            avg_execution_time_ms: 1000.0,
            total_new_assets: 0,
            total_new_endpoints: 0,
            total_new_parameters: 0,
            total_new_findings: 0,
            total_confirmed_findings: 0,
            total_false_positives: 0,
            success_rate: 1.0,
            sample_count: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Update experience using Bayesian running average:
    /// V_new = (n * V_old + V_obs) / (n + 1)
    pub fn update_with_outcome(
        &mut self,
        observed_value: f64,
        execution_time_ms: f64,
        is_success: bool,
        new_assets: i32,
        new_endpoints: i32,
        new_params: i32,
        new_findings: i32,
        confirmed_findings: i32,
        false_positives: i32,
    ) {
        let n = self.sample_count as f64;
        let next_n = n + 1.0;

        self.actual_value = ((n * self.actual_value) + observed_value) / next_n;
        self.avg_execution_time_ms = ((n * self.avg_execution_time_ms) + execution_time_ms) / next_n;
        
        let success_val = if is_success { 1.0 } else { 0.0 };
        self.success_rate = ((n * self.success_rate) + success_val) / next_n;

        self.total_new_assets += new_assets as i64;
        self.total_new_endpoints += new_endpoints as i64;
        self.total_new_parameters += new_params as i64;
        self.total_new_findings += new_findings as i64;
        self.total_confirmed_findings += confirmed_findings as i64;
        self.total_false_positives += false_positives as i64;

        self.sample_count += 1;
        self.updated_at = Utc::now();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct ExperienceProvenance {
    pub id: Uuid,
    pub experience_id: Uuid,
    pub investigation_id: Uuid,
    pub action_id: Option<Uuid>,
    pub outcome_id: Option<Uuid>,
    pub observed_value: f64,
    pub new_findings: i32,
    pub confirmed_findings: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExperienceProvenanceRecord {
    pub id: Uuid,
    pub experience_id: Uuid,
    pub archetype: String,
    pub tool: String,
    pub action_type: String,
    pub investigation_id: Uuid,
    pub action_id: Option<Uuid>,
    pub outcome_id: Option<Uuid>,
    pub observed_value: f64,
    pub new_findings: i32,
    pub confirmed_findings: i32,
    pub created_at: DateTime<Utc>,
}
