//! Strategic VulnLLM Layer (v0.5)
//!
//! Provides structured strategic reasoning over the attack surface graph.
//!
//! Architecture:
//! - `context`: Bounded strategic context extracted from investigation state.
//! - `hypothesis`: Explicit security hypothesis formulation (NOT findings).
//! - `prioritization`: Advisory investigation ranking combining LLM boost with empirical action-values.
//! - `validation`: Disagreement handling ensuring empirical proof always wins.

pub mod context;
pub mod hypothesis;
pub mod prioritization;
pub mod validation;

use std::collections::HashMap;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::intelligence::action_value::HistoricalToolStats;
use crate::intelligence::llm::context::StrategicContext;
use crate::intelligence::llm::hypothesis::{list_hypotheses, save_hypothesis, HypothesisEngine};
use crate::intelligence::llm::prioritization::{StrategicPrioritization, StrategicPrioritizer};
use crate::intelligence::state::InvestigationState;
use crate::models::action_outcome::ActionOutcome;
use crate::models::hypothesis::SecurityHypothesis;
use crate::state::AppState;

pub struct StrategicLlmEngine;

impl StrategicLlmEngine {
    /// Execute strategic analysis over current investigation state
    pub async fn analyze_state(
        app_state: &AppState,
        investigation_id: Uuid,
        state: &InvestigationState,
        outcomes: &[ActionOutcome],
        historical_stats: &HashMap<String, HistoricalToolStats>,
    ) -> (Vec<SecurityHypothesis>, StrategicPrioritization) {
        // 1. Build bounded strategic context
        let context = StrategicContext::build(investigation_id, state, outcomes, historical_stats);

        // 2. Formulate testable security hypotheses
        let mut hypotheses = HypothesisEngine::formulate_hypotheses(&context);

        // 3. If Ollama / VulnLLM client is available, attempt to prompt the model for supplementary reasoning
        if let Some(llm) = app_state.llm_client() {
            debug!("Invoking VulnLLM model for strategic hypothesis generation...");
            let messages = vec![
                serde_json::json!({
                    "role": "system",
                    "content": StrategicContext::system_prompt(),
                }),
                serde_json::json!({
                    "role": "user",
                    "content": context.user_prompt(),
                }),
            ];

            // If chat succeeds, log and supplement hypotheses; otherwise fallback gracefully
            match llm.chat(messages).await {
                Ok(output) => {
                    info!(
                        "VulnLLM responded: {} (Confidence: {:.2})",
                        output.finding_type, output.confidence
                    );
                    if !output.finding_type.is_empty() {
                        let llm_hypothesis = SecurityHypothesis::new(
                            investigation_id,
                            output.finding_type.to_lowercase(),
                            context.target.clone(),
                            output.reasoning_summary,
                            output.confidence,
                            vec!["xss_analysis".to_string(), "finding_verification".to_string()],
                            vec!["HTTP reflection probe confirmation".to_string()],
                        );
                        hypotheses.push(llm_hypothesis);
                    }
                }
                Err(err) => {
                    debug!("VulnLLM chat offline or timed out ({}); using heuristic strategic reasoning", err);
                }
            }
        }

        // 4. Persist newly formulated hypotheses to security_hypotheses table
        for h in &hypotheses {
            save_hypothesis(app_state, h).await;
        }

        // 5. Load complete active hypotheses set for prioritization
        let all_active_hypotheses = list_hypotheses(app_state, investigation_id).await;

        // 6. Generate advisory strategic prioritization
        let prioritization = StrategicPrioritizer::prioritize(&all_active_hypotheses);

        (all_active_hypotheses, prioritization)
    }
}
