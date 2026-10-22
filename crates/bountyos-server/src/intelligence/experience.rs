//! Global Experience Store & Cross-Run Telemetry (v0.6)
//!
//! Maintains cross-investigation empirical action values conditional on target archetype
//! and technology stack: V(a | archetype, technology, state).
//!
//! Provides:
//! - Continuous Bayesian-style updating: V_new = (n * V_old + V_obs) / (n + 1)
//! - Cross-run waste pruning (with minimum sample count safeguards: n < 10 no pruning, 10 <= n < 30 penalty, n >= 30 pruning)
//! - Exploration vs. Exploitation (epsilon-greedy & uncertainty bonus)
//! - Full provenance traceability (experience -> investigation -> action -> job -> evidence)

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::experience::{ExperienceAction, ExperienceProvenance, ExperienceProvenanceRecord};
use crate::models::action_outcome::ActionOutcome;
use crate::models::investigation_action::InvestigationAction;
use crate::intelligence::archetype::{ArchetypeClassification, TargetArchetype};
use crate::state::AppState;

/// Evaluated experience score for a candidate action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionExperienceEvaluation {
    pub raw_score: f64,
    pub experience_score: f64,
    pub empirical_value: f64,
    pub sample_count: i64,
    pub penalty: f64,
    pub exploration_bonus: f64,
    pub is_low_value: bool,
    pub is_pruned: bool,
    pub is_exploration: bool,
    pub reason: String,
}

pub struct GlobalExperienceStore;

impl GlobalExperienceStore {
    /// Ingest a completed action outcome into the global experience store with full Bayesian update
    pub async fn record_outcome(
        state: &AppState,
        investigation_id: Uuid,
        action: &InvestigationAction,
        outcome: &ActionOutcome,
        classification: &ArchetypeClassification,
    ) {
        let arch_str = classification.archetype.as_str();
        let tool = &action.tool;
        let action_type = &action.action_type;
        let observed_value = outcome.actual_value;
        let execution_time_ms = outcome.execution_time_ms as f64;
        let is_success = outcome.verification_result.unwrap_or(true);

        // 1. Update specific archetype entry
        let exp_id = Self::upsert_experience_entry(
            state,
            arch_str,
            "*",
            action_type,
            tool,
            observed_value,
            execution_time_ms,
            is_success,
            outcome,
        ).await;

        // 2. Also update universal wildcard archetype entry ('*')
        let _ = Self::upsert_experience_entry(
            state,
            "*",
            "*",
            action_type,
            tool,
            observed_value,
            execution_time_ms,
            is_success,
            outcome,
        ).await;

        // 3. Record provenance linkage
        if let Some(eid) = exp_id {
            Self::record_provenance(
                state,
                eid,
                investigation_id,
                action.id,
                outcome.id,
                observed_value,
                outcome.new_findings,
                outcome.confirmed_findings,
            ).await;
        }
    }

