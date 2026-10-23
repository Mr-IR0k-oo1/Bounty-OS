//! "Help Me Learn" Education Layer (Ars0n Capability Integration — Phase 12)
//!
//! Provides pedagogical context, architectural rationale, and verification guidance
//! for researchers based on current investigation state.

use serde::{Deserialize, Serialize};
use crate::intelligence::state::InvestigationState;

/// Education lesson describing the current investigation state and next recommended learning action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EducationLesson {
    pub stage: String,
    pub current_surface_summary: String,
    pub recommended_action: String,
    pub reason: String,
    pub evidence_requirements: String,
    pub learning_objective: String,
}

pub struct EducationEngine;

impl EducationEngine {
    /// Generates structured learning lesson from current investigation state
    pub fn generate_lesson(state: &InvestigationState) -> EducationLesson {
        let subdomains_count = state.subdomains.len();
        let endpoints_count = state.endpoints.len();
        let params_count = state.endpoints.iter().map(|e| e.params.len()).sum::<usize>();
        let findings_count = state.findings.len();
        let unverified_findings = state.findings.iter().filter(|f| !f.verified).count();

        let current_surface_summary = format!(
            "{} subdomains, {} endpoints, {} parameters, {} findings ({} unverified)",
            subdomains_count, endpoints_count, params_count, findings_count, unverified_findings
        );

        if unverified_findings > 0 {
            EducationLesson {
                stage: "Vulnerability Verification".to_string(),
                current_surface_summary,
                recommended_action: "Execute deterministic probe verification on candidate findings".to_string(),
                reason: "Scanner candidates are empirical signals but may include false positives. Verification prevents submission of unproven reports.".to_string(),
                evidence_requirements: "Reproducible HTTP request/response showing execution or data leakage under controlled test payload.".to_string(),
                learning_objective: "Mastering the difference between heuristic scanner alerts and reproducible proof-of-concept evidence.".to_string(),
            }
        } else if endpoints_count > 0 && params_count > 0 {
            // Check if any parameter looks like an ID
            let has_id_param = state.endpoints.iter().flat_map(|e| &e.params).any(|p| {
                let n = p.name.to_lowercase();
                n == "id" || n.contains("user_id") || n.contains("account") || n.contains("doc")
            });

            if has_id_param {
                EducationLesson {
                    stage: "Authorization & Access Control Testing".to_string(),
                    current_surface_summary,
                    recommended_action: "Investigate authorization boundaries and test for BOLA / IDOR".to_string(),
                    reason: "Multiple discovered endpoints accept direct object references in query or path parameters.".to_string(),
                    evidence_requirements: "Side-by-side HTTP requests under two different authorized sessions (User A accessing User B's resource).".to_string(),
                    learning_objective: "Understand Broken Object Level Authorization (OWASP API1:2023) and how multi-tenant isolation fails.".to_string(),
                }
            } else {
                EducationLesson {
                    stage: "Endpoint & Parameter Analysis".to_string(),
                    current_surface_summary,
                    recommended_action: "Analyze discovered endpoints for input reflections and hidden parameters".to_string(),
                    reason: "Sufficient routes have been mapped. Input vectors should now be evaluated for reflection and validation flaws.".to_string(),
                    evidence_requirements: "Input reflection in HTML body, script block, or attribute context with appropriate delimiter analysis.".to_string(),
                    learning_objective: "Understanding context-dependent injection vectors (XSS, SSTI, SQLi).".to_string(),
                }
            }
        } else if subdomains_count > 0 {
            EducationLesson {
                stage: "Service Probing & Route Mining".to_string(),
                current_surface_summary,
                recommended_action: "Probe live HTTP services, spider JavaScript bundles, and mine historical URLs".to_string(),
                reason: "Subdomains have been discovered, but live web applications and API routes need to be enumerated.".to_string(),
                evidence_requirements: "HTTP status codes, server response headers, technologies, and route paths.".to_string(),
                learning_objective: "Understanding modern single-page application routing and API gateway architectures.".to_string(),
            }
        } else {
            EducationLesson {
                stage: "Passive Reconnaissance & OSINT".to_string(),
                current_surface_summary,
                recommended_action: "Run passive subdomain discovery across certificate transparency and public archives".to_string(),
                reason: "Broad reconnaissance maps the organization's external perimeter without generating target traffic.".to_string(),
                evidence_requirements: "Discovered FQDNs mapped to target root domain with data source provenance.".to_string(),
                learning_objective: "Mastering zero-touch passive reconnaissance and certificate transparency intelligence.".to_string(),
            }
        }
    }
}
