//! Content & Exposure Discovery Adapters (Ars0n Capability Integration — Phase 5)

use std::time::Duration;
use crate::intelligence::observations::Observation;
use crate::intelligence::state::{FindingConfidence, FindingSeverity, ParamLocation};
use super::{AdapterOptions, RiskClassification, ToolAdapter, ToolCapability, ToolMetadata};

/// Ffuf adapter (Fast web fuzzer for directory and content discovery)
pub struct FfufAdapter;

impl ToolAdapter for FfufAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "ffuf",
            binary_name: "ffuf",
            description: "Fast web fuzzer for directory, endpoint, and hidden asset discovery",
            risk: RiskClassification::Medium,
            capabilities: vec![ToolCapability::DirectoryFuzzing],
            default_timeout: Duration::from_secs(60),
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

    fn build_arguments(&self, target: &str, options: &AdapterOptions) -> Vec<String> {
        let fuzz_url = if target.contains("FUZZ") {
            target.to_string()
        } else if target.ends_with('/') {
            format!("{}FUZZ", target)
        } else {
            format!("{}/FUZZ", target)
        };

        let wordlist = options
            .wordlist_path
            .clone()
            .unwrap_or_else(|| "/usr/share/seclists/Discovery/Web-Content/common.txt".to_string());

        let mut args = vec![
            "-u".to_string(),
            fuzz_url,
            "-w".to_string(),
            wordlist,
            "-mc".to_string(),
            "200,204,301,302,307,401,403".to_string(),
            "-s".to_string(),
            "-o".to_string(),
            "-".to_string(),
            "-of".to_string(),
            "json".to_string(),
        ];

        if let Some(rate) = options.max_rate_limit {
            args.push("-rate".to_string());
            args.push(rate.to_string());
        }

        for (k, v) in &options.custom_headers {
            args.push("-H".to_string());
            args.push(format!("{}: {}", k, v));
        }

        args
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        // Ffuf outputs a JSON object containing a "results" array
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(stdout) {
            if let Some(results) = v.get("results").and_then(|r| r.as_array()) {
                for item in results {
                    let url = item.get("url").and_then(|u| u.as_str()).unwrap_or(target);
                    let status = item.get("status").and_then(|s| s.as_u64()).map(|s| s as u16);
                    let length = item.get("length").and_then(|l| l.as_u64()).unwrap_or(0);
                    let words = item.get("words").and_then(|w| w.as_u64()).unwrap_or(0);
                    let input_word = item
                        .get("input")
                        .and_then(|inp| inp.get("FUZZ"))
                        .and_then(|w| w.as_str())
                        .unwrap_or("");

                    let host = url
                        .split("://")
                        .nth(1)
                        .unwrap_or(url)
                        .split('/')
                        .next()
                        .unwrap_or("unknown")
                        .to_string();

                    let path = if let Some(idx) = url.find(&host) {
                        let rest = &url[idx + host.len()..];
                        if rest.is_empty() { "/".to_string() } else { rest.to_string() }
                    } else {
                        format!("/{}", input_word)
                    };

                    let is_api = path.starts_with("/api")
                        || path.starts_with("/v1")
                        || path.starts_with("/v2")
                        || path.starts_with("/v3")
                        || path.contains("graphql");

                    if is_api {
                        obs.push(Observation::ApiEndpointDiscovered {
                            url: url.to_string(),
                            path: path.clone(),
                            method: "GET".to_string(),
                            version: if path.contains("/v1") {
                                Some("v1".to_string())
                            } else if path.contains("/v2") {
                                Some("v2".to_string())
                            } else {
                                None
                            },
                            auth_required: status == Some(401) || status == Some(403),
                            is_doc: path.contains("swagger") || path.contains("openapi") || path.contains("docs"),
                        });
                    }

                    obs.push(Observation::EndpointDiscovered {
                        url: url.to_string(),
                        host,
                        port: if url.starts_with("https://") { 443 } else { 80 },
                        path,
                        method: "GET".to_string(),
                        status_code: status,
                        content_type: None,
                    });

                    // If finding looks like an exposed config or database, emit a candidate
                    if input_word.contains(".env")
                        || input_word.contains(".git")
                        || input_word.contains("backup")
                        || input_word.contains("dump")
                    {
                        if status == Some(200) {
                            obs.push(Observation::VulnerabilityCandidate {
                                vuln_class: "Information Disclosure".to_string(),
                                title: format!("Potentially Exposed Sensitive Path: {}", input_word),
                                severity: FindingSeverity::High,
                                confidence: FindingConfidence::Tentative,
                                target: url.to_string(),
                                parameter: None,
                                payload: None,
                                evidence: format!(
                                    "Status: {:?}, Content-Length: {}, Words: {}",
                                    status, length, words
                                ),
                            });
                        }
                    }
                }
            }
        }
        obs
    }
}

