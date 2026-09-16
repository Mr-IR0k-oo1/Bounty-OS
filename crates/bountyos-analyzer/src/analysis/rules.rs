use super::c::BufferCopyFact;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuleFinding {
    pub cwe: &'static str,
    pub vulnerability: &'static str,
    pub severity: &'static str,
    pub evidence: String,
    pub remediation: &'static str,
}

pub fn detect_buffer_overflow(fact: &BufferCopyFact) -> Option<RuleFinding> {
    let size = fact.destination_size?;

    if size == 0 {
        return None;
    }

    if is_string_literal(&fact.source) {
        return None;
    }

    if fact.operation != "strcpy" && fact.operation != "strcat" {
        return None;
    }

    Some(RuleFinding {
        cwe: "CWE-121",
        vulnerability: "Stack-based Buffer Overflow",
        severity: "High",

        evidence: format!(
            "{}() copies non-literal source '{}' into fixed-size stack buffer '{}' ({} bytes) at line {}.",
            fact.operation,
            fact.source,
            fact.destination,
            size,
            fact.line,
        ),

        remediation:
            "Replace unbounded string operations with bounds-aware handling and ensure the destination cannot be exceeded.",
    })
}

fn is_string_literal(value: &str) -> bool {
    let value = value.trim();

    value.starts_with('"') && value.ends_with('"')
}