    /// Internal upsert helper for an experience entry
    async fn upsert_experience_entry(
        state: &AppState,
        archetype: &str,
        technology: &str,
        action_type: &str,
        tool: &str,
        observed_value: f64,
        execution_time_ms: f64,
        is_success: bool,
        outcome: &ActionOutcome,
    ) -> Option<Uuid> {
        let mut target_id = None;

        if state.has_db() {
            // Check if record exists in Postgres
            let existing = sqlx::query_as::<_, ExperienceAction>(
                r#"SELECT * FROM experience_actions 
                   WHERE archetype = $1 AND technology = $2 AND action_type = $3 AND tool = $4"#,
            )
            .bind(archetype)
            .bind(technology)
            .bind(action_type)
            .bind(tool)
            .fetch_optional(state.db())
            .await
            .ok()
            .flatten();

            if let Some(mut exp) = existing {
                exp.update_with_outcome(
                    observed_value,
                    execution_time_ms,
                    is_success,
                    outcome.new_assets,
                    outcome.new_endpoints,
                    outcome.new_parameters,
                    outcome.new_findings,
                    outcome.confirmed_findings,
                    outcome.false_positives,
                );

                let _ = sqlx::query(
                    r#"UPDATE experience_actions SET
                        actual_value = $1,
                        avg_execution_time_ms = $2,
                        total_new_assets = $3,
                        total_new_endpoints = $4,
                        total_new_parameters = $5,
                        total_new_findings = $6,
                        total_confirmed_findings = $7,
                        total_false_positives = $8,
                        success_rate = $9,
                        sample_count = $10,
                        updated_at = $11
                    WHERE id = $12"#,
                )
                .bind(exp.actual_value)
                .bind(exp.avg_execution_time_ms)
                .bind(exp.total_new_assets)
                .bind(exp.total_new_endpoints)
                .bind(exp.total_new_parameters)
                .bind(exp.total_new_findings)
                .bind(exp.total_confirmed_findings)
                .bind(exp.total_false_positives)
                .bind(exp.success_rate)
                .bind(exp.sample_count)
                .bind(exp.updated_at)
                .bind(exp.id)
                .execute(state.db())
                .await;

                target_id = Some(exp.id);
            } else {
                let mut new_exp = ExperienceAction::new(archetype, technology, action_type, tool, observed_value);
                new_exp.update_with_outcome(
                    observed_value,
                    execution_time_ms,
                    is_success,
                    outcome.new_assets,
                    outcome.new_endpoints,
                    outcome.new_parameters,
                    outcome.new_findings,
                    outcome.confirmed_findings,
                    outcome.false_positives,
                );

                let _ = sqlx::query(
                    r#"INSERT INTO experience_actions (
                        id, archetype, technology, action_type, tool, predicted_value, actual_value,
                        avg_execution_time_ms, total_new_assets, total_new_endpoints, total_new_parameters,
                        total_new_findings, total_confirmed_findings, total_false_positives,
                        success_rate, sample_count, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                    ) ON CONFLICT (archetype, technology, action_type, tool) DO NOTHING"#,
                )
                .bind(new_exp.id)
                .bind(&new_exp.archetype)
                .bind(&new_exp.technology)
                .bind(&new_exp.action_type)
                .bind(&new_exp.tool)
                .bind(new_exp.predicted_value)
                .bind(new_exp.actual_value)
                .bind(new_exp.avg_execution_time_ms)
                .bind(new_exp.total_new_assets)
                .bind(new_exp.total_new_endpoints)
                .bind(new_exp.total_new_parameters)
                .bind(new_exp.total_new_findings)
                .bind(new_exp.total_confirmed_findings)
                .bind(new_exp.total_false_positives)
                .bind(new_exp.success_rate)
                .bind(new_exp.sample_count)
                .bind(new_exp.created_at)
                .bind(new_exp.updated_at)
                .execute(state.db())
                .await;

                target_id = Some(new_exp.id);
            }
        }

        // In-memory update
        let mut lock = state.in_memory_experience().write().await;
        if let Some(pos) = lock.iter().position(|e| {
            e.archetype == archetype
                && e.technology == technology
                && e.action_type == action_type
                && e.tool == tool
        }) {
            lock[pos].update_with_outcome(
                observed_value,
                execution_time_ms,
                is_success,
                outcome.new_assets,
                outcome.new_endpoints,
                outcome.new_parameters,
                outcome.new_findings,
                outcome.confirmed_findings,
                outcome.false_positives,
            );
            if target_id.is_none() {
                target_id = Some(lock[pos].id);
            }
        } else {
            let mut new_exp = ExperienceAction::new(archetype, technology, action_type, tool, observed_value);
            new_exp.update_with_outcome(
                observed_value,
                execution_time_ms,
                is_success,
                outcome.new_assets,
                outcome.new_endpoints,
                outcome.new_parameters,
                outcome.new_findings,
                outcome.confirmed_findings,
                outcome.false_positives,
            );
            if target_id.is_none() {
                target_id = Some(new_exp.id);
            }
            lock.push(new_exp);
        }

