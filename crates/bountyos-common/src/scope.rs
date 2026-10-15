use crate::errors::BountyError;
use crate::ids::ProgramId;
use crate::types::ScopeType;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::net::Ipv4Addr;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeTargetRule {
    pub pattern: String,
    pub scope_type: ScopeType,
    pub description: Option<String>,
}

impl ScopeTargetRule {
    pub fn new(pattern: impl Into<String>, scope_type: ScopeType) -> Self {
        Self {
            pattern: pattern.into().trim().to_lowercase(),
            scope_type,
            description: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PolicyVerdict {
    Allowed,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScopeAuditLog {
    pub target: String,
    pub verdict: PolicyVerdict,
    pub reason: String,
    pub matched_rule: Option<String>,
    pub evaluated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScopeDecision {
    pub verdict: PolicyVerdict,
    pub target: String,
    pub reason: String,
    pub matched_rule: Option<String>,
    pub evaluated_at: DateTime<Utc>,
}

impl ScopeDecision {
    pub fn is_allowed(&self) -> bool {
        self.verdict == PolicyVerdict::Allowed
    }

    pub fn to_audit_log(&self) -> ScopeAuditLog {
        ScopeAuditLog {
            target: self.target.clone(),
            verdict: self.verdict,
            reason: self.reason.clone(),
            matched_rule: self.matched_rule.clone(),
            evaluated_at: self.evaluated_at,
        }
    }
}

/// Security Policy Specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopePolicy {
    pub program_id: ProgramId,
    pub inclusions: Vec<ScopeTargetRule>,
    pub exclusions: Vec<ScopeTargetRule>,
    pub excluded_paths: Vec<String>,
    pub allowed_protocols: Vec<String>,
    pub disallowed_protocols: Vec<String>,
    pub rate_limit_rps: Option<u32>,
}

impl ScopePolicy {
    pub fn new(program_id: ProgramId) -> Self {
        Self {
            program_id,
            inclusions: Vec::new(),
            exclusions: Vec::new(),
            excluded_paths: Vec::new(),
            allowed_protocols: vec!["http".into(), "https".into(), "dns".into()],
            disallowed_protocols: vec!["ftp".into(), "ssh".into(), "telnet".into(), "smtp".into()],
            rate_limit_rps: Some(50),
        }
    }

    pub fn add_inclusion(&mut self, pattern: impl Into<String>, scope_type: ScopeType) {
        self.inclusions
            .push(ScopeTargetRule::new(pattern, scope_type));
    }

    pub fn add_exclusion(&mut self, pattern: impl Into<String>, scope_type: ScopeType) {
        self.exclusions
            .push(ScopeTargetRule::new(pattern, scope_type));
    }

    pub fn add_excluded_path(&mut self, path: impl Into<String>) {
        self.excluded_paths.push(path.into().trim().to_lowercase());
    }

    /// Primary evaluation method. Exclusions ALWAYS take precedence over inclusions.
    pub fn evaluate(&self, target_input: &str) -> ScopeDecision {
        let now = Utc::now();
        let target = target_input.trim();

        if target.is_empty() {
            return ScopeDecision {
                verdict: PolicyVerdict::Denied,
                target: target_input.to_string(),
                reason: "Target is empty".into(),
                matched_rule: None,
                evaluated_at: now,
            };
        }

        // 1. Protocol Validation
        if let Some((proto, rest)) = extract_protocol(target) {
            let proto_lower = proto.to_lowercase();
            if self
                .disallowed_protocols
                .iter()
                .any(|dp| dp.eq_ignore_ascii_case(&proto_lower))
            {
                return ScopeDecision {
                    verdict: PolicyVerdict::Denied,
                    target: target.to_string(),
                    reason: format!("Protocol '{proto_lower}' is explicitly disallowed"),
                    matched_rule: Some(proto_lower),
                    evaluated_at: now,
                };
            }
            if !self.allowed_protocols.is_empty()
                && !self
                    .allowed_protocols
                    .iter()
                    .any(|ap| ap.eq_ignore_ascii_case(&proto_lower))
            {
                return ScopeDecision {
                    verdict: PolicyVerdict::Denied,
                    target: target.to_string(),
                    reason: format!("Protocol '{proto_lower}' is not in allowed protocols"),
                    matched_rule: Some(proto_lower),
                    evaluated_at: now,
                };
            }

            // Path Exclusions check for URLs
            if let Some(path) = extract_path(rest) {
                let path_lower = path.to_lowercase();
                for exc_path in &self.excluded_paths {
                    if path_lower.starts_with(exc_path) {
                        return ScopeDecision {
                            verdict: PolicyVerdict::Denied,
                            target: target.to_string(),
                            reason: format!(
                                "Path '{path_lower}' matches excluded path '{exc_path}'"
                            ),
                            matched_rule: Some(exc_path.clone()),
                            evaluated_at: now,
                        };
                    }
                }
            }
        }

        // Normalize host/domain part
        let host = extract_host(target);
        if host.is_empty() || host.contains(' ') || host.contains('/') {
            return ScopeDecision {
                verdict: PolicyVerdict::Denied,
                target: target.to_string(),
                reason: "Malformed or ambiguous target host".into(),
                matched_rule: None,
                evaluated_at: now,
            };
        }

        // 2. Check Exclusions FIRST (Exclusions take absolute precedence)
        for exc in &self.exclusions {
            if matches_rule(host, &exc.pattern, &exc.scope_type) {
                return ScopeDecision {
                    verdict: PolicyVerdict::Denied,
                    target: target.to_string(),
                    reason: format!("Explicitly excluded by rule '{}'", exc.pattern),
                    matched_rule: Some(exc.pattern.clone()),
                    evaluated_at: now,
                };
            }
        }

        // 3. Check Inclusions
        for inc in &self.inclusions {
            if matches_rule(host, &inc.pattern, &inc.scope_type) {
                return ScopeDecision {
                    verdict: PolicyVerdict::Allowed,
                    target: target.to_string(),
                    reason: format!("Matched in-scope rule '{}'", inc.pattern),
                    matched_rule: Some(inc.pattern.clone()),
                    evaluated_at: now,
                };
            }
        }

        // 4. Default Deny
        ScopeDecision {
            verdict: PolicyVerdict::Denied,
            target: target.to_string(),
            reason: "Target did not match any in-scope rules (default deny)".into(),
            matched_rule: None,
            evaluated_at: now,
        }
    }

    /// Guard assertion: returns Ok(()) if target is allowed, or Err(BountyError::ScopeViolation)
    pub fn enforce(&self, target_input: &str) -> Result<ScopeDecision, BountyError> {
        let decision = self.evaluate(target_input);
        if decision.is_allowed() {
            Ok(decision)
        } else {
            Err(BountyError::ScopeViolation(format!(
                "Operation denied for target '{}': {}",
                decision.target, decision.reason
            )))
        }
    }
}

// ============================================================================
// Helper Matching Logic
// ============================================================================

fn extract_protocol(target: &str) -> Option<(&str, &str)> {
    if let Some(idx) = target.find("://") {
        Some((&target[..idx], &target[idx + 3..]))
    } else {
        None
    }
}

fn extract_path(rest: &str) -> Option<&str> {
    if let Some(idx) = rest.find('/') {
        Some(&rest[idx..])
    } else {
        None
    }
}

fn extract_host(target: &str) -> &str {
    let without_proto = if let Some((_, rest)) = extract_protocol(target) {
        rest
    } else {
        target
    };

    // Strip path and query if present
    let host_part = without_proto.split('/').next().unwrap_or(without_proto);

    // Strip port if present
    if let Some(colon_idx) = host_part.find(':') {
        &host_part[..colon_idx]
    } else {
        host_part
    }
}

pub fn matches_rule(host: &str, pattern: &str, scope_type: &ScopeType) -> bool {
    let host = host.trim().to_lowercase();
    let pattern = pattern.trim().to_lowercase();

    if host == pattern {
        return true;
    }

    match scope_type {
        ScopeType::Wildcard => {
            let base = pattern.trim_start_matches("*.").trim_start_matches('.');
            host == base || host.ends_with(&format!(".{base}"))
        }
        ScopeType::Domain => {
            if pattern.starts_with("*.") || pattern.starts_with('.') {
                let base = pattern.trim_start_matches("*.").trim_start_matches('.');
                host == base || host.ends_with(&format!(".{base}"))
            } else {
                host == pattern
            }
        }
        ScopeType::Ip => host == pattern,
        ScopeType::Cidr => ip_in_cidr(&host, &pattern),
        ScopeType::Url => host.starts_with(&pattern),
        _ => host == pattern,
    }
}

fn ip_in_cidr(target: &str, cidr: &str) -> bool {
    let target_ip = match Ipv4Addr::from_str(target) {
        Ok(ip) => ip,
        Err(_) => return false,
    };

    let mut parts = cidr.split('/');
    let network_str = match parts.next() {
        Some(s) => s,
        None => return false,
    };
    let prefix_len: u32 = match parts.next().and_then(|p| p.parse().ok()) {
        Some(p) if p <= 32 => p,
        _ => 32,
    };

    let network_ip = match Ipv4Addr::from_str(network_str) {
        Ok(ip) => ip,
        Err(_) => return false,
    };

    if prefix_len == 0 {
        return true;
    }

    let mask = !((1u32 << (32 - prefix_len)).wrapping_sub(1));
    (u32::from(target_ip) & mask) == (u32::from(network_ip) & mask)
}

// ============================================================================
// Comprehensive Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_domain_and_subdomains() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);
        policy.add_inclusion("*.target.com", ScopeType::Wildcard);

        // Exact match
        assert!(policy.evaluate("example.com").is_allowed());
        // Subdomain of exact domain is NOT allowed unless wildcard is defined
        assert!(!policy.evaluate("api.example.com").is_allowed());

        // Wildcard match
        assert!(policy.evaluate("target.com").is_allowed());
        assert!(policy.evaluate("sub.target.com").is_allowed());
        assert!(policy.evaluate("deep.nested.sub.target.com").is_allowed());

        // Unrelated domains
        assert!(!policy.evaluate("target.com.attacker.com").is_allowed());
        assert!(!policy.evaluate("nottarget.com").is_allowed());
        assert!(!policy.evaluate("attacker.com").is_allowed());
    }

    #[test]
    fn test_ip_and_cidr() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("192.168.1.50", ScopeType::Ip);
        policy.add_inclusion("10.0.0.0/24", ScopeType::Cidr);

        // Exact IP
        assert!(policy.evaluate("192.168.1.50").is_allowed());
        assert!(!policy.evaluate("192.168.1.51").is_allowed());

        // CIDR
        assert!(policy.evaluate("10.0.0.1").is_allowed());
        assert!(policy.evaluate("10.0.0.254").is_allowed());
        assert!(!policy.evaluate("10.0.1.1").is_allowed());
    }

    #[test]
    fn test_exclusions_precedence_over_inclusions() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("*.example.com", ScopeType::Wildcard);
        // Exclude specific critical asset
        policy.add_exclusion("payments.example.com", ScopeType::Domain);

        assert!(policy.evaluate("api.example.com").is_allowed());
        assert!(policy.evaluate("www.example.com").is_allowed());

        // payments.example.com must be strictly DENIED
        let decision = policy.evaluate("payments.example.com");
        assert!(!decision.is_allowed());
        assert_eq!(decision.verdict, PolicyVerdict::Denied);
        assert!(decision.reason.contains("Explicitly excluded"));
    }

