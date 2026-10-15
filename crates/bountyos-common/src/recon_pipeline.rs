use crate::errors::BountyError;
use crate::ids::{AssetId, JobId, ProgramId};
use crate::job_engine::JobEngine;
use crate::models::{Asset, AssetType, Job, JobCategory};
use crate::scope::ScopePolicy;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// ============================================================================
// 1. Parsed Data Contracts
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DnsRecord {
    pub host: String,
    pub ips: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HttpProbeResult {
    pub url: String,
    pub host: String,
    pub status_code: u16,
    pub title: Option<String>,
    pub webserver: Option<String>,
}

// ============================================================================
// 2. Normalizers and Parsers
// ============================================================================

pub struct ReconParser;

impl ReconParser {
    /// Normalize a domain or hostname: lowercase, trim whitespace and trailing dot.
    pub fn normalize_hostname(raw: &str) -> Option<String> {
        let trimmed = raw.trim().trim_end_matches('.').to_lowercase();
        if trimmed.is_empty()
            || trimmed.contains(' ')
            || trimmed.contains('/')
            || trimmed.contains(':')
            || trimmed.starts_with('-')
            || trimmed.ends_with('-')
        {
            None
        } else {
            Some(trimmed)
        }
    }

    /// Parse raw subfinder / discovery output (supports NDJSON or newline-separated hosts)
    pub fn parse_subdomains(output: &str) -> Vec<String> {
        let mut results = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Check if JSON
            if line.starts_with('{') && line.ends_with('}') {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    if let Some(host) = v.get("host").and_then(|h| h.as_str()) {
                        if let Some(norm) = Self::normalize_hostname(host) {
                            results.push(norm);
                            continue;
                        }
                    }
                }
            }

            // Fallback plain line
            if let Some(norm) = Self::normalize_hostname(line) {
                results.push(norm);
            }
        }
        results.sort();
        results.dedup();
        results
    }

    /// Parse DNS resolution output (supports JSON format and host-ip pairs)
    pub fn parse_dnsx_output(output: &str) -> Vec<DnsRecord> {
        let mut records = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line.starts_with('{') && line.ends_with('}') {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let host = v
                        .get("host")
                        .and_then(|h| h.as_str())
                        .map(|h| h.to_lowercase());
                    let mut ips = Vec::new();
                    if let Some(a_records) = v.get("a").and_then(|a| a.as_array()) {
                        for ip_val in a_records {
                            if let Some(ip) = ip_val.as_str() {
                                ips.push(ip.to_string());
                            }
                        }
                    }
                    if let Some(h) = host {
                        records.push(DnsRecord { host: h, ips });
                        continue;
                    }
                }
            }

            // Plain space-separated format: "example.com 93.184.216.34"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Some(h) = Self::normalize_hostname(parts[0]) {
                    let ips = parts[1..]
                        .iter()
                        .map(|s| s.trim_matches('[').trim_matches(']').to_string())
                        .collect();
                    records.push(DnsRecord { host: h, ips });
                }
            }
        }
        records
    }

    /// Parse HTTP probing output (e.g. httpx JSON or URL lines)
    pub fn parse_httpx_output(output: &str) -> Vec<HttpProbeResult> {
        let mut results = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line.starts_with('{') && line.ends_with('}') {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let url = v
                        .get("url")
                        .and_then(|u| u.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let host = v
                        .get("input")
                        .or_else(|| v.get("host"))
                        .and_then(|h| h.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let status_code =
                        v.get("status_code").and_then(|s| s.as_u64()).unwrap_or(200) as u16;
                    let title = v
                        .get("title")
                        .and_then(|t| t.as_str())
                        .map(|t| t.to_string());
                    let webserver = v
                        .get("webserver")
                        .and_then(|w| w.as_str())
                        .map(|w| w.to_string());

                    if !url.is_empty() {
                        results.push(HttpProbeResult {
                            url,
                            host,
                            status_code,
                            title,
                            webserver,
                        });
                        continue;
                    }
                }
            }

            // Plain URL line
            if line.starts_with("http://") || line.starts_with("https://") {
                let url = line.to_string();
                let host = url
                    .trim_start_matches("http://")
                    .trim_start_matches("https://")
                    .split('/')
                    .next()
                    .unwrap_or_default()
                    .to_string();
                results.push(HttpProbeResult {
                    url,
                    host,
                    status_code: 200,
                    title: None,
                    webserver: None,
                });
            }
        }
        results
    }
}

// ============================================================================
// 3. Recon Step Executor Trait
// ============================================================================

#[async_trait::async_trait]
pub trait ReconStepExecutor: Send + Sync {
    async fn discover_subdomains(&self, target: &str) -> Result<String, BountyError>;
    async fn resolve_dns(&self, subdomains: &[String]) -> Result<String, BountyError>;
    async fn probe_http(&self, targets: &[String]) -> Result<String, BountyError>;
}

