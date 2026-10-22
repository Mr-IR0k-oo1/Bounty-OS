//! Attack Surface Uncertainty Model
//!
//! Measures epistemic uncertainty across attack surface assets.
//! Higher uncertainty indicates areas with high potential for new discoveries.

use crate::intelligence::state::InvestigationState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Uncertainty assessment report
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UncertaintyReport {
    pub total_uncertainty: f64,
    pub dimension_uncertainties: HashMap<String, f64>,
    pub high_uncertainty_targets: Vec<(String, f64)>,
}

pub struct UncertaintyModel;

impl UncertaintyModel {
    pub fn assess(state: &InvestigationState) -> UncertaintyReport {
        let mut dimensions = HashMap::new();
        let mut target_uncertainties: HashMap<String, f64> = HashMap::new();

        // 1. Subdomain Uncertainty
        let sub_unc = if state.subdomains.is_empty() {
            target_uncertainties.insert(state.target.clone(), 0.9);
            0.9
        } else {
            0.2
        };
        dimensions.insert("subdomains".to_string(), sub_unc);

        // 2. DNS Uncertainty
        let unresolved = state.unresolved_subdomains();
        let dns_unc = if !state.subdomains.is_empty() {
            let u_ratio = unresolved.len() as f64 / state.subdomains.len() as f64;
            for sub in &unresolved {
                *target_uncertainties.entry(sub.subdomain.clone()).or_insert(0.0) += 0.8;
            }
            u_ratio
        } else {
            0.5
        };
        dimensions.insert("dns".to_string(), dns_unc);

        // 3. Port & Service Uncertainty
        let unscanned = state.unscanned_hosts();
        let port_unc = if !state.hosts.is_empty() {
            let p_ratio = unscanned.len() as f64 / state.hosts.len() as f64;
            for h in &unscanned {
                *target_uncertainties.entry(h.host.clone()).or_insert(0.0) += 0.7;
            }
            p_ratio
        } else {
            0.8
        };
        dimensions.insert("ports".to_string(), port_unc);

        // 4. Web Service Uncertainty
        let unprobed = state.unprobed_http_services();
        let http_unc = if !state.services.is_empty() {
            let likely_http_count = state.services.iter().filter(|s| s.is_likely_http()).count();
            if likely_http_count > 0 {
                unprobed.len() as f64 / likely_http_count as f64
            } else {
                0.1
            }
        } else {
            0.6
        };
        dimensions.insert("http_metadata".to_string(), http_unc);

        // 5. Endpoint Uncertainty
        let ep_unc = if state.endpoints.is_empty() { 0.8 } else { 0.3 };
        dimensions.insert("endpoints".to_string(), ep_unc);

        // 6. Vulnerability Uncertainty
        let unverified = state.unverified_high_confidence_findings();
        let vuln_unc = if !state.findings.is_empty() {
            unverified.len() as f64 / state.findings.len() as f64
        } else {
            0.2
        };
        dimensions.insert("findings".to_string(), vuln_unc);

        // Calculate average total uncertainty
        let total = (sub_unc + dns_unc + port_unc + http_unc + ep_unc + vuln_unc) / 6.0;

        let mut high_targets: Vec<_> = target_uncertainties.into_iter().collect();
        high_targets.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        UncertaintyReport {
            total_uncertainty: (total * 100.0).round() / 100.0,
            dimension_uncertainties: dimensions,
            high_uncertainty_targets: high_targets,
        }
    }
}
