//! Investigation State Model
//!
//! Represents the complete, typed state of a bug bounty investigation.
//! Tracks attack surface entities (subdomains, hosts, services, endpoints, parameters, technologies),
//! findings, executed actions, budget constraints, and stop conditions.
//!
//! The intelligence layer does NOT execute commands; it uses this state to reason about
//! coverage, uncertainty, and next planned actions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Scope boundary definition for an investigation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ScopeBoundary {
    #[serde(default)]
    pub domains: Vec<String>,
    #[serde(default)]
    pub ips: Vec<String>,
    #[serde(default)]
    pub wildcards: Vec<String>,
    #[serde(default)]
    pub excluded_hosts: Vec<String>,
}

impl ScopeBoundary {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check whether a candidate hostname or IP is strictly within the allowed scope
    pub fn is_allowed(&self, candidate: &str) -> bool {
        let cleaned = candidate
            .trim()
            .trim_start_matches("http://")
            .trim_start_matches("https://");
        let host = cleaned.split(':').next().unwrap_or("").split('/').next().unwrap_or("").trim();

        if host.is_empty() {
            return false;
        }

        // 1. Explicit exclusions always deny
        for exc in &self.excluded_hosts {
            let exc_clean = exc.trim().to_lowercase();
            if host.eq_ignore_ascii_case(&exc_clean) {
                return false;
            }
            if exc_clean.starts_with("*.") {
                let suffix = &exc_clean[1..]; // .example.com
                if host.to_lowercase().ends_with(suffix) {
                    return false;
                }
            }
        }

        // If no explicit inclusion rules are defined, allow by default if not excluded
        if self.domains.is_empty() && self.ips.is_empty() && self.wildcards.is_empty() {
            return true;
        }

        // 2. Exact domain match
        for d in &self.domains {
            let d_clean = d.trim().trim_start_matches("http://").trim_start_matches("https://");
            let d_host = d_clean.split(':').next().unwrap_or("").split('/').next().unwrap_or("").trim();
            if host.eq_ignore_ascii_case(d_host) || host.eq_ignore_ascii_case(d.trim()) {
                return true;
            }
        }

        // 3. Exact IP match
        for ip in &self.ips {
            if host.eq_ignore_ascii_case(ip.trim()) {
                return true;
            }
        }

        // 4. Wildcard matching (*.example.com)
        for w in &self.wildcards {
            let w_clean = w.trim().to_lowercase();
            if w_clean.starts_with("*.") {
                let suffix = &w_clean[1..]; // .example.com
                let host_lower = host.to_lowercase();
                if host_lower.ends_with(suffix) {
                    return true;
                }
                let base_domain = &w_clean[2..]; // example.com
                if host_lower == base_domain {
                    return true;
                }
            } else if host.eq_ignore_ascii_case(&w_clean) {
                return true;
            }
        }

        false
    }
}

/// Scan profile for the investigation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InvestigationProfile {
    Passive,
    Standard,
    Deep,
    Adaptive,
    Fixed,
    Strategic,
    Policy,
}

impl Default for InvestigationProfile {
    fn default() -> Self {
        InvestigationProfile::Standard
    }
}

/// Investigation lifecycle status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InvestigationStatus {
    Pending,
    Active,
    Paused,
    Completed,
    Stopped,
    Cancelled,
}

impl Default for InvestigationStatus {
    fn default() -> Self {
        InvestigationStatus::Pending
    }
}

/// Parameter location in HTTP request
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ParamLocation {
    Query,
    Body,
    Header,
    Cookie,
    Path,
}

/// Parameter discovered on an endpoint
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredParam {
    pub name: String,
    pub location: ParamLocation,
    pub reflected: bool,
    pub reflection_context: Option<String>,
    pub tested_for_xss: bool,
    pub tested_for_sqli: bool,
}

