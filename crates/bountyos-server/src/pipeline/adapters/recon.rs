//! Reconnaissance & OSINT Adapters (Ars0n Capability Integration — Phase 3)

use std::time::Duration;
use crate::intelligence::observations::Observation;
use super::{AdapterOptions, RiskClassification, ToolAdapter, ToolCapability, ToolMetadata};

/// Subfinder adapter (Passive subdomain enumeration)
pub struct SubfinderAdapter;

impl ToolAdapter for SubfinderAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "subfinder",
            binary_name: "subfinder",
            description: "Passive subdomain enumeration via diverse public data sources",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::SubdomainEnumeration],
            default_timeout: Duration::from_secs(60),
            requires_scope_validation: true,
            output_format: "jsonl",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target domain cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-d".to_string(),
            target.to_string(),
            "-silent".to_string(),
            "-json".to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                if let Some(host) = v.get("host").and_then(|h| h.as_str()) {
                    obs.push(Observation::SubdomainDiscovered {
                        subdomain: host.to_string(),
                        source: "subfinder".to_string(),
                    });
                }
            } else if !trim.is_empty() && !trim.starts_with('{') {
                obs.push(Observation::SubdomainDiscovered {
                    subdomain: trim.to_string(),
                    source: "subfinder".to_string(),
                });
            }
        }
        if obs.is_empty() && !target.is_empty() {
            obs.push(Observation::SubdomainDiscovered {
                subdomain: target.to_string(),
                source: "subfinder_seed".to_string(),
            });
        }
        obs
    }
}

/// Assetfinder adapter (Fast multi-source subdomain scraper)
pub struct AssetfinderAdapter;

impl ToolAdapter for AssetfinderAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "assetfinder",
            binary_name: "assetfinder",
            description: "Fast multi-source subdomain discovery from CertSpotter, HackerTarget, and archives",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::SubdomainEnumeration],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target domain cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec!["--subs-only".to_string(), target.to_string()]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if !trim.is_empty() {
                obs.push(Observation::SubdomainDiscovered {
                    subdomain: trim.to_string(),
                    source: "assetfinder".to_string(),
                });
            }
        }
        obs
    }
}

/// Sublist3r adapter (Python-based multi-engine OSINT scraper)
pub struct Sublist3rAdapter;

impl ToolAdapter for Sublist3rAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "sublist3r",
            binary_name: "sublist3r",
            description: "OSINT subdomain enumeration across search engines and Netcraft",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::SubdomainEnumeration],
            default_timeout: Duration::from_secs(45),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target domain cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec!["-d".to_string(), target.to_string(), "-n".to_string()]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if !trim.is_empty() && !trim.starts_with('[') && !trim.starts_with('_') && trim.contains('.') {
                obs.push(Observation::SubdomainDiscovered {
                    subdomain: trim.to_string(),
                    source: "sublist3r".to_string(),
                });
            }
        }
        obs
    }
}

/// Dnsx adapter (Fast DNS resolver and brute-forcer)
pub struct DnsxAdapter;

impl ToolAdapter for DnsxAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "dnsx",
            binary_name: "dnsx",
            description: "High-throughput DNS resolution, wildcard filtering, and IP mapping",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::DnsResolution],
            default_timeout: Duration::from_secs(20),
            requires_scope_validation: true,
            output_format: "jsonl",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target hostname cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-r".to_string(),
            "1.1.1.1,8.8.8.8".to_string(),
            "-silent".to_string(),
            "-a".to_string(),
            "-resp".to_string(),
            "-json".to_string(),
            "-d".to_string(),
            target.to_string(),
        ]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                let host = v.get("host").and_then(|h| h.as_str()).unwrap_or("");
                let mut ips = Vec::new();
                if let Some(arr) = v.get("a").and_then(|a| a.as_array()) {
                    for ip in arr {
                        if let Some(s) = ip.as_str() {
                            ips.push(s.to_string());
                        }
                    }
                }
                let mut cnames = Vec::new();
                if let Some(arr) = v.get("cname").and_then(|c| c.as_array()) {
                    for cn in arr {
                        if let Some(s) = cn.as_str() {
                            cnames.push(s.to_string());
                        }
                    }
                }

                if !host.is_empty() {
                    obs.push(Observation::DnsRecordDiscovered {
                        subdomain: host.to_string(),
                        ips: ips.clone(),
                        cnames,
                    });
                    for ip in ips {
                        obs.push(Observation::HostDiscovered {
                            host: host.to_string(),
                            ip: Some(ip),
                        });
                    }
                }
            }
        }
        obs
    }
}

/// Naabu adapter (Fast port scanner)
pub struct NaabuAdapter;

