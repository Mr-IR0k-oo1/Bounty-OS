//! JavaScript & Secret Intelligence Adapters (Ars0n Capability Integration — Phase 4)

use std::time::Duration;
use sha2::{Digest, Sha256};
use crate::intelligence::observations::Observation;
use super::{AdapterOptions, RiskClassification, ToolAdapter, ToolCapability, ToolMetadata};

/// Helper to redact sensitive credentials/tokens for safe UI/report display
pub fn redact_secret(val: &str) -> String {
    let len = val.len();
    if len <= 8 {
        "***REDACTED***".to_string()
    } else {
        let prefix = &val[..4];
        let suffix = &val[len - 4..];
        format!("{}...{} (len: {})", prefix, suffix, len)
    }
}

/// Helper to compute deterministic hash of a raw secret for deduplication without storing plaintext
pub fn hash_secret(val: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(val.as_bytes());
    hex::encode(hasher.finalize())
}

/// Katana adapter (Next-gen web crawler and JS parsing engine)
pub struct KatanaAdapter;

impl ToolAdapter for KatanaAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "katana",
            binary_name: "katana",
            description: "Crawls HTML and parses client-side JavaScript bundles to discover routes and parameters",
            risk: RiskClassification::Low,
            capabilities: vec![ToolCapability::WebCrawling, ToolCapability::JsEndpointExtraction],
            default_timeout: Duration::from_secs(45),
            requires_scope_validation: true,
            output_format: "jsonl",
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
        let u = if target.starts_with("http://") || target.starts_with("https://") {
            target.to_string()
        } else {
            format!("http://{}", target)
        };
        vec![
            "-silent".to_string(),
            "-d".to_string(),
            "2".to_string(),
            "-jc".to_string(), // parse JS files
            "-u".to_string(),
            u,
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if trim.starts_with("http://") || trim.starts_with("https://") {
                if let Some((url, host, port, path, params)) = crate::intelligence::observations::ObservationIngestion::parse_endpoint_url(trim) {
                    obs.push(Observation::EndpointDiscovered {
                        url: url.clone(),
                        host,
                        port,
                        path: path.clone(),
                        method: "GET".to_string(),
                        status_code: None,
                        content_type: None,
                    });
                    if path.ends_with(".js") || path.contains("bundle") || path.contains("chunk") {
                        obs.push(Observation::JavascriptEndpointDiscovered {
                            source_url: target.to_string(),
                            extracted_endpoint: url.clone(),
                            method: Some("GET".to_string()),
                        });
                    }
                    for p in params {
                        obs.push(Observation::ParameterDiscovered {
                            url: url.clone(),
                            name: p,
                            location: crate::intelligence::state::ParamLocation::Query,
                            reflected: false,
                            reflection_context: None,
                        });
                    }
                }
            }
        }
        obs
    }
}

/// LinkFinder adapter (Python AST endpoint parser for JavaScript source files)
pub struct LinkfinderAdapter;

impl ToolAdapter for LinkfinderAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "linkfinder",
            binary_name: "linkfinder",
            description: "Python script that discovers hidden endpoints and parameters in JavaScript files using AST parsing",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::JsEndpointExtraction],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target JS URL cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-i".to_string(),
            target.to_string(),
            "-o".to_string(),
            "cli".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if trim.starts_with('/') || trim.starts_with("http://") || trim.starts_with("https://") {
                obs.push(Observation::JavascriptEndpointDiscovered {
                    source_url: target.to_string(),
                    extracted_endpoint: trim.to_string(),
                    method: Some("GET".to_string()),
                });
            }
        }
        obs
    }
}

/// TruffleHog adapter (Verified credential and secret scanner)
pub struct TrufflehogAdapter;

impl ToolAdapter for TrufflehogAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "trufflehog",
            binary_name: "trufflehog",
            description: "Finds exposed API keys, private tokens, and credentials with active verification",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::SecretScanning],
            default_timeout: Duration::from_secs(60),
            requires_scope_validation: true,
            output_format: "jsonl",
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
            "filesystem".to_string(),
            target.to_string(),
            "--json".to_string(),
            "--no-verification=false".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                let detector = v.get("DetectorName").and_then(|d| d.as_str()).unwrap_or("API Key");
                let verified = v.get("Verified").and_then(|ver| ver.as_bool()).unwrap_or(false);
                let raw_val = v.get("Raw").and_then(|r| r.as_str()).unwrap_or("");
                let file_path = v.get("SourceName").and_then(|s| s.as_str()).unwrap_or(target);

                if !raw_val.is_empty() {
                    obs.push(Observation::SecretCandidateDiscovered {
                        target: target.to_string(),
                        secret_type: detector.to_string(),
                        redacted_value: redact_secret(raw_val),
                        raw_hash: hash_secret(raw_val),
                        file_path: file_path.to_string(),
                        line: None,
                        verified,
                    });
                }
            }
        }
        obs
    }
}

/// Mantra adapter (Secret and sensitive key extractor)
pub struct MantraAdapter;

impl ToolAdapter for MantraAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "mantra",
            binary_name: "mantra",
            description: "Fast secret and API key pattern scanner for endpoints and JavaScript bundles",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::SecretScanning],
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
        vec!["-u".to_string(), target.to_string()]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Some((kind, raw_val)) = trim.split_once(':') {
                let secret_type = kind.trim();
                let secret_val = raw_val.trim();
                if !secret_val.is_empty() {
                    obs.push(Observation::SecretCandidateDiscovered {
                        target: target.to_string(),
                        secret_type: secret_type.to_string(),
                        redacted_value: redact_secret(secret_val),
                        raw_hash: hash_secret(secret_val),
                        file_path: target.to_string(),
                        line: None,
                        verified: false,
                    });
                }
            }
        }
        obs
    }
}
