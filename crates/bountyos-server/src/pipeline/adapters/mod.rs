//! Typed ToolAdapter Layer (Ars0n Capability Integration — Phase 2)
//!
//! Provides server-controlled argument construction, target validation, pre-flight
//! scope enforcement, and observation normalization without shell evaluation.

use std::sync::Arc;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use crate::intelligence::observations::Observation;
use crate::intelligence::state::ScopeBoundary;

pub mod recon;
pub mod secrets;
pub mod exposure;
pub mod graphql;
pub mod vulnerability;

/// Operational risk classification for safety gating
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RiskClassification {
    /// Zero network packets to target host (DNS/OSINT/historical cache)
    Passive,
    /// Standard non-intrusive HTTP requests, banner grabbing, port discovery
    Low,
    /// Active parameter fuzzing, crawling, route probing, schema introspection
    Medium,
    /// Active exploit payload injection (SQLi, CMDi, SSTI, SSRF)
    High,
    /// Destructive attempts, blind brute-force, denial-of-service risks
    Critical,
}

/// Normalized capabilities supported across tools
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ToolCapability {
    SubdomainEnumeration,
    DnsResolution,
    PortScanning,
    HttpProbing,
    WebCrawling,
    HistoricalUrlMining,
    DirectoryFuzzing,
    ParameterDiscovery,
    SecretScanning,
    JsEndpointExtraction,
    GraphqlIntrospection,
    GraphqlSecurityCheck,
    ExposureDetection,
    XssScanning,
    SqliScanning,
    CmdiScanning,
    SstiScanning,
    LfiScanning,
    SsrfScanning,
    AccessBypass403,
    JwtAnalysis,
    CveScanning,
}

/// Metadata contract for every registered tool adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMetadata {
    pub name: &'static str,
    pub binary_name: &'static str,
    pub description: &'static str,
    pub risk: RiskClassification,
    pub capabilities: Vec<ToolCapability>,
    pub default_timeout: Duration,
    pub requires_scope_validation: bool,
    pub output_format: &'static str,
}

/// Configuration options passed into argument construction
#[derive(Debug, Clone, Default)]
pub struct AdapterOptions {
    pub wordlist_path: Option<String>,
    pub max_rate_limit: Option<usize>,
    pub custom_headers: Vec<(String, String)>,
    pub user_agent: Option<String>,
    pub proxy_url: Option<String>,
    pub extra_flags: Vec<String>,
}

/// Unified ToolAdapter Trait
pub trait ToolAdapter: Send + Sync {
    /// Return static metadata describing the tool
    fn metadata(&self) -> ToolMetadata;

    /// Validate that the target format is acceptable for this tool
    fn validate_target(&self, target: &str) -> Result<(), String>;

    /// Pre-execution safety check: verify scope boundary adherence
    fn check_scope(&self, target: &str, scope: &ScopeBoundary) -> Result<(), String> {
        if self.metadata().requires_scope_validation && !scope.is_allowed(target) {
            Err(format!(
                "Scope gate rejected target '{}' for tool '{}'",
                target,
                self.metadata().name
            ))
        } else {
            Ok(())
        }
    }

    /// Build CLI arguments safely without shell invocation
    fn build_arguments(&self, target: &str, options: &AdapterOptions) -> Vec<String>;

    /// Parse raw tool stdout and stderr into normalized observations
    fn parse_output(&self, target: &str, stdout: &str, stderr: &str) -> Vec<Observation>;
}

/// Central registry of all typed tool adapters
pub struct AdapterRegistry;

