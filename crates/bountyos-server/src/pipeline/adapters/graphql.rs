//! GraphQL Investigation Adapters (Ars0n Capability Integration — Phase 6)

use std::time::Duration;
use crate::intelligence::observations::Observation;
use crate::intelligence::state::{FindingConfidence, FindingSeverity};
use super::{AdapterOptions, RiskClassification, ToolAdapter, ToolCapability, ToolMetadata};

/// Graphw00f adapter (GraphQL engine fingerprinting and endpoint discovery)
pub struct Graphw00fAdapter;

impl ToolAdapter for Graphw00fAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "graphw00f",
            binary_name: "graphw00f",
            description: "Fingerprints GraphQL technologies (Apollo, Hasura, Yoga, Graphene) and endpoints",
            risk: RiskClassification::Low,
            capabilities: vec![ToolCapability::GraphqlIntrospection],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target URL cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-t".to_string(),
            target.to_string(),
            "-d".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        let mut detected_engine = None;
        let mut detected_endpoint = None;

        for line in stdout.lines() {
            let trim = line.trim();
            // Typical graphw00f output:
            // [*] Discovered GraphQL endpoint: http://target/graphql
            // [*] Identified technology: Apollo Server
            if trim.contains("Discovered GraphQL endpoint:") || trim.contains("Found GraphQL endpoint:") {
                if let Some(ep) = trim.split(':').nth(1) {
                    let ep_trim = ep.trim().split_whitespace().next().unwrap_or(target);
                    detected_endpoint = Some(ep_trim.to_string());
                }
            } else if trim.contains("Identified technology:") || trim.contains("Engine:") {
                if let Some(tech) = trim.split(':').nth(1) {
                    detected_engine = Some(tech.trim().to_string());
                }
            } else if trim.contains("Apollo") || trim.contains("Hasura") || trim.contains("GraphQL Yoga") || trim.contains("Graphene") {
                if detected_engine.is_none() {
                    detected_engine = Some(trim.to_string());
                }
            }
        }

        let endpoint_url = detected_endpoint.unwrap_or_else(|| {
            if target.contains("graphql") {
                target.to_string()
            } else {
                format!("{}/graphql", target.trim_end_matches('/'))
            }
        });

        obs.push(Observation::GraphqlDiscovered {
            endpoint: endpoint_url,
            engine: detected_engine,
            introspection_enabled: false,
            operations: Vec::new(),
        });

        obs
    }
}

/// Graphql-Cop adapter (GraphQL security auditor)
pub struct GraphqlCopAdapter;

impl ToolAdapter for GraphqlCopAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "graphql-cop",
            binary_name: "graphql-cop",
            description: "Security auditing for GraphQL endpoints (introspection, query batching, alias overloading)",
            risk: RiskClassification::Medium,
            capabilities: vec![ToolCapability::GraphqlSecurityCheck],
            default_timeout: Duration::from_secs(45),
            requires_scope_validation: true,
            output_format: "json",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target URL cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-t".to_string(),
            target.to_string(),
            "-f".to_string(),
            "json".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        let mut introspection = false;
        let mut operations = Vec::new();

        if let Ok(v) = serde_json::from_str::<serde_json::Value>(stdout) {
            let items = if let Some(arr) = v.as_array() {
                arr.clone()
            } else if let Some(findings) = v.get("findings").and_then(|f| f.as_array()) {
                findings.clone()
            } else {
                vec![v]
            };

            for item in items {
                let title = item.get("title").and_then(|t| t.as_str()).unwrap_or("GraphQL Misconfiguration");
                let description = item.get("description").and_then(|d| d.as_str()).unwrap_or("");
                let severity_str = item.get("severity").and_then(|s| s.as_str()).unwrap_or("MEDIUM").to_uppercase();

                let is_intro = title.to_lowercase().contains("introspection")
                    || description.to_lowercase().contains("introspection");

                if is_intro {
                    introspection = true;
                }

                if let Some(op) = item.get("operation").and_then(|o| o.as_str()) {
                    operations.push(op.to_string());
                }

                let severity = match severity_str.as_str() {
                    "CRITICAL" => FindingSeverity::Critical,
                    "HIGH" => FindingSeverity::High,
                    "LOW" => FindingSeverity::Low,
                    "INFO" => FindingSeverity::Info,
                    _ => FindingSeverity::Medium,
                };

                obs.push(Observation::VulnerabilityCandidate {
                    vuln_class: "GraphQL Security".to_string(),
                    title: format!("GraphQL: {}", title),
                    severity,
                    confidence: FindingConfidence::Firm,
                    target: target.to_string(),
                    parameter: None,
                    payload: None,
                    evidence: format!("{}: {}", title, description),
                });
            }
        } else {
            // Text fallback parsing
            for line in stdout.lines() {
                let trim = line.trim();
                if trim.contains("Introspection Query Enabled") || trim.contains("Introspection: ENABLED") {
                    introspection = true;
                    obs.push(Observation::VulnerabilityCandidate {
                        vuln_class: "GraphQL Security".to_string(),
                        title: "GraphQL Introspection Query Enabled".to_string(),
                        severity: FindingSeverity::Medium,
                        confidence: FindingConfidence::Confirmed,
                        target: target.to_string(),
                        parameter: None,
                        payload: Some("query { __schema { types { name } } }".to_string()),
                        evidence: trim.to_string(),
                    });
                } else if trim.contains("Query Batching Enabled") {
                    obs.push(Observation::VulnerabilityCandidate {
                        vuln_class: "GraphQL Security".to_string(),
                        title: "GraphQL Query Batching Enabled (DoS / Brute Force Risk)".to_string(),
                        severity: FindingSeverity::Low,
                        confidence: FindingConfidence::Firm,
                        target: target.to_string(),
                        parameter: None,
                        payload: None,
                        evidence: trim.to_string(),
                    });
                }
            }
        }

        obs.push(Observation::GraphqlDiscovered {
            endpoint: target.to_string(),
            engine: None,
            introspection_enabled: introspection,
            operations,
        });

        obs
    }
}
