//! WAF, Rate-Limit & Observable Behavior Analysis (Ars0n Capability Integration — Phase 10)
//!
//! Measures observable changes between baseline and mutated HTTP requests:
//! status codes, blocking signatures, latency deltas, and rate-limiting responses.

use serde::{Deserialize, Serialize};
use std::time::Instant;
use crate::intelligence::state::ScopeBoundary;

/// Identified WAF vendor or protection mechanism
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WafVendor {
    Cloudflare,
    Akamai,
    AwsWaf,
    Imperva,
    ModSecurity,
    Unknown(String),
}

/// Structured behavior report comparing baseline to probe responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorReport {
    pub target_url: String,
    pub baseline_status: u16,
    pub baseline_latency_ms: u64,
    pub baseline_length: usize,
    pub waf_vendor: Option<WafVendor>,
    pub rate_limit_detected: bool,
    pub active_blocking_detected: bool,
    pub observations: Vec<String>,
}

pub struct BehaviorAnalyzer;

impl BehaviorAnalyzer {
    /// Inspects HTTP response headers for known WAF signatures
    fn detect_waf_from_headers(headers: &reqwest::header::HeaderMap) -> Option<WafVendor> {
        let header_str = format!("{:?}", headers).to_lowercase();
        if header_str.contains("cf-ray") || header_str.contains("cloudflare") {
            Some(WafVendor::Cloudflare)
        } else if header_str.contains("x-akamai") || header_str.contains("akamai") {
            Some(WafVendor::Akamai)
        } else if header_str.contains("x-amz-cf-id") || header_str.contains("awselb") {
            Some(WafVendor::AwsWaf)
        } else if header_str.contains("x-iinfo") || header_str.contains("incap_ses") {
            Some(WafVendor::Imperva)
        } else if header_str.contains("mod_security") || header_str.contains("modsecurity") {
            Some(WafVendor::ModSecurity)
        } else {
            None
        }
    }

    /// Evaluates target HTTP behavior: baseline vs test request
    pub async fn analyze_target_behavior(
        client: &reqwest::Client,
        target_url: &str,
        scope: &ScopeBoundary,
    ) -> Result<BehaviorReport, String> {
        if !scope.is_allowed(target_url) {
            return Err(format!("Behavior analysis target '{}' is out of scope", target_url));
        }

        // 1. Measure baseline
        let t0 = Instant::now();
        let baseline_resp = client
            .get(target_url)
            .send()
            .await
            .map_err(|e| format!("Failed baseline request to '{}': {}", target_url, e))?;
        let baseline_latency = t0.elapsed().as_millis() as u64;
        let baseline_status = baseline_resp.status().as_u16();
        let baseline_headers = baseline_resp.headers().clone();
        let baseline_body = baseline_resp.text().await.unwrap_or_default();
        let baseline_length = baseline_body.len();

        let waf_vendor = Self::detect_waf_from_headers(&baseline_headers);
        let mut observations = Vec::new();

        if let Some(ref w) = waf_vendor {
            observations.push(format!("WAF signature detected via headers: {:?}", w));
        }

        // 2. Measure probe request with benign inspection marker
        let probe_url = if target_url.contains('?') {
            format!("{}&bountyos_probe=1", target_url)
        } else {
            format!("{}?bountyos_probe=1", target_url)
        };

        let probe_resp = client.get(&probe_url).send().await;
        let mut rate_limit_detected = false;
        let mut active_blocking_detected = false;

        if let Ok(resp) = probe_resp {
            let probe_status = resp.status().as_u16();
            if probe_status == 429 {
                rate_limit_detected = true;
                observations.push("Received HTTP 429 Too Many Requests on probe".to_string());
            } else if probe_status == 403 && baseline_status == 200 {
                active_blocking_detected = true;
                observations.push("Received HTTP 403 Forbidden on benign parameter probe (Active filter present)".to_string());
            }
        }

        Ok(BehaviorReport {
            target_url: target_url.to_string(),
            baseline_status,
            baseline_latency_ms: baseline_latency,
            baseline_length,
            waf_vendor,
            rate_limit_detected,
            active_blocking_detected,
            observations,
        })
    }
}
