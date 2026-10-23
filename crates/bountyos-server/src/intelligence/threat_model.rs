//! Threat Modeling Engine (STRIDE) (Ars0n Capability Integration — Phase 11)
//!
//! Synthesizes attack surface state into formal STRIDE threat representations.
//! Strictly distinguishes between Observed, Inferred, Hypothesized, and Verified threats.

use serde::{Deserialize, Serialize};
use crate::intelligence::state::{FindingConfidence, InvestigationState};

/// STRIDE threat classification categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrideCategory {
    Spoofing,
    Tampering,
    Repudiation,
    InformationDisclosure,
    DenialOfService,
    ElevationOfPrivilege,
}

impl StrideCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Spoofing => "Spoofing",
            Self::Tampering => "Tampering",
            Self::Repudiation => "Repudiation",
            Self::InformationDisclosure => "Information Disclosure",
            Self::DenialOfService => "Denial of Service",
            Self::ElevationOfPrivilege => "Elevation of Privilege",
        }
    }
}

/// Verification lifecycle for threat modeling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreatStatus {
    /// Empirically observed via scanner or HTTP responses
    Observed,
    /// Derived logically from technology stack or endpoint semantics
    Inferred,
    /// Suggested by VulnLLM or heuristic rule
    Hypothesized,
    /// Proven reproducibly with deterministic probe evidence
    Verified,
}

/// Normalized threat item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatItem {
    pub asset: String,
    pub stride: StrideCategory,
    pub title: String,
    pub description: String,
    pub status: ThreatStatus,
    pub evidence: Vec<String>,
    pub mitigation: Option<String>,
}

pub struct ThreatModelEngine;

impl ThreatModelEngine {
    /// Generates structured STRIDE threat model from current investigation state
    pub fn generate_model(state: &InvestigationState) -> Vec<ThreatItem> {
        let mut threats = Vec::new();
        let target = &state.target;

        // 1. Evaluate Findings
        for finding in &state.findings {
            let (stride, default_mitigation) = if finding.title.contains("XSS") {
                (StrideCategory::Tampering, "Implement robust Context-Aware Output Encoding and Content-Security-Policy (CSP)")
            } else if finding.title.contains("SQL") || finding.title.contains("Command") {
                (StrideCategory::Tampering, "Enforce parameterized queries / prepared statements and strict input validation")
            } else if finding.title.contains("Exposure") || finding.title.contains("Git") || finding.title.contains("Secret") {
                (StrideCategory::InformationDisclosure, "Restrict access to sensitive resources and rotate exposed secrets")
            } else if finding.title.contains("BOLA") || finding.title.contains("IDOR") || finding.title.contains("403") {
                (StrideCategory::ElevationOfPrivilege, "Enforce server-side object-level authorization checks per tenant/user")
            } else {
                (StrideCategory::InformationDisclosure, "Review security controls and headers")
            };

            let status = if finding.verified || finding.confidence == FindingConfidence::Confirmed {
                ThreatStatus::Verified
            } else {
                ThreatStatus::Observed
            };

            threats.push(ThreatItem {
                asset: finding.target.clone(),
                stride,
                title: finding.title.clone(),
                description: format!("Discovered issue on target: {}. Evidence count: {}", finding.target, finding.evidence.len()),
                status,
                evidence: finding.evidence.clone(),
                mitigation: Some(default_mitigation.to_string()),
            });
        }

        // 2. Evaluate Endpoints & Architecture
        for ep in &state.endpoints {
            let path_lower = ep.path.to_lowercase();
            if path_lower.contains("admin") || path_lower.contains("internal") || path_lower.contains("dashboard") {
                threats.push(ThreatItem {
                    asset: ep.url.clone(),
                    stride: StrideCategory::ElevationOfPrivilege,
                    title: format!("Privileged Administrative Interface: {}", ep.path),
                    description: "Administrative endpoint exposed to network; potential for unauthorized access or privilege escalation.".to_string(),
                    status: ThreatStatus::Inferred,
                    evidence: vec![format!("Discovered HTTP {} endpoint at {}", ep.method, ep.path)],
                    mitigation: Some("Enforce multi-factor authentication, network ACLs, and strict RBAC".to_string()),
                });
            }

            if path_lower.contains("graphql") {
                threats.push(ThreatItem {
                    asset: ep.url.clone(),
                    stride: StrideCategory::DenialOfService,
                    title: "GraphQL Query Batching & Depth Abuse Risk".to_string(),
                    description: "GraphQL endpoints may permit nested query amplification and batch brute forcing.".to_string(),
                    status: ThreatStatus::Hypothesized,
                    evidence: vec![format!("GraphQL endpoint discovered at {}", ep.url)],
                    mitigation: Some("Disable introspection in production; implement query depth limiting and rate limiting".to_string()),
                });
            }
        }

        // 3. Evaluate Parameters for IDOR / SSRF
        for ep in &state.endpoints {
            for param in &ep.params {
                let p_lower = param.name.to_lowercase();
                if p_lower == "id" || p_lower == "user_id" || p_lower == "account_id" || p_lower == "doc_id" {
                    threats.push(ThreatItem {
                        asset: ep.url.clone(),
                        stride: StrideCategory::ElevationOfPrivilege,
                        title: format!("Object Identifier Parameter Tampering ({})", param.name),
                        description: "Direct object reference parameter identified; candidate for Broken Object Level Authorization.".to_string(),
                        status: ThreatStatus::Hypothesized,
                        evidence: vec![format!("Parameter '{}' located in {:?}", param.name, param.location)],
                        mitigation: Some("Validate caller ownership of referenced object on backend".to_string()),
                    });
                } else if p_lower == "url" || p_lower == "redirect" || p_lower == "dest" || p_lower == "next" {
                    threats.push(ThreatItem {
                        asset: ep.url.clone(),
                        stride: StrideCategory::Spoofing,
                        title: format!("URL Redirection / SSRF Risk via ({})", param.name),
                        description: "Parameter accepts external URL; potential open redirect or Server-Side Request Forgery.".to_string(),
                        status: ThreatStatus::Hypothesized,
                        evidence: vec![format!("URL parameter '{}' discovered", param.name)],
                        mitigation: Some("Enforce strict allowlist validation for destinations".to_string()),
                    });
                }
            }
        }

        if threats.is_empty() {
            threats.push(ThreatItem {
                asset: target.clone(),
                stride: StrideCategory::InformationDisclosure,
                title: "Initial Attack Surface Baseline".to_string(),
                description: "Baseline threat state while initial reconnaissance is actively populated.".to_string(),
                status: ThreatStatus::Hypothesized,
                evidence: vec!["Initial investigation initialization".to_string()],
                mitigation: Some("Continue passive reconnaissance and asset discovery".to_string()),
            });
        }

        threats
    }
}
