//! Target Prioritization & ROI Value Engine (Ars0n Capability Integration — Phase 13)
//!
//! Evaluates targets and candidate actions using an explainable multi-signal value model:
//! Score = Current Evidence + Historical Experience + Target Profile + Action Cost + Expected IG

use serde::{Deserialize, Serialize};
use crate::models::target_profile::TargetProfile;
use crate::intelligence::state::InvestigationState;

/// Explainable scoring breakdown for target prioritization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetPrioritizationScore {
    pub target: String,
    pub base_score: f64,
    pub endpoint_density_score: f64,
    pub parameter_richness_score: f64,
    pub technology_multiplier: f64,
    pub auth_boundary_bonus: f64,
    pub historical_experience_factor: f64,
    pub total_priority_score: f64,
    pub explanations: Vec<String>,
}

pub struct RoiEngine;

impl RoiEngine {
    /// Computes explainable target priority score
    pub fn prioritize_target(
        target: &str,
        state: &InvestigationState,
        profile: &TargetProfile,
        historical_win_rate: Option<f64>,
    ) -> TargetPrioritizationScore {
        let mut explanations = Vec::new();

        // 1. Base score
        let base_score = 10.0;
        explanations.push("Base investigation score: +10.0".to_string());

        // 2. Endpoint density
        let ep_count = state.endpoints.iter().filter(|e| e.url.contains(target) || e.host.contains(target)).count();
        let endpoint_density_score = (ep_count as f64 * 1.5).min(30.0);
        if ep_count > 0 {
            explanations.push(format!(
                "Discovered endpoints (count: {}): +{:.1} points",
                ep_count, endpoint_density_score
            ));
        }

        // 3. Parameter richness (attack surface for injections & BOLA)
        let param_count = state.endpoints.iter()
            .filter(|e| e.url.contains(target) || e.host.contains(target))
            .map(|e| e.params.len())
            .sum::<usize>();
        let parameter_richness_score = (param_count as f64 * 2.0).min(25.0);
        if param_count > 0 {
            explanations.push(format!(
                "Discovered parameters (count: {}): +{:.1} points",
                param_count, parameter_richness_score
            ));
        }

        // 4. Technology multiplier
        let tech_count = profile.technologies.len();
        let technology_multiplier = match profile.archetype.as_str() {
            "api" | "rest_api" | "microservice" => 1.3,
            "spa" | "modern_web" => 1.2,
            "monolith" => 1.1,
            _ => 1.0,
        };
        explanations.push(format!(
            "Archetype '{}' with {} identified technologies: {:.1}x multiplier",
            profile.archetype.as_str(), tech_count, technology_multiplier
        ));

        // 5. Auth boundary presence
        let auth_str = profile.authentication_state.as_str();
        let has_auth = auth_str != "none" && auth_str != "unknown" && auth_str != "unauthenticated";
        let auth_boundary_bonus = if has_auth {
            explanations.push("Authentication boundary verified: +15.0 points (High BOLA/Privilege-Escalation Potential)".to_string());
            15.0
        } else {
            0.0
        };

        // 6. Historical experience factor
        let mut historical_experience_factor = 0.0;
        if let Some(win_rate) = historical_win_rate {
            historical_experience_factor = (win_rate * 20.0).min(20.0);
            explanations.push(format!(
                "Global experience historical finding conversion ({:.1}%): +{:.1} points",
                win_rate * 100.0, historical_experience_factor
            ));
        }

        let raw_total = (base_score + endpoint_density_score + parameter_richness_score + auth_boundary_bonus + historical_experience_factor) * technology_multiplier;
        let total_priority_score = (raw_total * 10.0).round() / 10.0;

        TargetPrioritizationScore {
            target: target.to_string(),
            base_score,
            endpoint_density_score,
            parameter_richness_score,
            technology_multiplier,
            auth_boundary_bonus,
            historical_experience_factor,
            total_priority_score,
            explanations,
        }
    }
}
