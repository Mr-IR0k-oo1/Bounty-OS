use sqlx::PgPool;
use std::net::Ipv4Addr;
use std::str::FromStr;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum ScopeError {
    #[error("Target {0} is out of scope for program {1}")]
    OutOfScope(String, Uuid),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Stage validation failed: program {0} stage {1} not approved")]
    StageNotApproved(Uuid, i32),
}

#[derive(sqlx::FromRow)]
struct ScopeRule {
    target: String,
    target_type: String,
    out_of_scope: bool,
}

pub fn matches_scope(target: &str, rule: &str, target_type: &str) -> bool {
    let target = target.trim().to_lowercase();
    let rule = rule.trim().to_lowercase();

    if target == rule {
        return true;
    }

    match target_type {
        "wildcard" => {
            let base = rule.trim_start_matches("*.").trim_start_matches('.');
            target == base || target.ends_with(&format!(".{}", base))
        }
        "domain" => {
            if rule.starts_with("*.") || rule.starts_with('.') {
                let base = rule.trim_start_matches("*.").trim_start_matches('.');
                target == base || target.ends_with(&format!(".{}", base))
            } else {
                target == rule
            }
        }
        "cidr" => ip_in_cidr(&target, &rule),
        "ip" => target == rule,
        "url" => target.starts_with(&rule),
        _ => target == rule,
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

pub async fn is_target_in_scope(
    target: &str,
    program_id: Uuid,
    pool: &PgPool,
) -> Result<bool, ScopeError> {
    let rules: Vec<ScopeRule> = sqlx::query_as::<_, ScopeRule>(
        "SELECT target, target_type, out_of_scope FROM scope_targets WHERE program_id = $1",
    )
    .bind(program_id)
    .fetch_all(pool)
    .await?;

    // Check out-of-scope rules first: explicit exclusion takes precedence
    for rule in rules.iter().filter(|r| r.out_of_scope) {
        if matches_scope(target, &rule.target, &rule.target_type) {
            return Err(ScopeError::OutOfScope(target.to_string(), program_id));
        }
    }

    // Check in-scope rules
    for rule in rules.iter().filter(|r| !r.out_of_scope) {
        if matches_scope(target, &rule.target, &rule.target_type) {
            return Ok(true);
        }
    }

    Ok(false)
}

pub async fn validate_scan_stage(
    program_id: Uuid,
    stage: i32,
    pool: &PgPool,
) -> Result<bool, ScopeError> {
    if stage >= 3 {
        let approved: bool =
            sqlx::query_scalar("SELECT active_approved FROM programs WHERE id = $1")
                .bind(program_id)
                .fetch_one(pool)
                .await?;

        if !approved {
            return Err(ScopeError::StageNotApproved(program_id, stage));
        }
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wildcard_scope() {
        assert!(matches_scope(
            "api.example.com",
            "*.example.com",
            "wildcard"
        ));
        assert!(matches_scope("example.com", "*.example.com", "wildcard"));
        assert!(matches_scope(
            "sub.deep.example.com",
            "*.example.com",
            "wildcard"
        ));
        assert!(!matches_scope(
            "notexample.com",
            "*.example.com",
            "wildcard"
        ));
    }

    #[test]
    fn test_cidr_scope() {
        assert!(matches_scope("192.168.1.50", "192.168.1.0/24", "cidr"));
        assert!(!matches_scope("192.168.2.50", "192.168.1.0/24", "cidr"));
    }

    #[test]
    fn test_domain_exact_scope() {
        assert!(matches_scope("example.com", "example.com", "domain"));
        assert!(!matches_scope("other.com", "example.com", "domain"));
    }
}