/// Endpoint / URL discovered on the attack surface
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredEndpoint {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub path: String,
    pub method: String,
    pub params: Vec<DiscoveredParam>,
    pub status_code: Option<u16>,
    pub content_type: Option<String>,
    pub technologies: Vec<String>,
    pub crawled: bool,
    pub historical: bool,
    pub fuzzed: bool,
    pub first_seen: DateTime<Utc>,
}

impl DiscoveredEndpoint {
    pub fn new(url: impl Into<String>, host: impl Into<String>, port: u16, path: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            host: host.into(),
            port,
            path: path.into(),
            method: "GET".to_string(),
            params: Vec::new(),
            status_code: None,
            content_type: None,
            technologies: Vec::new(),
            crawled: false,
            historical: false,
            fuzzed: false,
            first_seen: Utc::now(),
        }
    }

    pub fn has_parameters(&self) -> bool {
        !self.params.is_empty()
    }

    pub fn has_reflected_parameters(&self) -> bool {
        self.params.iter().any(|p| p.reflected)
    }
}

/// Discovered network service running on a host
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredService {
    pub host: String,
    pub port: u16,
    pub protocol: String,
    pub service_name: Option<String>,
    pub banner: Option<String>,
    pub http_probed: bool,
    pub first_seen: DateTime<Utc>,
}

impl DiscoveredService {
    pub fn new(host: impl Into<String>, port: u16, protocol: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            port,
            protocol: protocol.into(),
            service_name: None,
            banner: None,
            http_probed: false,
            first_seen: Utc::now(),
        }
    }

    pub fn is_likely_http(&self) -> bool {
        let name_match = self
            .service_name
            .as_deref()
            .map(|s| s.contains("http") || s.contains("web") || s.contains("ssl"))
            .unwrap_or(false);
        let port_match = matches!(self.port, 80 | 443 | 8000 | 8080 | 8443 | 8888 | 9000 | 3000 | 5000);
        name_match || port_match
    }
}

/// Discovered host (IP or domain name)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredHost {
    pub host: String,
    pub ip: Option<String>,
    pub ports_scanned: bool,
    pub first_seen: DateTime<Utc>,
}

impl DiscoveredHost {
    pub fn new(host: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            ip: None,
            ports_scanned: false,
            first_seen: Utc::now(),
        }
    }
}

/// Subdomain discovered during reconnaissance
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredSubdomain {
    pub subdomain: String,
    pub discovered_by: String,
    pub dns_resolved: bool,
    pub ips: Vec<String>,
    pub cnames: Vec<String>,
    pub first_seen: DateTime<Utc>,
}

impl DiscoveredSubdomain {
    pub fn new(subdomain: impl Into<String>, discovered_by: impl Into<String>) -> Self {
        Self {
            subdomain: subdomain.into(),
            discovered_by: discovered_by.into(),
            dns_resolved: false,
            ips: Vec::new(),
            cnames: Vec::new(),
            first_seen: Utc::now(),
        }
    }
}

/// Technology or stack component detected
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscoveredTechnology {
    pub name: String,
    pub version: Option<String>,
    pub cpe: Option<String>,
    pub category: Option<String>,
    pub templates_matched: Vec<String>,
}

/// Finding severity level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum FindingSeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

/// Finding confidence level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum FindingConfidence {
    Tentative,
    Firm,
    Confirmed,
}

/// Vulnerability finding candidate or validated result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFinding {
    pub id: String,
    pub title: String,
    pub severity: FindingSeverity,
    pub confidence: FindingConfidence,
    pub target: String,
    pub matched_at: String,
    pub verified: bool,
    pub evidence: Vec<String>,
    pub cve_id: Option<String>,
    pub first_seen: DateTime<Utc>,
}

impl StateFinding {
    pub fn new(
        title: impl Into<String>,
        severity: FindingSeverity,
        confidence: FindingConfidence,
        target: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            title: title.into(),
            severity,
            confidence,
            target: target.into(),
            matched_at: String::new(),
            verified: confidence == FindingConfidence::Confirmed,
            evidence: Vec::new(),
            cve_id: None,
            first_seen: Utc::now(),
        }
    }
}

