//! Attack Surface Coverage Model
//!
//! Assesses recon and testing coverage across targets, hosts, services, endpoints, and findings.
//! Identifies actionable coverage gaps to inform candidate action generation.

use crate::intelligence::state::InvestigationState;
use serde::{Deserialize, Serialize};

/// An identified gap in attack surface coverage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CoverageGap {
    pub gap_type: String,
    pub target: String,
    pub description: String,
    pub priority: f64,
}

impl CoverageGap {
    pub fn new(
        gap_type: impl Into<String>,
        target: impl Into<String>,
        description: impl Into<String>,
        priority: f64,
    ) -> Self {
        Self {
            gap_type: gap_type.into(),
            target: target.into(),
            description: description.into(),
            priority: (priority * 100.0).round() / 100.0,
        }
    }
}

/// Comprehensive coverage assessment report
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CoverageReport {
    pub overall_percentage: f64,
    pub subdomain_coverage: f64,
    pub dns_coverage: f64,
    pub port_coverage: f64,
    pub http_probe_coverage: f64,
    pub endpoint_coverage: f64,
    pub parameter_coverage: f64,
    pub verification_coverage: f64,
    pub gaps: Vec<CoverageGap>,
}

pub struct CoverageModel;

impl CoverageModel {
    /// Assess coverage of current investigation state
    pub fn assess(state: &InvestigationState) -> CoverageReport {
        let mut gaps = Vec::new();

        // 1. Subdomain coverage
        let (sub_cov, sub_gaps) = Self::assess_subdomains(state);
        gaps.extend(sub_gaps);

        // 2. DNS coverage
        let (dns_cov, dns_gaps) = Self::assess_dns(state);
        gaps.extend(dns_gaps);

        // 3. Port coverage
        let (port_cov, port_gaps) = Self::assess_ports(state);
        gaps.extend(port_gaps);

        // 4. HTTP Probe coverage
        let (http_cov, http_gaps) = Self::assess_http_probes(state);
        gaps.extend(http_gaps);

        // 5. Endpoint & Historical coverage
        let (ep_cov, ep_gaps) = Self::assess_endpoints(state);
        gaps.extend(ep_gaps);

        // 6. Parameter & Reflection coverage
        let (param_cov, param_gaps) = Self::assess_parameters(state);
        gaps.extend(param_gaps);

        // 7. Technology coverage
        let tech_gaps = Self::assess_technologies(state);
        gaps.extend(tech_gaps);

        // 8. Finding verification coverage
        let (verif_cov, verif_gaps) = Self::assess_findings(state);
        gaps.extend(verif_gaps);

        // Calculate weighted overall percentage
        let overall = (sub_cov * 0.15)
            + (dns_cov * 0.15)
            + (port_cov * 0.15)
            + (http_cov * 0.15)
            + (ep_cov * 0.15)
            + (param_cov * 0.10)
            + (verif_cov * 0.15);

        CoverageReport {
            overall_percentage: (overall * 100.0).round() / 100.0,
            subdomain_coverage: (sub_cov * 100.0).round() / 100.0,
            dns_coverage: (dns_cov * 100.0).round() / 100.0,
            port_coverage: (port_cov * 100.0).round() / 100.0,
            http_probe_coverage: (http_cov * 100.0).round() / 100.0,
            endpoint_coverage: (ep_cov * 100.0).round() / 100.0,
            parameter_coverage: (param_cov * 100.0).round() / 100.0,
            verification_coverage: (verif_cov * 100.0).round() / 100.0,
            gaps,
        }
    }

    fn assess_subdomains(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        if state.subdomains.is_empty() {
            if !state.has_executed_tool_on_target("subfinder", &state.target) {
                gaps.push(CoverageGap::new(
                    "missing_subdomains",
                    &state.target,
                    "No subdomains discovered yet for root target",
                    0.95,
                ));
            }
            (0.0, gaps)
        } else {
            (1.0, gaps)
        }
    }

    fn assess_dns(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        if state.subdomains.is_empty() {
            return (1.0, gaps);
        }
        let total = state.subdomains.len();
        let resolved = state.subdomains.iter().filter(|s| s.dns_resolved).count();
        let unresolved = total - resolved;

        if unresolved > 0 {
            for sub in state.unresolved_subdomains() {
                if !state.has_executed_tool_on_target("dnsx", &sub.subdomain) {
                    gaps.push(CoverageGap::new(
                        "unresolved_subdomains",
                        &sub.subdomain,
                        format!("Subdomain {} requires DNS resolution", sub.subdomain),
                        0.90,
                    ));
                }
            }
        }

        let ratio = if total > 0 { resolved as f64 / total as f64 } else { 1.0 };
        (ratio, gaps)
    }

    fn assess_ports(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        if state.hosts.is_empty() {
            return (0.0, gaps);
        }
        let total = state.hosts.len();
        let scanned = state.hosts.iter().filter(|h| h.ports_scanned).count();

        for host in state.unscanned_hosts() {
            if !state.has_executed_tool_on_target("naabu", &host.host) {
                gaps.push(CoverageGap::new(
                    "unscanned_ports",
                    &host.host,
                    format!("Host {} has no port coverage", host.host),
                    0.85,
                ));
            }
        }

        let ratio = scanned as f64 / total as f64;
        (ratio, gaps)
    }