    #[test]
    fn test_excluded_paths() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);
        policy.add_excluded_path("/admin");
        policy.add_excluded_path("/logout");

        assert!(policy.evaluate("https://example.com/api/v1").is_allowed());

        // Excluded path
        assert!(!policy.evaluate("https://example.com/admin").is_allowed());
        assert!(!policy
            .evaluate("https://example.com/admin/settings")
            .is_allowed());
        assert!(!policy.evaluate("https://example.com/logout").is_allowed());
    }

    #[test]
    fn test_protocol_restrictions() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);

        assert!(policy.evaluate("http://example.com").is_allowed());
        assert!(policy.evaluate("https://example.com").is_allowed());

        // Disallowed protocols
        assert!(!policy.evaluate("ftp://example.com").is_allowed());
        assert!(!policy.evaluate("ssh://example.com").is_allowed());
        assert!(!policy.evaluate("telnet://example.com").is_allowed());
    }

    #[test]
    fn test_malformed_and_ambiguous_targets() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);

        assert!(!policy.evaluate("").is_allowed());
        assert!(!policy.evaluate("   ").is_allowed());
        assert!(!policy.evaluate("://").is_allowed());
        assert!(!policy.evaluate("http:// bad host /").is_allowed());
    }

    #[test]
    fn test_enforce_guard() {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);

        assert!(policy.enforce("example.com").is_ok());

        let err = policy.enforce("evil.com");
        assert!(err.is_err());
        assert!(matches!(err.unwrap_err(), BountyError::ScopeViolation(_)));
    }
}
