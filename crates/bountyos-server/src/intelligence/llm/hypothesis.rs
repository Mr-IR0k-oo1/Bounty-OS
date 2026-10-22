//! Security Hypothesis Generation & Management (v0.5)
//!
//! Generates testable security hypotheses from bounded attack surface context.
//!
//! ARCHITECTURAL GUARANTEE:
//! Hypotheses are candidate security models. They are NEVER inserted into the `findings` table.
//! Only deterministic verification through ToolAdapter can prove a finding.

use uuid::Uuid;

use crate::intelligence::actions::ActionType;
use crate::intelligence::llm::context::StrategicContext;
use crate::models::hypothesis::SecurityHypothesis;
use crate::state::AppState;

pub struct HypothesisEngine;

impl HypothesisEngine {
    /// Formulate hypotheses from bounded strategic context
    pub fn formulate_hypotheses(context: &StrategicContext) -> Vec<SecurityHypothesis> {
        let mut hypotheses = Vec::new();

        // 1. Check for web parameters on crawled endpoints (XSS / Injection hypothesis)
        for ep in &context.endpoints {
            if !ep.parameters.is_empty() {
                let params_str = ep.parameters.join(", ");
                let category = "reflected_input".to_string();
                let rationale = format!(
                    "Endpoint '{}' exposes input parameters [{}] on web service. High likelihood of client-side reflection or unvalidated input handling.",
                    ep.url, params_str
                );

                hypotheses.push(SecurityHypothesis::new(
                    context.investigation_id,
                    category,
                    ep.url.clone(),
                    rationale,
                    0.85,
                    vec![
                        ActionType::XssAnalysis.as_str().to_string(),
                        ActionType::FindingVerification.as_str().to_string(),
                    ],
                    vec![
                        "Raw HTTP request transcript with payload reflection".to_string(),
                        "DOM execution or alert probe confirmation".to_string(),
                    ],
                ));
            }
        }

        // 2. Check for backend framework / debug technologies (Debug interface / API auth hypothesis)
        let has_debug_tech = context.technologies.iter().any(|t| {
            t.eq_ignore_ascii_case("werkzeug")
                || t.eq_ignore_ascii_case("flask")
                || t.eq_ignore_ascii_case("django")
        });

        if has_debug_tech {
            hypotheses.push(SecurityHypothesis::new(
                context.investigation_id,
                "exposed_debug_console".to_string(),
                context.target.clone(),
                "Python web application framework detected (Werkzeug/Flask). High risk of exposed /console or interactive debug pin endpoints.".to_string(),
                0.78,
                vec![
                    ActionType::EndpointCrawl.as_str().to_string(),
                    ActionType::TechVulnerabilityScan.as_str().to_string(),
                ],
                vec![
                    "HTTP 200 response on /console endpoint".to_string(),
                    "Werkzeug debugger PIN prompt banner in body".to_string(),
                ],
            ));
        }

        // 3. Check for open services without web probes
        for s in &context.services {
            if s.port == 8888 || s.port == 8000 || s.port == 8080 {
                hypotheses.push(SecurityHypothesis::new(
                    context.investigation_id,
                    "misconfigured_service".to_string(),
                    format!("{}:{}", context.target, s.port),
                    format!("Non-standard web port {} active on target. May expose unauthenticated management UI.", s.port),
                    0.72,
                    vec![
                        ActionType::HttpProbe.as_str().to_string(),
                        ActionType::EndpointCrawl.as_str().to_string(),
                    ],
                    vec![
                        "HTTP service banner and status response".to_string(),
                    ],
                ));
            }
        }

        // Deduplicate and cap at 3 high-confidence hypotheses
        hypotheses.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        hypotheses.truncate(3);
        hypotheses
    }
}

/// Save a security hypothesis to PostgreSQL and local in-memory store
pub async fn save_hypothesis(state: &AppState, hypothesis: &SecurityHypothesis) {
    if state.has_db() {
        let suggested_json = serde_json::to_value(&hypothesis.suggested_actions).unwrap_or_default();
        let required_json = serde_json::to_value(&hypothesis.required_evidence).unwrap_or_default();

        let _ = sqlx::query(
            r#"INSERT INTO security_hypotheses (
                id, investigation_id, category, target, rationale, confidence,
                suggested_actions, required_evidence, status, created_at, resolved_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            ) ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                resolved_at = EXCLUDED.resolved_at"#,
        )
        .bind(hypothesis.id)
        .bind(hypothesis.investigation_id)
        .bind(&hypothesis.category)
        .bind(&hypothesis.target)
        .bind(&hypothesis.rationale)
        .bind(hypothesis.confidence)
        .bind(suggested_json)
        .bind(required_json)
        .bind(&hypothesis.status)
        .bind(hypothesis.created_at)
        .bind(hypothesis.resolved_at)
        .execute(state.db())
        .await;
    }

    let mut lock = state.in_memory_hypotheses().write().await;
    if let Some(existing) = lock.iter_mut().find(|h| h.id == hypothesis.id) {
        *existing = hypothesis.clone();
    } else {
        lock.push(hypothesis.clone());
    }
}

/// Retrieve all hypotheses for an investigation
pub async fn list_hypotheses(state: &AppState, investigation_id: Uuid) -> Vec<SecurityHypothesis> {
    if state.has_db() {
        let rows = sqlx::query_as::<_, HypothesisDbRow>(
            "SELECT * FROM security_hypotheses WHERE investigation_id = $1 ORDER BY confidence DESC, created_at DESC",
        )
        .bind(investigation_id)
        .fetch_all(state.db())
        .await;

        if let Ok(r) = rows {
            return r.into_iter().map(Into::into).collect();
        }
    }

    let lock = state.in_memory_hypotheses().read().await;
    lock.iter()
        .filter(|h| h.investigation_id == investigation_id)
        .cloned()
        .collect()
}

#[derive(sqlx::FromRow)]
struct HypothesisDbRow {
    id: Uuid,
    investigation_id: Uuid,
    category: String,
    target: String,
    rationale: String,
    confidence: f64,
    suggested_actions: serde_json::Value,
    required_evidence: serde_json::Value,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
    resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<HypothesisDbRow> for SecurityHypothesis {
    fn from(row: HypothesisDbRow) -> Self {
        let suggested_actions: Vec<String> = serde_json::from_value(row.suggested_actions).unwrap_or_default();
        let required_evidence: Vec<String> = serde_json::from_value(row.required_evidence).unwrap_or_default();
        Self {
            id: row.id,
            investigation_id: row.investigation_id,
            category: row.category,
            target: row.target,
            rationale: row.rationale,
            confidence: row.confidence,
            suggested_actions,
            required_evidence,
            status: row.status,
            created_at: row.created_at,
            resolved_at: row.resolved_at,
        }
    }
}