/// Execution record of a completed action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutedActionRecord {
    pub action_type: String,
    pub tool: String,
    pub target: String,
    pub executed_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub success: bool,
    pub details: Option<String>,
}

/// Investigation budget and constraints
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvestigationBudget {
    pub max_actions: usize,
    pub current_actions: usize,
    pub max_duration_seconds: u64,
    pub started_at: Option<DateTime<Utc>>,
    pub max_risk_level: f64,
    pub action_counts_by_tool: HashMap<String, usize>,
}

impl Default for InvestigationBudget {
    fn default() -> Self {
        Self {
            max_actions: 50,
            current_actions: 0,
            max_duration_seconds: 3600,
            started_at: None,
            max_risk_level: 0.8,
            action_counts_by_tool: HashMap::new(),
        }
    }
}

/// Explicit stop condition reasons
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "reason")]
pub enum StopReason {
    NoLegalActions,
    BudgetExhausted(String),
    CoverageSufficient,
    BestActionScoreTooLow { score: f64, threshold: f64 },
    InvestigationCancelled(String),
    MaxFindingsReached(usize),
}

/// Complete investigation state model
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvestigationState {
    pub id: String,
    pub target: String,
    pub scope: ScopeBoundary,
    pub profile: InvestigationProfile,
    pub status: InvestigationStatus,
    pub subdomains: Vec<DiscoveredSubdomain>,
    pub hosts: Vec<DiscoveredHost>,
    pub services: Vec<DiscoveredService>,
    pub endpoints: Vec<DiscoveredEndpoint>,
    pub technologies: Vec<DiscoveredTechnology>,
    pub findings: Vec<StateFinding>,
    pub executed_actions: Vec<ExecutedActionRecord>,
    pub budget: InvestigationBudget,
    pub stop_reason: Option<StopReason>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl InvestigationState {
    /// Initialize a new investigation state for a given root target
    pub fn new(target: impl Into<String>, scope: ScopeBoundary, profile: InvestigationProfile) -> Self {
        let now = Utc::now();
        let target_str = target.into();

        let mut hosts = Vec::new();
        // Seed initial host from target
        let clean_host = target_str
            .trim_start_matches("http://")
            .trim_start_matches("https://")
            .split(':')
            .next()
            .unwrap_or("")
            .split('/')
            .next()
            .unwrap_or("")
            .to_string();

        if !clean_host.is_empty() {
            hosts.push(DiscoveredHost::new(clean_host));
        }

        Self {
            id: Uuid::new_v4().to_string(),
            target: target_str,
            scope,
            profile,
            status: InvestigationStatus::Pending,
            subdomains: Vec::new(),
            hosts,
            services: Vec::new(),
            endpoints: Vec::new(),
            technologies: Vec::new(),
            findings: Vec::new(),
            executed_actions: Vec::new(),
            budget: InvestigationBudget::default(),
            stop_reason: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Check if target string or url is in-scope
    pub fn is_in_scope(&self, candidate: &str) -> bool {
        self.scope.is_allowed(candidate)
    }

    /// Check whether subdomains have been discovered
    pub fn has_subdomains(&self) -> bool {
        !self.subdomains.is_empty()
    }

    /// Subdomains that have not yet had DNS resolution performed
    pub fn unresolved_subdomains(&self) -> Vec<&DiscoveredSubdomain> {
        self.subdomains.iter().filter(|s| !s.dns_resolved).collect()
    }

    /// Hosts that have had DNS resolution or are known, but have not undergone port scanning
    pub fn unscanned_hosts(&self) -> Vec<&DiscoveredHost> {
        self.hosts.iter().filter(|h| !h.ports_scanned).collect()
    }

    /// Discovered services that are likely HTTP/HTTPS and have not yet been probed with httpx
    pub fn unprobed_http_services(&self) -> Vec<&DiscoveredService> {
        self.services
            .iter()
            .filter(|s| s.is_likely_http() && !s.http_probed)
            .collect()
    }

    /// Endpoints that have not yet been crawled for deep endpoints
    pub fn endpoints_needing_crawl(&self) -> Vec<&DiscoveredEndpoint> {
        self.endpoints.iter().filter(|e| !e.crawled).collect()
    }

    /// Discovered endpoints with reflected query or body parameters
    pub fn endpoints_with_reflected_params(&self) -> Vec<(&DiscoveredEndpoint, &DiscoveredParam)> {
        let mut results = Vec::new();
        for ep in &self.endpoints {
            for param in &ep.params {
                if param.reflected && !param.tested_for_xss {
                    results.push((ep, param));
                }
            }
        }
        results
    }

    /// Findings with high or critical confidence that need explicit verification
    pub fn unverified_high_confidence_findings(&self) -> Vec<&StateFinding> {
        self.findings
            .iter()
            .filter(|f| !f.verified && (f.confidence == FindingConfidence::Firm || f.confidence == FindingConfidence::Confirmed))
            .collect()
    }

    /// Check whether an action of a given type and target has already been executed
    pub fn has_executed_action(&self, action_type: &str, target: &str) -> bool {
        let target_norm = target.trim().to_lowercase();
        self.executed_actions.iter().any(|a| {
            a.action_type.eq_ignore_ascii_case(action_type) && a.target.trim().to_lowercase() == target_norm
        })
    }

    /// Check whether a specific tool has run against a specific target
    pub fn has_executed_tool_on_target(&self, tool: &str, target: &str) -> bool {
        let target_norm = target.trim().to_lowercase();
        self.executed_actions.iter().any(|a| {
            a.tool.eq_ignore_ascii_case(tool) && a.target.trim().to_lowercase() == target_norm
        })
    }

    /// Add a discovered subdomain, deduplicating
    pub fn add_subdomain(&mut self, subdomain: impl Into<String>, source: impl Into<String>) -> bool {
        let sub = subdomain.into().trim().to_lowercase();
        if sub.is_empty() {
            return false;
        }
        if self.subdomains.iter().any(|s| s.subdomain == sub) {
            return false;
        }
        self.subdomains.push(DiscoveredSubdomain::new(sub, source));
        self.updated_at = Utc::now();
        true
    }

    /// Mark a subdomain as DNS resolved, optionally adding its resolved IPs
    pub fn mark_subdomain_dns_resolved(&mut self, subdomain: &str, ips: Vec<String>, cnames: Vec<String>) -> bool {
        let sub_lower = subdomain.trim().to_lowercase();
        let mut found = false;
        for sub in &mut self.subdomains {
            if sub.subdomain == sub_lower {
                sub.dns_resolved = true;
                sub.ips.extend(ips.clone());
                sub.cnames.extend(cnames.clone());
                sub.ips.dedup();
                sub.cnames.dedup();
                found = true;
                break;
            }
        }

        // Also add or update host in self.hosts
        if !self.hosts.iter().any(|h| h.host == sub_lower) {
            let mut host = DiscoveredHost::new(&sub_lower);
            if let Some(first_ip) = ips.first() {
                host.ip = Some(first_ip.clone());
            }
            self.hosts.push(host);
        }

        if found {
            self.updated_at = Utc::now();
        }
        found
    }

    /// Add a discovered host
    pub fn add_host(&mut self, host: impl Into<String>, ip: Option<String>) -> bool {
        let h = host.into().trim().to_lowercase();
        if h.is_empty() {
            return false;
        }
        if let Some(existing) = self.hosts.iter_mut().find(|item| item.host == h) {
            if ip.is_some() && existing.ip.is_none() {
                existing.ip = ip;
                self.updated_at = Utc::now();
            }
            return false;
        }
        let mut new_host = DiscoveredHost::new(h);
        new_host.ip = ip;
        self.hosts.push(new_host);
        self.updated_at = Utc::now();
        true
    }

    /// Mark port scan complete for a host
    pub fn mark_host_ports_scanned(&mut self, host: &str) {
        let h_lower = host.trim().to_lowercase();
        for h in &mut self.hosts {
            if h.host == h_lower {
                h.ports_scanned = true;
            }
        }
        self.updated_at = Utc::now();
    }

    /// Add a discovered service
    pub fn add_service(
        &mut self,
        host: impl Into<String>,
        port: u16,
        protocol: impl Into<String>,
        service_name: Option<String>,
        banner: Option<String>,
    ) -> bool {
        let h = host.into().trim().to_lowercase();
        let proto = protocol.into();
        if let Some(existing) = self
            .services
            .iter_mut()
            .find(|s| s.host == h && s.port == port && s.protocol == proto)
        {
            if service_name.is_some() && existing.service_name.is_none() {
                existing.service_name = service_name;
            }
            if banner.is_some() && existing.banner.is_none() {
                existing.banner = banner;
            }
            return false;
        }

        let mut svc = DiscoveredService::new(h, port, proto);
        svc.service_name = service_name;
        svc.banner = banner;
        self.services.push(svc);
        self.updated_at = Utc::now();
        true
    }

    /// Mark a service as HTTP probed
    pub fn mark_service_http_probed(&mut self, host: &str, port: u16) {
        let h_lower = host.trim().to_lowercase();
        for svc in &mut self.services {
            if svc.host == h_lower && svc.port == port {
                svc.http_probed = true;
            }
        }
        self.updated_at = Utc::now();
    }

    /// Add an endpoint
    pub fn add_endpoint(&mut self, mut endpoint: DiscoveredEndpoint) -> bool {
        let url_clean = endpoint.url.trim().to_string();
        if url_clean.is_empty() {
            return false;
        }
        endpoint.url = url_clean.clone();
        if let Some(existing) = self.endpoints.iter_mut().find(|e| e.url == url_clean) {
            // merge params
            for p in endpoint.params {
                if !existing.params.iter().any(|ep| ep.name == p.name && ep.location == p.location) {
                    existing.params.push(p);
                }
            }
            return false;
        }
        self.endpoints.push(endpoint);
        self.updated_at = Utc::now();
        true
    }

    /// Mark a parameter on an endpoint as reflected
    pub fn mark_param_reflected(&mut self, url: &str, param_name: &str, context: Option<String>) -> bool {
        let url_clean = url.trim();
        for ep in &mut self.endpoints {
            if ep.url == url_clean {
                for param in &mut ep.params {
                    if param.name == param_name {
                        param.reflected = true;
                        param.reflection_context = context.clone();
                        self.updated_at = Utc::now();
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Add a detected technology
    pub fn add_technology(&mut self, tech: DiscoveredTechnology) -> bool {
        if self.technologies.iter().any(|t| t.name.eq_ignore_ascii_case(&tech.name)) {
            return false;
        }
        self.technologies.push(tech);
        self.updated_at = Utc::now();
        true
    }

    /// Add a vulnerability finding
    pub fn add_finding(&mut self, finding: StateFinding) -> bool {
        if !self.findings.iter().any(|f| f.title == finding.title && f.target == finding.target) {
            self.findings.push(finding);
            self.updated_at = Utc::now();
            true
        } else {
            false
        }
    }

    /// Mark a finding as verified
    pub fn mark_finding_verified(&mut self, finding_id: &str) -> bool {
        for f in &mut self.findings {
            if f.id == finding_id
                || f.target == finding_id
                || f.matched_at == finding_id
                || (!f.id.is_empty() && finding_id.contains(&f.id))
            {
                f.verified = true;
                f.confidence = FindingConfidence::Confirmed;
                self.updated_at = Utc::now();
                return true;
            }
        }
        false
    }

    /// Record an action that was executed by the runner/adapter
    pub fn record_executed_action(
        &mut self,
        action_type: impl Into<String>,
        tool: impl Into<String>,
        target: impl Into<String>,
        duration_ms: u64,
        success: bool,
        details: Option<String>,
    ) {
        let tool_str = tool.into();
        let record = ExecutedActionRecord {
            action_type: action_type.into(),
            tool: tool_str.clone(),
            target: target.into(),
            executed_at: Utc::now(),
            duration_ms,
            success,
            details,
        };
        self.executed_actions.push(record);

        // Update budget counters
        self.budget.current_actions += 1;
        *self.budget.action_counts_by_tool.entry(tool_str).or_insert(0) += 1;
        self.updated_at = Utc::now();
    }

    /// Check if investigation budget is exhausted
    pub fn is_budget_exhausted(&self) -> bool {
        self.budget.current_actions >= self.budget.max_actions
    }

    /// Check whether a tool can still be run under the budget
    pub fn can_execute_tool(&self, tool: &str, max_per_tool: usize) -> bool {
        if self.is_budget_exhausted() {
            return false;
        }
        let count = self.budget.action_counts_by_tool.get(tool).copied().unwrap_or(0);
        count < max_per_tool
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scope_boundary_rules() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        scope.wildcards.push("*.corp.local".to_string());
        scope.excluded_hosts.push("secret.corp.local".to_string());

        assert!(scope.is_allowed("target.local"));
        assert!(scope.is_allowed("http://target.local:8888/test"));
        assert!(scope.is_allowed("api.corp.local"));
        assert!(scope.is_allowed("corp.local"));
        assert!(!scope.is_allowed("secret.corp.local"));
        assert!(!scope.is_allowed("other.com"));
    }

    #[test]
    fn test_initial_state_and_transitions() {
        let mut scope = ScopeBoundary::new();
        scope.domains.push("target.local".to_string());
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        assert_eq!(state.target, "target.local");
        assert_eq!(state.hosts.len(), 1);
        assert_eq!(state.hosts[0].host, "target.local");
        assert!(!state.has_subdomains());

        // Add subdomains
        assert!(state.add_subdomain("api.target.local", "subfinder"));
        assert!(!state.add_subdomain("api.target.local", "subfinder")); // duplicate rejected
        assert_eq!(state.unresolved_subdomains().len(), 1);

        // Mark resolved
        state.mark_subdomain_dns_resolved("api.target.local", vec!["192.168.1.50".to_string()], vec![]);
        assert_eq!(state.unresolved_subdomains().len(), 0);
        assert!(state.hosts.iter().any(|h| h.host == "api.target.local"));

        // Add service and test HTTP detection
        state.add_service("target.local", 8888, "tcp", Some("http".to_string()), None);
        assert_eq!(state.unprobed_http_services().len(), 1);

        state.mark_service_http_probed("target.local", 8888);
        assert_eq!(state.unprobed_http_services().len(), 0);

        // Add endpoint with param and reflection
        let mut ep = DiscoveredEndpoint::new("http://target.local:8888/search?q=test", "target.local", 8888, "/search");
        ep.params.push(DiscoveredParam {
            name: "q".to_string(),
            location: ParamLocation::Query,
            reflected: false,
            reflection_context: None,
            tested_for_xss: false,
            tested_for_sqli: false,
        });
        state.add_endpoint(ep);
        assert_eq!(state.endpoints_with_reflected_params().len(), 0);

        state.mark_param_reflected("http://target.local:8888/search?q=test", "q", Some("html_body".to_string()));
        let reflected = state.endpoints_with_reflected_params();
        assert_eq!(reflected.len(), 1);
        assert_eq!(reflected[0].1.name, "q");

        // Execute action and budget check
        assert!(!state.has_executed_action("subdomain_enumeration", "target.local"));
        state.record_executed_action("subdomain_enumeration", "subfinder", "target.local", 120, true, None);
        assert!(state.has_executed_action("subdomain_enumeration", "target.local"));
        assert!(state.has_executed_tool_on_target("subfinder", "target.local"));
        assert_eq!(state.budget.current_actions, 1);
        assert!(state.can_execute_tool("subfinder", 3));
    }
}