impl AdapterRegistry {
    /// Retrieve adapter by tool identifier
    pub fn get(name: &str) -> Option<Arc<dyn ToolAdapter>> {
        let key = name.to_lowercase();
        match key.as_str() {
            // Reconnaissance & OSINT
            "subfinder" => Some(Arc::new(recon::SubfinderAdapter)),
            "assetfinder" => Some(Arc::new(recon::AssetfinderAdapter)),
            "sublist3r" => Some(Arc::new(recon::Sublist3rAdapter)),
            "dnsx" => Some(Arc::new(recon::DnsxAdapter)),
            "naabu" => Some(Arc::new(recon::NaabuAdapter)),
            "httpx" => Some(Arc::new(recon::HttpxAdapter)),
            "gau" => Some(Arc::new(recon::GauAdapter)),
            "waybackurls" => Some(Arc::new(recon::WaybackurlsAdapter)),

            // JavaScript & Secret Intelligence
            "katana" => Some(Arc::new(secrets::KatanaAdapter)),
            "linkfinder" => Some(Arc::new(secrets::LinkfinderAdapter)),
            "trufflehog" => Some(Arc::new(secrets::TrufflehogAdapter)),
            "mantra" => Some(Arc::new(secrets::MantraAdapter)),

            // Content & Exposure Discovery
            "ffuf" => Some(Arc::new(exposure::FfufAdapter)),
            "snallygaster" => Some(Arc::new(exposure::SnallygasterAdapter)),
            "git-dumper" | "git_dumper" => Some(Arc::new(exposure::GitDumperAdapter)),
            "arjun" => Some(Arc::new(exposure::ArjunAdapter)),

            // GraphQL
            "graphw00f" => Some(Arc::new(graphql::Graphw00fAdapter)),
            "graphql-cop" | "graphql_cop" => Some(Arc::new(graphql::GraphqlCopAdapter)),

            // Vulnerability-Class Adapters
            "dalfox" => Some(Arc::new(vulnerability::DalfoxAdapter)),
            "nuclei" => Some(Arc::new(vulnerability::NucleiAdapter)),
            "sqlmap" => Some(Arc::new(vulnerability::SqlmapAdapter)),
            "ghauri" => Some(Arc::new(vulnerability::GhauriAdapter)),
            "commix" => Some(Arc::new(vulnerability::CommixAdapter)),
            "sstimap" => Some(Arc::new(vulnerability::SstimapAdapter)),
            "lfimap" => Some(Arc::new(vulnerability::LfimapAdapter)),
            "ssrfmap" => Some(Arc::new(vulnerability::SsrfmapAdapter)),
            "nomore403" => Some(Arc::new(vulnerability::Nomore403Adapter)),
            "jwt_tool" | "jwt-tool" => Some(Arc::new(vulnerability::JwtToolAdapter)),

            _ => None,
        }
    }

    /// Retrieve all registered adapters
    pub fn all() -> Vec<Arc<dyn ToolAdapter>> {
        vec![
            Arc::new(recon::SubfinderAdapter),
            Arc::new(recon::AssetfinderAdapter),
            Arc::new(recon::Sublist3rAdapter),
            Arc::new(recon::DnsxAdapter),
            Arc::new(recon::NaabuAdapter),
            Arc::new(recon::HttpxAdapter),
            Arc::new(recon::GauAdapter),
            Arc::new(recon::WaybackurlsAdapter),
            Arc::new(secrets::KatanaAdapter),
            Arc::new(secrets::LinkfinderAdapter),
            Arc::new(secrets::TrufflehogAdapter),
            Arc::new(secrets::MantraAdapter),
            Arc::new(exposure::FfufAdapter),
            Arc::new(exposure::SnallygasterAdapter),
            Arc::new(exposure::GitDumperAdapter),
            Arc::new(exposure::ArjunAdapter),
            Arc::new(graphql::Graphw00fAdapter),
            Arc::new(graphql::GraphqlCopAdapter),
            Arc::new(vulnerability::DalfoxAdapter),
            Arc::new(vulnerability::NucleiAdapter),
            Arc::new(vulnerability::SqlmapAdapter),
            Arc::new(vulnerability::GhauriAdapter),
            Arc::new(vulnerability::CommixAdapter),
            Arc::new(vulnerability::SstimapAdapter),
            Arc::new(vulnerability::LfimapAdapter),
            Arc::new(vulnerability::SsrfmapAdapter),
            Arc::new(vulnerability::Nomore403Adapter),
            Arc::new(vulnerability::JwtToolAdapter),
        ]
    }

    /// Find adapters providing a specific capability
    pub fn for_capability(cap: ToolCapability) -> Vec<Arc<dyn ToolAdapter>> {
        Self::all()
            .into_iter()
            .filter(|a| a.metadata().capabilities.contains(&cap))
            .collect()
    }
}
