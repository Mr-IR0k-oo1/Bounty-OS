//! Authentication & Authorization Investigation Engine (Ars0n Capability Integration — Phase 8)
//!
//! Models identities, roles, sessions, and authorization boundaries.
//! Executes strictly scoped, evidence-driven comparative authorization testing (BOLA / IDOR).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::intelligence::observations::Observation;
use crate::intelligence::state::{FindingConfidence, FindingSeverity, ScopeBoundary};

/// Identity representation for multi-tenant and role testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub label: String,
    pub role: String,
    pub token: String,
    pub custom_headers: HashMap<String, String>,
}

impl Identity {
    pub fn new(label: impl Into<String>, role: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            role: role.into(),
            token: token.into(),
            custom_headers: HashMap::new(),
        }
    }

    /// Redacted token representation for safe logging and storage
    pub fn redacted_token(&self) -> String {
        let len = self.token.len();
        if len <= 8 {
            "***REDACTED***".to_string()
        } else {
            format!("{}...{} (len: {})", &self.token[..4], &self.token[len - 4..], len)
        }
    }
}

/// Discovered authorization boundary on an asset or endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationBoundary {
    pub endpoint: String,
    pub method: String,
    pub required_role: Option<String>,
    pub resource_identifier_param: Option<String>,
}

/// Result of comparative authorization testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthzTestResult {
    pub endpoint: String,
    pub subject_identity: String,
    pub target_resource: String,
    pub status_code: u16,
    pub bypass_detected: bool,
    pub evidence: String,
}

pub struct AuthzEngine;

impl AuthzEngine {
    /// Compares access permissions between two authorized identities.
    /// Tests if Subject B can access Resource A owned by Subject A.
    /// Strictly verifies ScopeBoundary before executing any request.
    pub async fn test_bola_access(
        client: &reqwest::Client,
        endpoint_template: &str,
        resource_id_a: &str,
        identity_b: &Identity,
        scope: &ScopeBoundary,
    ) -> Result<Option<Observation>, String> {
        // Render target URL with resource_id_a
        let target_url = endpoint_template.replace("{id}", resource_id_a);

        // Scope check gate
        if !scope.is_allowed(&target_url) {
            return Err(format!("Authorization test target '{}' is out of scope", target_url));
        }

        // Construct request with Identity B's credentials
        let mut req = client.get(&target_url);
        if !identity_b.token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", identity_b.token));
        }
        for (k, v) in &identity_b.custom_headers {
            req = req.header(k, v);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("HTTP request error during authz test: {}", e))?;

        let status = resp.status().as_u16();
        let body = resp
            .text()
            .await
            .unwrap_or_default();

        // Check if access was granted to foreign object without 401 or 403
        let is_unauthorized_access = status == 200 && (body.contains(resource_id_a) || body.len() > 100);

        if is_unauthorized_access {
            let obs = Observation::VulnerabilityCandidate {
                vuln_class: "Broken Object Level Authorization (BOLA/IDOR)".to_string(),
                title: format!("BOLA / IDOR: Identity '{}' accessed resource '{}'", identity_b.label, resource_id_a),
                severity: FindingSeverity::High,
                confidence: FindingConfidence::Firm,
                target: target_url.clone(),
                parameter: Some("resource_id".to_string()),
                payload: Some(resource_id_a.to_string()),
                evidence: format!(
                    "HTTP Status: 200 OK under foreign identity '{}' (Role: {}). Response excerpt: {}",
                    identity_b.label,
                    identity_b.role,
                    body.chars().take(200).collect::<String>()
                ),
            };
            Ok(Some(obs))
        } else {
            Ok(None)
        }
    }
}