// ============================================================================
// 4. Recon Pipeline Result
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconPipelineResult {
    pub root_job: Job,
    pub stage_jobs: Vec<Job>,
    pub assets: Vec<Asset>,
    pub out_of_scope_rejections: Vec<String>,
    pub completed_at: DateTime<Utc>,
}

// ============================================================================
// 5. In-Memory Asset Store (Deduplicating & Provenance Tracking)
// ============================================================================

#[derive(Clone, Default)]
pub struct InMemoryAssetStore {
    assets: Arc<RwLock<HashMap<(AssetType, String), Asset>>>,
}

impl InMemoryAssetStore {
    pub fn new() -> Self {
        Self {
            assets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Upsert an asset with full provenance preservation and deduplication
    pub async fn upsert_asset(
        &self,
        program_id: ProgramId,
        asset_type: AssetType,
        value: &str,
        source_tool: &str,
        source_job_id: JobId,
        parent_asset_id: Option<AssetId>,
    ) -> Result<Asset, BountyError> {
        let norm_val = value.trim().to_string();
        let key = (asset_type, norm_val.clone());

        let mut store = self.assets.write().await;
        if let Some(existing) = store.get_mut(&key) {
            existing.update_last_seen();
            if existing.source_tool.is_none() {
                existing.source_tool = Some(source_tool.to_string());
            }
            if existing.parent_asset_id.is_none() {
                existing.parent_asset_id = parent_asset_id;
            }
            Ok(existing.clone())
        } else {
            let mut new_asset = Asset::new(
                program_id,
                asset_type,
                norm_val,
                Some(source_tool.to_string()),
                Some(source_job_id),
            )?;
            new_asset.parent_asset_id = parent_asset_id;
            store.insert(key, new_asset.clone());
            Ok(new_asset)
        }
    }

    pub async fn get_all(&self) -> Vec<Asset> {
        let store = self.assets.read().await;
        store.values().cloned().collect()
    }
}

// ============================================================================
// 6. Recon Pipeline Engine
// ============================================================================

pub struct ReconPipeline {
    job_engine: JobEngine,
    asset_store: InMemoryAssetStore,
}

impl ReconPipeline {
    pub fn new(job_engine: JobEngine, asset_store: InMemoryAssetStore) -> Self {
        Self {
            job_engine,
            asset_store,
        }
    }

    /// Execute the complete reconnaissance pipeline:
    /// Target → scope check → subdomain discovery → DNS resolution → HTTP probing → asset normalization → persistence
    pub async fn run<E: ReconStepExecutor>(
        &self,
        target: &str,
        program_id: ProgramId,
        scope_policy: &ScopePolicy,
        executor: &E,
    ) -> Result<ReconPipelineResult, BountyError> {
        // Step 1: Pre-execution scope check on target
        scope_policy.enforce(target)?;

        // Step 2: Create root pipeline job
        let mut root_job = self
            .job_engine
            .create_job(program_id, target, JobCategory::Recon, None)
            .await?;
        self.job_engine.start_job(root_job.id).await?;

        let mut stage_jobs = Vec::new();
        let mut out_of_scope_rejections = Vec::new();

        // Register root target asset
        let root_asset = self
            .asset_store
            .upsert_asset(
                program_id,
                AssetType::Domain,
                target,
                "user_target",
                root_job.id,
                None,
            )
            .await?;

        // --------------------------------------------------------------------
        // Stage A: Subdomain Discovery
        // --------------------------------------------------------------------
        let sub_job = self
            .job_engine
            .create_job(
                program_id,
                target,
                JobCategory::ToolExecution,
                Some(root_job.id),
            )
            .await?;
        self.job_engine.start_job(sub_job.id).await?;

        let raw_subdomains = match executor.discover_subdomains(target).await {
            Ok(out) => {
                self.job_engine.succeed_job(sub_job.id).await?;
                stage_jobs.push(self.job_engine.get_job(sub_job.id).await.unwrap());
                out
            }
            Err(e) => {
                self.job_engine.fail_job(sub_job.id, e.to_string()).await?;
                self.job_engine
                    .fail_job(root_job.id, format!("Subdomain stage failed: {e}"))
                    .await?;
                return Err(e);
            }
        };

        let parsed_subdomains = ReconParser::parse_subdomains(&raw_subdomains);

        // Filter discovered subdomains strictly against scope policy
        let mut in_scope_subdomains = Vec::new();
        for sub in parsed_subdomains {
            match scope_policy.enforce(&sub) {
                Ok(_) => {
                    in_scope_subdomains.push(sub);
                }
                Err(_) => {
                    out_of_scope_rejections.push(sub);
                }
            }
        }

        // Persist in-scope subdomains as assets with provenance
        let mut subdomain_assets = Vec::new();
        for sub in &in_scope_subdomains {
            let asset = self
                .asset_store
                .upsert_asset(
                    program_id,
                    AssetType::Subdomain,
                    sub,
                    "subfinder",
                    sub_job.id,
                    Some(root_asset.id),
                )
                .await?;
            subdomain_assets.push(asset);
        }

        // --------------------------------------------------------------------
        // Stage B: DNS Resolution
        // --------------------------------------------------------------------
        let dns_job = self
            .job_engine
            .create_job(
                program_id,
                target,
                JobCategory::ToolExecution,
                Some(root_job.id),
            )
            .await?;
        self.job_engine.start_job(dns_job.id).await?;

        let raw_dns = match executor.resolve_dns(&in_scope_subdomains).await {
            Ok(out) => {
                self.job_engine.succeed_job(dns_job.id).await?;
                stage_jobs.push(self.job_engine.get_job(dns_job.id).await.unwrap());
                out
            }
            Err(e) => {
                self.job_engine.fail_job(dns_job.id, e.to_string()).await?;
                self.job_engine
                    .fail_job(root_job.id, format!("DNS stage failed: {e}"))
                    .await?;
                return Err(e);
            }
        };

        let dns_records = ReconParser::parse_dnsx_output(&raw_dns);
        for record in dns_records {
            for ip in record.ips {
                self.asset_store
                    .upsert_asset(
                        program_id,
                        AssetType::IpAddress,
                        &ip,
                        "dnsx",
                        dns_job.id,
                        Some(root_asset.id),
                    )
                    .await?;
            }
        }

        // --------------------------------------------------------------------
        // Stage C: HTTP Probing
        // --------------------------------------------------------------------
        let http_job = self
            .job_engine
            .create_job(
                program_id,
                target,
                JobCategory::ToolExecution,
                Some(root_job.id),
            )
            .await?;
        self.job_engine.start_job(http_job.id).await?;

        let raw_http = match executor.probe_http(&in_scope_subdomains).await {
            Ok(out) => {
                self.job_engine.succeed_job(http_job.id).await?;
                stage_jobs.push(self.job_engine.get_job(http_job.id).await.unwrap());
                out
            }
            Err(e) => {
                self.job_engine.fail_job(http_job.id, e.to_string()).await?;
                self.job_engine
                    .fail_job(root_job.id, format!("HTTP probing stage failed: {e}"))
                    .await?;
                return Err(e);
            }
        };

        let http_results = ReconParser::parse_httpx_output(&raw_http);
        for probe in http_results {
            self.asset_store
                .upsert_asset(
                    program_id,
                    AssetType::Url,
                    &probe.url,
                    "httpx",
                    http_job.id,
                    Some(root_asset.id),
                )
                .await?;
        }

        // --------------------------------------------------------------------
        // Complete Root Recon Job
        // --------------------------------------------------------------------
        self.job_engine.succeed_job(root_job.id).await?;
        root_job = self.job_engine.get_job(root_job.id).await.unwrap();

        let all_assets = self.asset_store.get_all().await;

        Ok(ReconPipelineResult {
            root_job,
            stage_jobs,
            assets: all_assets,
            out_of_scope_rejections,
            completed_at: Utc::now(),
        })
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::JobExecutionState;
    use crate::types::ScopeType;

    struct MockReconExecutor {
        subfinder_output: String,
        dnsx_output: String,
        httpx_output: String,
    }

    #[async_trait::async_trait]
    impl ReconStepExecutor for MockReconExecutor {
        async fn discover_subdomains(&self, _target: &str) -> Result<String, BountyError> {
            Ok(self.subfinder_output.clone())
        }

        async fn resolve_dns(&self, _subdomains: &[String]) -> Result<String, BountyError> {
            Ok(self.dnsx_output.clone())
        }

        async fn probe_http(&self, _targets: &[String]) -> Result<String, BountyError> {
            Ok(self.httpx_output.clone())
        }
    }

    #[test]
    fn test_fixture_subdomain_parser() {
        let fixture = r#"
            {"host":"api.example.com"}
            {"host":"AUTH.example.com."}
            {"host":"api.example.com"}
            www.example.com
            DEV.example.com.
        "#;
        let subdomains = ReconParser::parse_subdomains(fixture);
        assert_eq!(subdomains.len(), 4);
        assert_eq!(
            subdomains,
            vec![
                "api.example.com",
                "auth.example.com",
                "dev.example.com",
                "www.example.com"
            ]
        );
    }

    #[test]
    fn test_fixture_dnsx_parser() {
        let fixture = r#"
            {"host":"api.example.com","a":["93.184.216.34"]}
            {"host":"auth.example.com","a":["93.184.216.35","93.184.216.36"]}
            www.example.com [93.184.216.37]
        "#;
        let records = ReconParser::parse_dnsx_output(fixture);
        assert_eq!(records.len(), 3);
        assert_eq!(records[0].host, "api.example.com");
        assert_eq!(records[0].ips, vec!["93.184.216.34"]);
        assert_eq!(records[1].ips.len(), 2);
    }

    #[test]
    fn test_fixture_httpx_parser() {
        let fixture = r#"
            {"url":"https://api.example.com","status_code":200,"title":"API Portal","webserver":"nginx"}
            https://auth.example.com
        "#;
        let results = ReconParser::parse_httpx_output(fixture);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].url, "https://api.example.com");
        assert_eq!(results[0].status_code, 200);
        assert_eq!(results[0].title.as_deref(), Some("API Portal"));
        assert_eq!(results[1].url, "https://auth.example.com");
    }

    #[tokio::test]
    async fn test_end_to_end_mocked_recon_pipeline() {
        let job_engine = JobEngine::new();
        let asset_store = InMemoryAssetStore::new();
        let pipeline = ReconPipeline::new(job_engine, asset_store);

        let prog_id = ProgramId::new();
        let mut policy = ScopePolicy::new(prog_id);
        policy.add_inclusion("example.com", ScopeType::Domain);
        policy.add_inclusion("*.example.com", ScopeType::Wildcard);
        // Explicitly exclude out-of-scope host
        policy.add_exclusion("forbidden.example.com", ScopeType::Domain);

        let executor = MockReconExecutor {
            subfinder_output: r#"
                api.example.com
                auth.example.com
                forbidden.example.com
                evil-attacker.com
            "#
            .to_string(),
            dnsx_output: r#"
                {"host":"api.example.com","a":["93.184.216.34"]}
                {"host":"auth.example.com","a":["93.184.216.35"]}
            "#
            .to_string(),
            httpx_output: r#"
                {"url":"https://api.example.com","status_code":200,"title":"API"}
                {"url":"https://auth.example.com","status_code":200,"title":"Auth"}
            "#
            .to_string(),
        };

        let result = pipeline
            .run("example.com", prog_id, &policy, &executor)
            .await
            .unwrap();

        // 1. Root job must have succeeded
        assert_eq!(result.root_job.state, JobExecutionState::Succeeded);
        assert_eq!(result.stage_jobs.len(), 3);
        for stage_job in &result.stage_jobs {
            assert_eq!(stage_job.state, JobExecutionState::Succeeded);
            assert_eq!(stage_job.parent_job_id, Some(result.root_job.id));
        }

        // 2. Out of scope rejections must include forbidden.example.com and evil-attacker.com
        assert!(result
            .out_of_scope_rejections
            .contains(&"forbidden.example.com".to_string()));
        assert!(result
            .out_of_scope_rejections
            .contains(&"evil-attacker.com".to_string()));

        // 3. Assets must contain root domain, subdomains, IPs, and URLs
        let asset_vals: Vec<String> = result.assets.iter().map(|a| a.value.clone()).collect();
        assert!(asset_vals.contains(&"example.com".to_string()));
        assert!(asset_vals.contains(&"api.example.com".to_string()));
        assert!(asset_vals.contains(&"auth.example.com".to_string()));
        assert!(asset_vals.contains(&"93.184.216.34".to_string()));
        assert!(asset_vals.contains(&"https://api.example.com".to_string()));

        // 4. Excluded host must NEVER be an asset
        assert!(!asset_vals.contains(&"forbidden.example.com".to_string()));
        assert!(!asset_vals.contains(&"evil-attacker.com".to_string()));

        // 5. Asset provenance check
        let api_sub = result
            .assets
            .iter()
            .find(|a| a.value == "api.example.com")
            .unwrap();
        assert_eq!(api_sub.source_tool.as_deref(), Some("subfinder"));
        assert!(api_sub.parent_asset_id.is_some());
    }

    #[tokio::test]
    async fn test_recon_pipeline_rejects_out_of_scope_root_target() {
        let job_engine = JobEngine::new();
        let asset_store = InMemoryAssetStore::new();
        let pipeline = ReconPipeline::new(job_engine, asset_store);

        let prog_id = ProgramId::new();
        let mut policy = ScopePolicy::new(prog_id);
        policy.add_inclusion("example.com", ScopeType::Domain);

        let executor = MockReconExecutor {
            subfinder_output: String::new(),
            dnsx_output: String::new(),
            httpx_output: String::new(),
        };

        // Root target evil.com is out of scope -> must fail immediately
        let res = pipeline.run("evil.com", prog_id, &policy, &executor).await;
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), BountyError::ScopeViolation(_)));
    }
}
