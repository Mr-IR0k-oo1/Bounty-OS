//! Investigation Action Persistence Model
//!
//! Stores the complete audit trail of decisions made by the Intelligence Planner:
//! What was planned, why, score components, execution link, and post-execution feedback telemetry.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct InvestigationAction {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub action_type: String,
    pub target: String,
    pub tool: String,
    pub score: f64,
    pub information_gain: f64,
    pub relevance: f64,
    pub confidence: f64,
    pub cost: f64,
    pub risk: f64,
    pub reason: String,
    pub status: String, // planned, running, completed, failed, cancelled
    pub actual_information_gain: Option<f64>,
    pub prediction_error: Option<f64>,
    pub findings_generated: i32,
    pub new_assets_generated: i32,
    pub job_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl InvestigationAction {
    pub fn new(
        investigation_id: Uuid,
        action_type: impl Into<String>,
        target: impl Into<String>,
        tool: impl Into<String>,
        score: f64,
        ig: f64,
        relevance: f64,
        confidence: f64,
        cost: f64,
        risk: f64,
        reason: impl Into<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            investigation_id,
            action_type: action_type.into(),
            target: target.into(),
            tool: tool.into(),
            score,
            information_gain: ig,
            relevance,
            confidence,
            cost,
            risk,
            reason: reason.into(),
            status: "planned".to_string(),
            actual_information_gain: None,
            prediction_error: None,
            findings_generated: 0,
            new_assets_generated: 0,
            job_id: None,
            created_at: now,
            started_at: None,
            completed_at: None,
        }
    }
}
