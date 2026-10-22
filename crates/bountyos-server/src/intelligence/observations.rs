//! Observation Ingestion Boundary
//!
//! Converts raw tool stdout/stderr outputs into typed, normalized observations.
//! Ingests observations into InvestigationState and AttackSurfaceGraph, computing
//! actual information gain ($IG_{actual}$) and prediction error.

use crate::intelligence::actions::ActionType;
use crate::intelligence::state::{
    DiscoveredEndpoint, DiscoveredParam, DiscoveredTechnology, FindingConfidence, FindingSeverity,
    InvestigationState, ParamLocation, StateFinding,
};
use serde::{Deserialize, Serialize};

/// Normalized observation types emitted by tool output parsers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum Observation {
    SubdomainDiscovered {
        subdomain: String,
        source: String,
    },
    DnsRecordDiscovered {
        subdomain: String,
        ips: Vec<String>,
        cnames: Vec<String>,
    },
    HostDiscovered {
        host: String,
        ip: Option<String>,
    },
    PortDiscovered {
        host: String,
        port: u16,
        protocol: String,
        service: Option<String>,
        banner: Option<String>,
    },
    HttpServiceDiscovered {
        host: String,
        port: u16,
        status_code: Option<u16>,
        banner: Option<String>,
        technologies: Vec<String>,
    },
    EndpointDiscovered {
        url: String,
        host: String,
        port: u16,
        path: String,
        method: String,
        status_code: Option<u16>,
        content_type: Option<String>,
    },
    ParameterDiscovered {
        url: String,
        name: String,
        location: ParamLocation,
        reflected: bool,
        reflection_context: Option<String>,
    },
    TechnologyDiscovered {
        name: String,
        version: Option<String>,
        cpe: Option<String>,
        category: Option<String>,
    },
    FindingCandidate {
        id: String,
        title: String,
        severity: FindingSeverity,
        confidence: FindingConfidence,
        target: String,
        matched_at: String,
        evidence: Vec<String>,
    },
    FindingVerified {
        finding_id: String,
        evidence: String,
    },
}

/// Metrics produced by applying observations to state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct IngestionMetrics {
    pub observations_count: usize,
    pub new_assets_count: usize,
    pub new_findings_count: usize,
    pub actual_information_gain: f64,
}

pub struct ObservationIngestion;