        target_id
    }

    /// Record provenance linkage between learned value and source investigation/action
    async fn record_provenance(
        state: &AppState,
        experience_id: Uuid,
        investigation_id: Uuid,
        action_id: Uuid,
        outcome_id: Uuid,
        observed_value: f64,
        new_findings: i32,
        confirmed_findings: i32,
    ) {
        let prov = ExperienceProvenance {
            id: Uuid::new_v4(),
            experience_id,
            investigation_id,
            action_id: Some(action_id),
            outcome_id: Some(outcome_id),
            observed_value,
            new_findings,
            confirmed_findings,
            created_at: Utc::now(),
        };

        if state.has_db() {
            let _ = sqlx::query(
                r#"INSERT INTO experience_provenance (
                    id, experience_id, investigation_id, action_id, outcome_id, observed_value,
                    new_findings, confirmed_findings, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
            )
            .bind(prov.id)
            .bind(prov.experience_id)
            .bind(prov.investigation_id)
            .bind(prov.action_id)
            .bind(prov.outcome_id)
            .bind(prov.observed_value)
            .bind(prov.new_findings)
            .bind(prov.confirmed_findings)
            .bind(prov.created_at)
            .execute(state.db())
            .await;
        }

        let mut lock = state.in_memory_provenance().write().await;
        lock.push(prov);
    }

    /// Retrieve conditional experience for an action: V(a | archetype, technology)
    pub async fn get_conditional_experience(
        state: &AppState,
        archetype: TargetArchetype,
        technology: &str,
        action_type: &str,
        tool: &str,
    ) -> Option<ExperienceAction> {
        let arch_str = archetype.as_str();

        if state.has_db() {
            // 1. Try exact archetype + technology
            if let Ok(Some(exp)) = sqlx::query_as::<_, ExperienceAction>(
                r#"SELECT * FROM experience_actions 
                   WHERE archetype = $1 AND technology = $2 AND action_type = $3 AND tool = $4"#,
            )
            .bind(arch_str)
            .bind(technology)
            .bind(action_type)
            .bind(tool)
            .fetch_optional(state.db())
            .await
            {
                return Some(exp);
            }

            // 2. Try archetype + wildcard technology
            if let Ok(Some(exp)) = sqlx::query_as::<_, ExperienceAction>(
                r#"SELECT * FROM experience_actions 
                   WHERE archetype = $1 AND technology = '*' AND action_type = $2 AND tool = $3"#,
            )
            .bind(arch_str)
            .bind(action_type)
            .bind(tool)
            .fetch_optional(state.db())
            .await
            {
                return Some(exp);
            }

            // 3. Fallback to universal wildcard archetype
            if let Ok(Some(exp)) = sqlx::query_as::<_, ExperienceAction>(
                r#"SELECT * FROM experience_actions 
                   WHERE archetype = '*' AND action_type = $1 AND tool = $2"#,
            )
            .bind(action_type)
            .bind(tool)
            .fetch_optional(state.db())
            .await
            {
                return Some(exp);
            }
        }

        // In-memory fallback
        let lock = state.in_memory_experience().read().await;
        lock.iter()
            .find(|e| e.archetype == arch_str && e.technology == technology && e.action_type == action_type && e.tool == tool)
            .cloned()
            .or_else(|| {
                lock.iter()
                    .find(|e| e.archetype == arch_str && e.technology == "*" && e.action_type == action_type && e.tool == tool)
                    .cloned()
            })
            .or_else(|| {
                lock.iter()
                    .find(|e| e.archetype == "*" && e.action_type == action_type && e.tool == tool)
                    .cloned()
            })
    }

    /// Evaluate candidate action experience with pruning penalties and exploration safeguards
    pub fn evaluate_action(
        experience: Option<&ExperienceAction>,
        baseline_score: f64,
        exploration_epsilon: f64,
    ) -> ActionExperienceEvaluation {
        match experience {
            None => {
                // Completely new action: high exploration incentive
                let bonus = 0.12;
                ActionExperienceEvaluation {
                    raw_score: baseline_score,
                    experience_score: (baseline_score + bonus).clamp(0.0, 1.0),
                    empirical_value: 0.5,
                    sample_count: 0,
                    penalty: 0.0,
                    exploration_bonus: bonus,
                    is_low_value: false,
                    is_pruned: false,
                    is_exploration: true,
                    reason: "Zero historical samples: exploring novel action".to_string(),
                }
            }
            Some(exp) => {
                let n = exp.sample_count;
                let val = exp.actual_value;

                // Threshold rules:
                // n < 10 -> no pruning, uncertainty bonus
                // 10 <= n < 30 -> strong penalty if low value
                // n >= 30 -> eligible for pruning if low value
                let mut penalty = 0.0;
                let mut bonus = 0.0;
                let mut is_pruned = false;
                let mut is_low_value = false;
                let mut is_exploration = false;
                let mut reason = format!("Historical V(a)={:.2} over {} trials", val, n);

                if n < 10 {
                    // Critical rule: Never prune permanently on small samples
                    bonus = 0.10 / ((n as f64 + 1.0).sqrt());
                    reason = format!("Sample count {} < 10: pruning disabled, uncertainty bonus +{:.2}", n, bonus);
                } else if n < 30 {
                    if val < 0.20 {
                        penalty = 0.25;
                        is_low_value = true;
                        reason = format!("Sample count {} >= 10 and V(a)={:.2} < 0.20: applying penalty -{:.2}", n, val, penalty);
                    }
                } else {
                    // n >= 30: fully eligible for pruning
                    if val < 0.12 {
                        penalty = 0.40;
                        is_low_value = true;
                        is_pruned = true;
                        reason = format!("Sample count {} >= 30 and V(a)={:.2} < 0.12: marked LOW_VALUE and pruned", n, val);
                    }
                }

                // Epsilon-greedy exploration safeguard:
                // An action should never be permanently deleted; an epsilon exploration roll can un-prune it
                let roll = (val * 100.0) % 1.0; // deterministic pseudo-roll based on value
                if (roll < exploration_epsilon || exploration_epsilon >= 0.8) && is_pruned {
                    is_pruned = false;
                    is_exploration = true;
                    bonus += 0.20;
                    penalty = 0.0;
                    reason = format!("Epsilon-greedy exploration override (ε={:.2}): testing low-value action", exploration_epsilon);
                }

                let final_score = (baseline_score + (val - 0.5) * 0.20 + bonus - penalty).clamp(0.01, 1.0);

                ActionExperienceEvaluation {
                    raw_score: baseline_score,
                    experience_score: final_score,
                    empirical_value: val,
                    sample_count: n,
                    penalty,
                    exploration_bonus: bonus,
                    is_low_value,
                    is_pruned,
                    is_exploration,
                    reason,
                }
            }
        }
    }

    /// List all global experience actions
    pub async fn list_experience(state: &AppState) -> Vec<ExperienceAction> {
        if state.has_db() {
            if let Ok(records) = sqlx::query_as::<_, ExperienceAction>(
                "SELECT * FROM experience_actions ORDER BY sample_count DESC, actual_value DESC",
            )
            .fetch_all(state.db())
            .await
            {
                if !records.is_empty() {
                    return records;
                }
            }
        }

        let lock = state.in_memory_experience().read().await;
        lock.clone()
    }

    /// Query experience provenance audit records
    pub async fn get_provenance_audit(
        state: &AppState,
        archetype: Option<&str>,
        tool: Option<&str>,
    ) -> Vec<ExperienceProvenanceRecord> {
        if state.has_db() {
            let mut query = String::from(
                r#"SELECT p.id, p.experience_id, e.archetype, e.tool, e.action_type, 
                          p.investigation_id, p.action_id, p.outcome_id, p.observed_value, 
                          p.new_findings, p.confirmed_findings, p.created_at
                   FROM experience_provenance p
                   JOIN experience_actions e ON p.experience_id = e.id
                   WHERE 1=1"#
            );

            if let Some(a) = archetype {
                query.push_str(&format!(" AND e.archetype = '{}'", a.replace('\'', "''")));
            }
            if let Some(t) = tool {
                query.push_str(&format!(" AND e.tool = '{}'", t.replace('\'', "''")));
            }
            query.push_str(" ORDER BY p.created_at DESC LIMIT 50");

            if let Ok(rows) = sqlx::query_as::<_, ExperienceProvenance>(
                "SELECT * FROM experience_provenance ORDER BY created_at DESC LIMIT 50"
            )
            .fetch_all(state.db())
            .await
            {
                let mut results = Vec::new();
                for r in rows {
                    results.push(ExperienceProvenanceRecord {
                        id: r.id,
                        experience_id: r.experience_id,
                        archetype: archetype.unwrap_or("*").to_string(),
                        tool: tool.unwrap_or("tool").to_string(),
                        action_type: "investigation".to_string(),
                        investigation_id: r.investigation_id,
                        action_id: r.action_id,
                        outcome_id: r.outcome_id,
                        observed_value: r.observed_value,
                        new_findings: r.new_findings,
                        confirmed_findings: r.confirmed_findings,
                        created_at: r.created_at,
                    });
                }
                if !results.is_empty() {
                    return results;
                }
            }
        }

        // In-memory fallback
        let prov_lock = state.in_memory_provenance().read().await;
        let exp_lock = state.in_memory_experience().read().await;

        prov_lock.iter().map(|p| {
            let exp = exp_lock.iter().find(|e| e.id == p.experience_id);
            ExperienceProvenanceRecord {
                id: p.id,
                experience_id: p.experience_id,
                archetype: exp.map(|e| e.archetype.clone()).unwrap_or_else(|| "*".to_string()),
                tool: exp.map(|e| e.tool.clone()).unwrap_or_else(|| "tool".to_string()),
                action_type: exp.map(|e| e.action_type.clone()).unwrap_or_else(|| "action".to_string()),
                investigation_id: p.investigation_id,
                action_id: p.action_id,
                outcome_id: p.outcome_id,
                observed_value: p.observed_value,
                new_findings: p.new_findings,
                confirmed_findings: p.confirmed_findings,
                created_at: p.created_at,
            }
        }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_threshold_under_10_no_pruning() {
        let mut exp = ExperienceAction::new("rest_api", "*", "port_scan", "naabu", 0.05);
        exp.sample_count = 5;
        exp.actual_value = 0.05;

        let eval = GlobalExperienceStore::evaluate_action(Some(&exp), 0.70, 0.15);
        assert!(!eval.is_pruned, "Sample count < 10 must never be pruned");
        assert!(eval.exploration_bonus > 0.0, "Must have exploration bonus");
        assert_eq!(eval.penalty, 0.0);
    }

    #[test]
    fn test_sample_threshold_10_to_30_penalty() {
        let mut exp = ExperienceAction::new("rest_api", "*", "web_crawl", "katana", 0.10);
        exp.sample_count = 15;
        exp.actual_value = 0.10;

        let eval = GlobalExperienceStore::evaluate_action(Some(&exp), 0.70, 0.0);
        assert!(eval.is_low_value);
        assert!(!eval.is_pruned, "10 <= n < 30 receives penalty but is not pruned");
        assert_eq!(eval.penalty, 0.25);
    }

    #[test]
    fn test_sample_threshold_over_30_eligible_for_pruning() {
        let mut exp = ExperienceAction::new("rest_api", "*", "subdomain_enum", "subfinder", 0.04);
        exp.sample_count = 35;
        exp.actual_value = 0.04;

        let eval = GlobalExperienceStore::evaluate_action(Some(&exp), 0.70, 0.0);
        assert!(eval.is_low_value);
        assert!(eval.is_pruned, "n >= 30 with value < 0.12 must be pruned");
        assert_eq!(eval.penalty, 0.40);
    }

    #[test]
    fn test_epsilon_greedy_exploration_override() {
        let mut exp = ExperienceAction::new("rest_api", "*", "subdomain_enum", "subfinder", 0.04);
        exp.sample_count = 40;
        exp.actual_value = 0.04;

        // With high epsilon (1.0), exploration override must prevent pruning
        let eval = GlobalExperienceStore::evaluate_action(Some(&exp), 0.70, 1.0);
        assert!(!eval.is_pruned, "Exploration must override pruning");
        assert!(eval.is_exploration);
    }

    #[test]
    fn test_bayesian_running_average_updating() {
        let mut exp = ExperienceAction::new("rest_api", "*", "content_discovery", "ffuf", 0.50);
        assert_eq!(exp.sample_count, 0);

        // Update 1: observed 1.0
        exp.update_with_outcome(1.0, 500.0, true, 2, 5, 1, 0, 0, 0);
        assert_eq!(exp.sample_count, 1);
        assert!((exp.actual_value - 1.0).abs() < 1e-4);

        // Update 2: observed 0.0
        exp.update_with_outcome(0.0, 500.0, true, 0, 0, 0, 0, 0, 0);
        assert_eq!(exp.sample_count, 2);
        assert!((exp.actual_value - 0.5).abs() < 1e-4);
    }
}