/// Snallygaster adapter (Secret and sensitive file scanner on HTTP servers)
pub struct SnallygasterAdapter;

impl ToolAdapter for SnallygasterAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "snallygaster",
            binary_name: "snallygaster",
            description: "Scans HTTP server for secret files and sensitive leakages (.env, .git, config, backups)",
            risk: RiskClassification::Medium,
            capabilities: vec![ToolCapability::ExposureDetection],
            default_timeout: Duration::from_secs(45),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        let clean = target
            .trim_start_matches("http://")
            .trim_start_matches("https://")
            .trim_end_matches('/');

        vec![
            "--nowarn".to_string(),
            "--no-color".to_string(),
            clean.to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if trim.is_empty() {
                continue;
            }

            // Snallygaster lines look like:
            // "[VULNERABLE] Git repository found: http://target/.git/HEAD"
            // or "[FOUND] http://target/.env"
            let is_vulnerable = trim.contains("[VULNERABLE]") || trim.contains("VULNERABLE");
            let is_found = trim.contains("[FOUND]") || trim.contains("FOUND") || trim.contains("HTTP 200");

            if is_vulnerable || is_found {
                let severity = if trim.contains(".git") || trim.contains(".env") || trim.contains("id_rsa") {
                    FindingSeverity::High
                } else {
                    FindingSeverity::Medium
                };

                obs.push(Observation::VulnerabilityCandidate {
                    vuln_class: "Sensitive File Exposure".to_string(),
                    title: format!("Sensitive File Exposure Detected via Snallygaster: {}", trim),
                    severity,
                    confidence: FindingConfidence::Firm,
                    target: target.to_string(),
                    parameter: None,
                    payload: None,
                    evidence: trim.to_string(),
                });
            }
        }
        obs
    }
}

/// GitDumper adapter (Safely detects and verifies exposed .git repositories)
pub struct GitDumperAdapter;

impl ToolAdapter for GitDumperAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "git-dumper",
            binary_name: "git-dumper",
            description: "Verifies accessible .git repository endpoints and downloads git history",
            risk: RiskClassification::Medium,
            capabilities: vec![ToolCapability::ExposureDetection],
            default_timeout: Duration::from_secs(60),
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
        let git_url = if target.ends_with("/.git") || target.ends_with("/.git/") {
            target.to_string()
        } else if target.ends_with('/') {
            format!("{}.git", target)
        } else {
            format!("{}/.git", target)
        };

        vec![
            git_url,
            // Dry run / temp test path
            "/tmp/git-dump-test".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        let combined = format!("{}\n{}", stdout, _stderr);

        if combined.contains("Destination folder does not exist")
            || combined.contains("Fetching common files")
            || combined.contains("Found index")
            || combined.contains("ref: refs/heads")
        {
            obs.push(Observation::VulnerabilityCandidate {
                vuln_class: "Source Code Exposure".to_string(),
                title: "Exposed Git Repository (.git/ directory accessible)".to_string(),
                severity: FindingSeverity::Critical,
                confidence: FindingConfidence::Firm,
                target: target.to_string(),
                parameter: None,
                payload: Some("/.git/HEAD".to_string()),
                evidence: combined.lines().take(5).collect::<Vec<_>>().join(" | "),
            });
        }
        obs
    }
}

/// Arjun adapter (HTTP parameter discovery suite)
pub struct ArjunAdapter;

impl ToolAdapter for ArjunAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "arjun",
            binary_name: "arjun",
            description: "Finds hidden query, body, and JSON parameters for endpoints",
            risk: RiskClassification::Medium,
            capabilities: vec![ToolCapability::ParameterDiscovery],
            default_timeout: Duration::from_secs(60),
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
            "-u".to_string(),
            target.to_string(),
            "--json".to_string(),
            "-q".to_string(),
        ]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();

        // Arjun json output is a map of endpoint URL to list of discovered parameters
        // Example: {"https://example.com/api/test": ["debug", "redirect", "id"]}
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(stdout) {
            if let Some(obj) = val.as_object() {
                for (url, params_val) in obj {
                    if let Some(params) = params_val.as_array() {
                        for p in params {
                            if let Some(param_name) = p.as_str() {
                                obs.push(Observation::ParameterDiscovered {
                                    url: url.clone(),
                                    name: param_name.to_string(),
                                    location: ParamLocation::Query,
                                    reflected: false,
                                    reflection_context: None,
                                });
                            }
                        }
                    }
                }
            }
        }
        obs
    }
}