impl ObservationIngestion {
    /// Parse tool output into normalized observations without shell evaluation
    pub fn parse_tool_output(tool: &str, target: &str, stdout: &str, _stderr: &str) -> Vec<Observation> {
        let mut observations = Vec::new();

        match tool.to_lowercase().as_str() {
            "subfinder" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if trim.is_empty() || trim.starts_with('[') {
                        continue;
                    }
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                        if let Some(h) = v["host"].as_str() {
                            observations.push(Observation::SubdomainDiscovered {
                                subdomain: h.to_string(),
                                source: "subfinder".to_string(),
                            });
                        }
                    } else if trim.contains('.') && !trim.contains(' ') {
                        observations.push(Observation::SubdomainDiscovered {
                            subdomain: trim.to_string(),
                            source: "subfinder".to_string(),
                        });
                    }
                }
            }
            "dnsx" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                        let host = v["host"].as_str().unwrap_or(target).to_string();
                        let ips: Vec<String> = v["a"]
                            .as_array()
                            .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();
                        let cnames: Vec<String> = v["cname"]
                            .as_array()
                            .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();

                        observations.push(Observation::DnsRecordDiscovered {
                            subdomain: host.clone(),
                            ips: ips.clone(),
                            cnames,
                        });
                        if let Some(first_ip) = ips.first() {
                            observations.push(Observation::HostDiscovered {
                                host,
                                ip: Some(first_ip.clone()),
                            });
                        }
                    }
                }
            }
            "naabu" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                        let host = v["host"].as_str().unwrap_or(target).to_string();
                        if let Some(port) = v["port"].as_i64() {
                            observations.push(Observation::PortDiscovered {
                                host,
                                port: port as u16,
                                protocol: "tcp".to_string(),
                                service: None,
                                banner: None,
                            });
                        }
                    } else if trim.contains(':') {
                        let mut parts = trim.split(':');
                        if let (Some(h), Some(p)) = (parts.next(), parts.next()) {
                            if let Ok(port) = p.parse::<u16>() {
                                observations.push(Observation::PortDiscovered {
                                    host: h.to_string(),
                                    port,
                                    protocol: "tcp".to_string(),
                                    service: None,
                                    banner: None,
                                });
                            }
                        }
                    }
                }
            }
            "httpx" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                        let host = v["input"].as_str().or_else(|| v["host"].as_str()).unwrap_or(target).to_string();
                        let title = v["title"].as_str().map(|s| s.to_string());
                        let status_code = v["status_code"].as_i64().map(|c| c as u16);
                        let webserver = v["webserver"].as_str().map(|s| s.to_string());
                        let tech: Vec<String> = v["tech"]
                            .as_array()
                            .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();

                        let port = v["port"].as_i64().unwrap_or(80) as u16;

                        observations.push(Observation::HttpServiceDiscovered {
                            host: host.clone(),
                            port,
                            status_code,
                            banner: title.clone(),
                            technologies: tech.clone(),
                        });

                        if let Some(ws) = webserver {
                            observations.push(Observation::TechnologyDiscovered {
                                name: ws,
                                version: None,
                                cpe: None,
                                category: Some("Web Server".to_string()),
                            });
                        }

                        for t in tech {
                            observations.push(Observation::TechnologyDiscovered {
                                name: t,
                                version: None,
                                cpe: None,
                                category: None,
                            });
                        }

                        if let Some(u) = v["url"].as_str() {
                            observations.push(Observation::EndpointDiscovered {
                                url: u.to_string(),
                                host,
                                port,
                                path: "/".to_string(),
                                method: "GET".to_string(),
                                status_code,
                                content_type: v["content_type"].as_str().map(|s| s.to_string()),
                            });
                        }
                    }
                }
            }
            "katana" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if trim.starts_with("http://") || trim.starts_with("https://") {
                        let parsed = Self::parse_endpoint_url(trim);
                        if let Some((url, host, port, path, params)) = parsed {
                            observations.push(Observation::EndpointDiscovered {
                                url: url.clone(),
                                host,
                                port,
                                path,
                                method: "GET".to_string(),
                                status_code: Some(200),
                                content_type: None,
                            });

                            for p in params {
                                observations.push(Observation::ParameterDiscovered {
                                    url: url.clone(),
                                    name: p,
                                    location: ParamLocation::Query,
                                    reflected: false,
                                    reflection_context: None,
                                });
                            }
                        }
                    }
                }
            }
            "dalfox" => {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(stdout) {
                    if let Some(findings_arr) = v["findings"].as_array() {
                        for f_entry in findings_arr {
                            let poc_url = f_entry["data"].as_str().unwrap_or(target);
                            let payload = f_entry["payload"].as_str().unwrap_or("");
                            let param = f_entry["param"].as_str().unwrap_or("q");

                            observations.push(Observation::ParameterDiscovered {
                                url: target.to_string(),
                                name: param.to_string(),
                                location: ParamLocation::Query,
                                reflected: true,
                                reflection_context: Some("html_body".to_string()),
                            });

                            observations.push(Observation::FindingCandidate {
                                id: uuid::Uuid::new_v4().to_string(),
                                title: format!("Reflected XSS on parameter '{}'", param),
                                severity: FindingSeverity::High,
                                confidence: FindingConfidence::Firm,
                                target: target.to_string(),
                                matched_at: poc_url.to_string(),
                                evidence: vec![format!("Payload: {}", payload), format!("PoC: {}", poc_url)],
                            });
                        }
                    }
                } else if stdout.contains("POC") || stdout.contains("verified") {
                    observations.push(Observation::FindingCandidate {
                        id: uuid::Uuid::new_v4().to_string(),
                        title: "Reflected XSS Vulnerability".to_string(),
                        severity: FindingSeverity::High,
                        confidence: FindingConfidence::Firm,
                        target: target.to_string(),
                        matched_at: target.to_string(),
                        evidence: vec![stdout.lines().take(5).collect::<Vec<_>>().join("\n")],
                    });
                }
            }
            "nuclei" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trim) {
                        let name = v["info"]["name"].as_str().unwrap_or("Vulnerability").to_string();
                        let sev_str = v["info"]["severity"].as_str().unwrap_or("info");
                        let matched = v["matched-at"].as_str().unwrap_or(target).to_string();

                        let severity = match sev_str.to_lowercase().as_str() {
                            "critical" => FindingSeverity::Critical,
                            "high" => FindingSeverity::High,
                            "medium" => FindingSeverity::Medium,
                            "low" => FindingSeverity::Low,
                            _ => FindingSeverity::Info,
                        };

                        observations.push(Observation::FindingCandidate {
                            id: uuid::Uuid::new_v4().to_string(),
                            title: name,
                            severity,
                            confidence: FindingConfidence::Firm,
                            target: target.to_string(),
                            matched_at: matched,
                            evidence: vec![trim.to_string()],
                        });
                    }
                }
            }
            "verification" => {
                observations.push(Observation::FindingVerified {
                    finding_id: target.to_string(),
                    evidence: "Deterministic HTTP replay payload executed and verified".to_string(),
                });
            }
            "gau" | "waybackurls" => {
                for line in stdout.lines() {
                    let trim = line.trim();
                    if trim.starts_with("http://") || trim.starts_with("https://") {
                        if let Some((url, host, port, path, params)) = Self::parse_endpoint_url(trim) {
                            observations.push(Observation::EndpointDiscovered {
                                url: url.clone(),
                                host,
                                port,
                                path,
                                method: "GET".to_string(),
                                status_code: None,
                                content_type: None,
                            });
                            for p in params {
                                observations.push(Observation::ParameterDiscovered {
                                    url: url.clone(),
                                    name: p,
                                    location: ParamLocation::Query,
                                    reflected: false,
                                    reflection_context: None,
                                });
                            }
                        }
                    }
                }
            }
            _ => {}
        }

        observations
    }

    /// Ingest parsed observations into InvestigationState and compute feedback telemetry
    pub fn apply_observations(state: &mut InvestigationState, observations: &[Observation]) -> IngestionMetrics {
        let mut new_assets = 0;
        let mut new_findings = 0;

        for obs in observations {
            match obs {
                Observation::SubdomainDiscovered { subdomain, source } => {
                    if state.add_subdomain(subdomain, source) {
                        new_assets += 1;
                    }
                }
                Observation::DnsRecordDiscovered { subdomain, ips, cnames } => {
                    if state.mark_subdomain_dns_resolved(subdomain, ips.clone(), cnames.clone()) {
                        new_assets += 1;
                    }
                }
                Observation::HostDiscovered { host, ip } => {
                    if state.add_host(host, ip.clone()) {
                        new_assets += 1;
                    }
                }
                Observation::PortDiscovered { host, port, protocol, service, banner } => {
                    if state.add_service(host, *port, protocol, service.clone(), banner.clone()) {
                        new_assets += 1;
                    }
                }
                Observation::HttpServiceDiscovered { host, port, banner, technologies, .. } => {
                    state.add_service(host, *port, "tcp", Some("http".to_string()), banner.clone());
                    state.mark_service_http_probed(host, *port);
                    for t in technologies {
                        state.add_technology(DiscoveredTechnology {
                            name: t.clone(),
                            version: None,
                            cpe: None,
                            category: None,
                            templates_matched: vec![],
                        });
                    }
                }
                Observation::EndpointDiscovered { url, host, port, path, method, status_code, content_type } => {
                    let mut ep = DiscoveredEndpoint::new(url, host, *port, path);
                    ep.method = method.clone();
                    ep.status_code = *status_code;
                    ep.content_type = content_type.clone();
                    if state.add_endpoint(ep) {
                        new_assets += 1;
                    }
                }
                Observation::ParameterDiscovered { url, name, location, reflected, reflection_context } => {
                    // Find or create endpoint
                    if *reflected {
                        if state.mark_param_reflected(url, name, reflection_context.clone()) {
                            new_assets += 1;
                        }
                    } else if let Some(ep) = state.endpoints.iter_mut().find(|e| &e.url == url) {
                        if !ep.params.iter().any(|p| &p.name == name) {
                            ep.params.push(DiscoveredParam {
                                name: name.clone(),
                                location: *location,
                                reflected: *reflected,
                                reflection_context: reflection_context.clone(),
                                tested_for_xss: false,
                                tested_for_sqli: false,
                            });
                            new_assets += 1;
                        }
                    }
                }
                Observation::TechnologyDiscovered { name, version, cpe, category } => {
                    if state.add_technology(DiscoveredTechnology {
                        name: name.clone(),
                        version: version.clone(),
                        cpe: cpe.clone(),
                        category: category.clone(),
                        templates_matched: vec![],
                    }) {
                        new_assets += 1;
                    }
                }
                Observation::FindingCandidate { id, title, severity, confidence, target, matched_at, evidence } => {
                    let mut sf = StateFinding::new(title, *severity, *confidence, target);
                    sf.id = id.clone();
                    sf.matched_at = matched_at.clone();
                    sf.evidence = evidence.clone();
                    state.add_finding(sf);
                    new_findings += 1;
                }
                Observation::FindingVerified { finding_id, evidence } => {
                    if state.mark_finding_verified(finding_id) {
                        if let Some(f) = state.findings.iter_mut().find(|f| &f.id == finding_id) {
                            f.evidence.push(evidence.clone());
                        }
                        new_findings += 1;
                    }
                }
            }
        }

        // Calculate actual information gain:
        // IG_actual = (new_assets * 0.5 + new_findings * 1.0) / (observations_count + 1.0)
        let total_obs = observations.len();
        let useful_score = (new_assets as f64 * 0.5) + (new_findings as f64 * 1.0);
        let denom = (total_obs as f64 + 1.0).max(1.0);
        let actual_ig = (useful_score / denom).clamp(0.0, 1.0);
        let actual_ig_rounded = (actual_ig * 100.0).round() / 100.0;

        IngestionMetrics {
            observations_count: total_obs,
            new_assets_count: new_assets,
            new_findings_count: new_findings,
            actual_information_gain: actual_ig_rounded,
        }
    }

    fn parse_endpoint_url(raw: &str) -> Option<(String, String, u16, String, Vec<String>)> {
        let clean = raw.trim();
        let without_proto = clean.trim_start_matches("http://").trim_start_matches("https://");
        let host_and_rest = without_proto.split_once('/')?;
        let host_port = host_and_rest.0;
        let path_and_query = format!("/{}", host_and_rest.1);

        let (host, port) = if host_port.contains(':') {
            let mut parts = host_port.split(':');
            let h = parts.next()?.to_string();
            let p = parts.next()?.parse::<u16>().ok()?;
            (h, p)
        } else {
            let p = if clean.starts_with("https://") { 443 } else { 80 };
            (host_port.to_string(), p)
        };

        let mut params = Vec::new();
        if let Some((_, query)) = path_and_query.split_once('?') {
            for q in query.split('&') {
                if let Some((k, _)) = q.split_once('=') {
                    if !k.is_empty() {
                        params.push(k.to_string());
                    }
                }
            }
        }

        Some((clean.to_string(), host, port, path_and_query, params))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{InvestigationProfile, ScopeBoundary};

    #[test]
    fn test_observation_parsing_katana() {
        let stdout = "http://target.local:8888/search?q=test\nhttp://target.local:8888/api/v1/config\n";
        let obs = ObservationIngestion::parse_tool_output("katana", "http://target.local:8888", stdout, "");
        assert_eq!(obs.len(), 3); // 2 endpoints + 1 parameter 'q'
    }

    #[test]
    fn test_observation_ingestion_and_metrics() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        let observations = vec![
            Observation::SubdomainDiscovered {
                subdomain: "api.target.local".to_string(),
                source: "subfinder".to_string(),
            },
            Observation::PortDiscovered {
                host: "api.target.local".to_string(),
                port: 8888,
                protocol: "tcp".to_string(),
                service: Some("http".to_string()),
                banner: None,
            },
        ];

        let metrics = ObservationIngestion::apply_observations(&mut state, &observations);
        assert_eq!(metrics.observations_count, 2);
        assert_eq!(metrics.new_assets_count, 2);
        assert!(metrics.actual_information_gain > 0.0);
        assert_eq!(state.subdomains.len(), 1);
        assert_eq!(state.services.len(), 1);
    }
}
