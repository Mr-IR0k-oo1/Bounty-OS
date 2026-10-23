//! Target Profile Model (v0.7)
//!
//! Normalized attack-surface profile derived strictly from observed evidence.
//! Used by the policy engine to select investigation policies and weight actions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::intelligence::archetype::TargetArchetype;

/// Authentication posture inferred from responses and challenges
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthenticationState {
    None,
    Unauthenticated,
    SessionCookie,
    BearerToken,
    BasicAuth,
    OAuthOrSso,
    Unknown,
}

impl AuthenticationState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Unauthenticated => "unauthenticated",
            Self::SessionCookie => "session_cookie",
            Self::BearerToken => "bearer_token",
            Self::BasicAuth => "basic_auth",
            Self::OAuthOrSso => "oauth_or_sso",
            Self::Unknown => "unknown",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "none" => Self::None,
            "unauthenticated" => Self::Unauthenticated,
            "session_cookie" => Self::SessionCookie,
            "bearer_token" => Self::BearerToken,
            "basic_auth" => Self::BasicAuth,
            "oauth_or_sso" => Self::OAuthOrSso,
            _ => Self::Unknown,
        }
    }
}

impl Default for AuthenticationState {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Normalized profile for a target investigation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TargetProfile {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub archetype: TargetArchetype,
    pub technologies: Vec<String>,
    pub exposed_services: Vec<String>,
    pub application_type: String,
    pub authentication_state: AuthenticationState,
    pub api_indicators: bool,
    pub javascript_heavy: bool,
    pub historical_url_density: f64,
    pub evidence: Vec<String>,
    pub confidence: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TargetProfile {
    pub fn new(
        investigation_id: Uuid,
        archetype: TargetArchetype,
        technologies: Vec<String>,
        exposed_services: Vec<String>,
        application_type: impl Into<String>,
        authentication_state: AuthenticationState,
        api_indicators: bool,
        javascript_heavy: bool,
        historical_url_density: f64,
        evidence: Vec<String>,
        confidence: f64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            investigation_id,
            archetype,
            technologies,
            exposed_services,
            application_type: application_type.into(),
            authentication_state,
            api_indicators,
            javascript_heavy,
            historical_url_density,
            evidence,
            confidence: confidence.clamp(0.0, 1.0),
            created_at: now,
            updated_at: now,
        }
    }

    /// Check if a technology matches (case-insensitive substring)
    pub fn has_technology(&self, name: &str) -> bool {
        let target = name.to_lowercase();
        self.technologies
            .iter()
            .any(|t| t.to_lowercase().contains(&target))
    }

    /// Check if an exposed service matches (case-insensitive)
    pub fn has_service(&self, svc: &str) -> bool {
        let target = svc.to_lowercase();
        self.exposed_services
            .iter()
            .any(|s| s.to_lowercase().contains(&target))
    }
}

/// Persist a TargetProfile to Postgres or in-memory fallback
pub async fn save_target_profile(
    state: &crate::state::AppState,
    profile: &TargetProfile,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if state.has_db() {
        let tech_val = serde_json::to_value(&profile.technologies).unwrap_or_default();
        let svcs_val = serde_json::to_value(&profile.exposed_services).unwrap_or_default();
        let ev_val = serde_json::to_value(&profile.evidence).unwrap_or_default();
        let arch_str = profile.archetype.as_str();
        let auth_str = profile.authentication_state.as_str();

        let _ = sqlx::query(
            r#"INSERT INTO investigation_target_profiles (
                id, investigation_id, archetype, technologies, exposed_services,
                application_type, authentication_state, api_indicators, javascript_heavy,
                historical_url_density, evidence, confidence, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (investigation_id) DO UPDATE SET
                archetype = EXCLUDED.archetype,
                technologies = EXCLUDED.technologies,
                exposed_services = EXCLUDED.exposed_services,
                application_type = EXCLUDED.application_type,
                authentication_state = EXCLUDED.authentication_state,
                api_indicators = EXCLUDED.api_indicators,
                javascript_heavy = EXCLUDED.javascript_heavy,
                historical_url_density = EXCLUDED.historical_url_density,
                evidence = EXCLUDED.evidence,
                confidence = EXCLUDED.confidence,
                updated_at = EXCLUDED.updated_at"#,
        )
        .bind(profile.id)
        .bind(profile.investigation_id)
        .bind(arch_str)
        .bind(tech_val)
        .bind(svcs_val)
        .bind(&profile.application_type)
        .bind(auth_str)
        .bind(profile.api_indicators)
        .bind(profile.javascript_heavy)
        .bind(profile.historical_url_density)
        .bind(ev_val)
        .bind(profile.confidence)
        .bind(profile.created_at)
        .bind(profile.updated_at)
        .execute(state.db())
        .await;
    }

    let mut in_mem = state.in_memory_target_profiles().write().await;
    if let Some(pos) = in_mem.iter().position(|p| p.investigation_id == profile.investigation_id) {
        in_mem[pos] = profile.clone();
    } else {
        in_mem.push(profile.clone());
    }

    Ok(())
}

/// Retrieve the persisted TargetProfile for an investigation
pub async fn get_target_profile(
    state: &crate::state::AppState,
    investigation_id: Uuid,
) -> Option<TargetProfile> {
    if state.has_db() {
        if let Ok(Some(row)) = sqlx::query(
            r#"SELECT id, investigation_id, archetype, technologies, exposed_services,
                      application_type, authentication_state, api_indicators, javascript_heavy,
                      historical_url_density, evidence, confidence, created_at, updated_at
               FROM investigation_target_profiles
               WHERE investigation_id = $1"#,
        )
        .bind(investigation_id)
        .fetch_optional(state.db())
        .await
        {
            use sqlx::Row;
            let arch_str: String = row.get("archetype");
            let auth_str: String = row.get("authentication_state");
            let tech_val: serde_json::Value = row.get("technologies");
            let svcs_val: serde_json::Value = row.get("exposed_services");
            let ev_val: serde_json::Value = row.get("evidence");

            let technologies: Vec<String> = serde_json::from_value(tech_val).unwrap_or_default();
            let exposed_services: Vec<String> = serde_json::from_value(svcs_val).unwrap_or_default();
            let evidence: Vec<String> = serde_json::from_value(ev_val).unwrap_or_default();

            return Some(TargetProfile {
                id: row.get("id"),
                investigation_id: row.get("investigation_id"),
                archetype: TargetArchetype::from_str(&arch_str),
                technologies,
                exposed_services,
                application_type: row.get("application_type"),
                authentication_state: AuthenticationState::from_str(&auth_str),
                api_indicators: row.get("api_indicators"),
                javascript_heavy: row.get("javascript_heavy"),
                historical_url_density: row.get("historical_url_density"),
                evidence,
                confidence: row.get("confidence"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
    }

    let in_mem = state.in_memory_target_profiles().read().await;
    in_mem.iter().find(|p| p.investigation_id == investigation_id).cloned()
}