    fn assess_http_probes(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        let http_services: Vec<_> = state.services.iter().filter(|s| s.is_likely_http()).collect();
        if http_services.is_empty() {
            return (1.0, gaps);
        }

        let probed = http_services.iter().filter(|s| s.http_probed).count();
        for svc in state.unprobed_http_services() {
            let target = format!("{}:{}", svc.host, svc.port);
            if !state.has_executed_tool_on_target("httpx", &target) {
                gaps.push(CoverageGap::new(
                    "unprobed_http_service",
                    target,
                    format!("HTTP service {}:{} lacks HTTP metadata and technology discovery", svc.host, svc.port),
                    0.80,
                ));
            }
        }

        let ratio = probed as f64 / http_services.len() as f64;
        (ratio, gaps)
    }

    fn assess_endpoints(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        let probed_services: Vec<_> = state.services.iter().filter(|s| s.http_probed).collect();

        if probed_services.is_empty() {
            // Check if root host has endpoints
            if state.endpoints.is_empty() && !state.has_executed_tool_on_target("katana", &state.target) {
                gaps.push(CoverageGap::new(
                    "missing_endpoint_coverage",
                    &state.target,
                    "Live web application has no endpoint coverage",
                    0.75,
                ));
                return (0.0, gaps);
            }
            return (1.0, gaps);
        }

        let mut covered_services = 0;
        for svc in &probed_services {
            let svc_url = format!("http://{}:{}", svc.host, svc.port);
            let has_endpoints = state.endpoints.iter().any(|e| e.host == svc.host && e.port == svc.port);
            if !has_endpoints && !state.has_executed_tool_on_target("katana", &svc_url) {
                gaps.push(CoverageGap::new(
                    "missing_endpoint_coverage",
                    svc_url,
                    format!("Service {}:{} lacks crawled endpoint coverage", svc.host, svc.port),
                    0.75,
                ));
            } else {
                covered_services += 1;
            }

            // Also check historical archive coverage
            let hist_target = format!("{}:{}", svc.host, svc.port);
            if !state.has_executed_tool_on_target("gau", &hist_target)
                && !state.has_executed_tool_on_target("waybackurls", &hist_target)
            {
                gaps.push(CoverageGap::new(
                    "missing_historical_coverage",
                    hist_target,
                    format!("Historical URL archive coverage absent for {}:{}", svc.host, svc.port),
                    0.65,
                ));
            }
        }

        let ratio = covered_services as f64 / probed_services.len() as f64;
        (ratio, gaps)
    }

    fn assess_parameters(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        let reflected_pairs = state.endpoints_with_reflected_params();

        for (ep, param) in reflected_pairs {
            if !state.has_executed_tool_on_target("dalfox", &ep.url) {
                gaps.push(CoverageGap::new(
                    "untested_reflected_parameter",
                    &ep.url,
                    format!("Parameterized endpoint with reflected parameter '{}' requires XSS testing", param.name),
                    0.92,
                ));
            }
        }

        (1.0, gaps)
    }

    fn assess_technologies(state: &InvestigationState) -> Vec<CoverageGap> {
        let mut gaps = Vec::new();
        for tech in &state.technologies {
            let label = if let Some(ref v) = tech.version {
                format!("{} {}", tech.name, v)
            } else {
                tech.name.clone()
            };

            let tech_target = state.target.clone();
            if !state.has_executed_tool_on_target("nuclei", &tech_target) {
                gaps.push(CoverageGap::new(
                    "unscanned_technology",
                    tech_target,
                    format!("Identified technology '{}' has matching vulnerability templates", label),
                    0.88,
                ));
                break; // One nuclei batch gap across target is sufficient
            }
        }
        gaps
    }

    fn assess_findings(state: &InvestigationState) -> (f64, Vec<CoverageGap>) {
        let mut gaps = Vec::new();
        if state.findings.is_empty() {
            return (1.0, gaps);
        }

        let total = state.findings.len();
        let verified = state.findings.iter().filter(|f| f.verified).count();

        for finding in state.unverified_high_confidence_findings() {
            if !state.has_executed_action("finding_verification", &finding.id) {
                gaps.push(CoverageGap::new(
                    "unverified_finding",
                    &finding.target,
                    format!("High-confidence finding '{}' requires deterministic verification", finding.title),
                    0.98,
                ));
            }
        }

        let ratio = verified as f64 / total as f64;
        (ratio, gaps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{InvestigationProfile, ScopeBoundary};

    #[test]
    fn test_coverage_assessment_empty_state() {
        let scope = ScopeBoundary::new();
        let state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);
        let report = CoverageModel::assess(&state);

        assert!(report.gaps.iter().any(|g| g.gap_type == "missing_subdomains"));
        assert!(report.gaps.iter().any(|g| g.gap_type == "unscanned_ports"));
    }
}