impl ToolAdapter for NaabuAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "naabu",
            binary_name: "naabu",
            description: "Fast SYN/connect port scanner for open service enumeration",
            risk: RiskClassification::Low,
            capabilities: vec![ToolCapability::PortScanning],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "jsonl",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target IP or hostname cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "-s".to_string(),
            "c".to_string(),
            "-Pn".to_string(),
            "-silent".to_string(),
            "-json".to_string(),
            "-r".to_string(),
            "1.1.1.1,8.8.8.8".to_string(),
            "-sr".to_string(),
            "-no-stdin".to_string(),
            "-host".to_string(),
            target.to_string(),
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                let host = v.get("host").and_then(|h| h.as_str()).unwrap_or(target);
                let port = v.get("port").and_then(|p| p.as_u64()).unwrap_or(0) as u16;
                if port > 0 {
                    obs.push(Observation::PortDiscovered {
                        host: host.to_string(),
                        port,
                        protocol: "tcp".to_string(),
                        service: None,
                        banner: None,
                    });
                }
            }
        }
        obs
    }
}

/// Httpx adapter (HTTP probing, TLS analysis, and technology detection)
pub struct HttpxAdapter;

impl ToolAdapter for HttpxAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "httpx",
            binary_name: "httpx",
            description: "HTTP web server probing, title extraction, status verification, and tech stack fingerprinting",
            risk: RiskClassification::Low,
            capabilities: vec![ToolCapability::HttpProbing],
            default_timeout: Duration::from_secs(20),
            requires_scope_validation: true,
            output_format: "jsonl",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target URL or host cannot be empty".to_string())
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
            "-status-code".to_string(),
            "-title".to_string(),
            "-tech-detect".to_string(),
            "-json".to_string(),
            "-u".to_string(),
            u,
        ]
    }

    fn parse_output(&self, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                let host = v.get("input").and_then(|i| i.as_str()).unwrap_or(target);
                let port = v.get("port").and_then(|p| p.as_u64()).unwrap_or(80) as u16;
                let status_code = v.get("status_code").and_then(|s| s.as_u64()).map(|s| s as u16);
                let title = v.get("title").and_then(|t| t.as_str()).map(|t| t.to_string());
                let mut techs = Vec::new();
                if let Some(arr) = v.get("tech").and_then(|t| t.as_array()) {
                    for t in arr {
                        if let Some(s) = t.as_str() {
                            techs.push(s.to_string());
                        }
                    }
                }

                obs.push(Observation::HttpServiceDiscovered {
                    host: host.to_string(),
                    port,
                    status_code,
                    banner: title,
                    technologies: techs,
                });
            }
        }
        obs
    }
}

/// GAU adapter (GetAllUrls historical archive miner)
pub struct GauAdapter;

impl ToolAdapter for GauAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "gau",
            binary_name: "gau",
            description: "Fetches known URLs from AlienVault, Wayback Machine, and Common Crawl",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::HistoricalUrlMining],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target domain cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![
            "--timeout".to_string(),
            "5".to_string(),
            "--retries".to_string(),
            "1".to_string(),
            target.to_string(),
        ]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if trim.starts_with("http://") || trim.starts_with("https://") {
                if let Some((url, host, port, path, params)) = crate::intelligence::observations::ObservationIngestion::parse_endpoint_url(trim) {
                    obs.push(Observation::EndpointDiscovered {
                        url: url.clone(),
                        host,
                        port,
                        path,
                        method: "GET".to_string(),
                        status_code: None,
                        content_type: None,
                    });
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

/// Waybackurls adapter (Wayback Machine historical URL miner)
pub struct WaybackurlsAdapter;

impl ToolAdapter for WaybackurlsAdapter {
    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "waybackurls",
            binary_name: "waybackurls",
            description: "Fetches historical URLs directly from the Wayback Machine index",
            risk: RiskClassification::Passive,
            capabilities: vec![ToolCapability::HistoricalUrlMining],
            default_timeout: Duration::from_secs(30),
            requires_scope_validation: true,
            output_format: "text",
        }
    }

    fn validate_target(&self, target: &str) -> Result<(), String> {
        if target.trim().is_empty() {
            Err("Target domain cannot be empty".to_string())
        } else {
            Ok(())
        }
    }

    fn build_arguments(&self, target: &str, _options: &AdapterOptions) -> Vec<String> {
        vec![target.to_string()]
    }

    fn parse_output(&self, _target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut obs = Vec::new();
        for line in stdout.lines() {
            let trim = line.trim();
            if trim.starts_with("http://") || trim.starts_with("https://") {
                if let Some((url, host, port, path, params)) = crate::intelligence::observations::ObservationIngestion::parse_endpoint_url(trim) {
                    obs.push(Observation::EndpointDiscovered {
                        url: url.clone(),
                        host,
                        port,
                        path,
                        method: "GET".to_string(),
                        status_code: None,
                        content_type: None,
                    });
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
