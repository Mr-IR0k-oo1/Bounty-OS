use crate::analyzer::ast::classify_cwe_ast;

pub fn classify_cwe(code: &str) -> Option<&'static str> {
    // Prefer precise Tree-sitter AST analysis
    if let Some(tree) = crate::analyzer::ast::parse_c(code) {
        let root = tree.root_node();
        // If the AST is valid (has children / declarations), use AST classification
        if root.named_child_count() > 0 {
            return classify_cwe_ast(code);
        }
    }

    // Heuristic fallback for partial / unparseable code fragments
    classify_cwe_fallback(code)
}

pub fn has_deterministic_vulnerability(code: &str) -> bool {
    classify_cwe(code).is_some()
}

#[allow(dead_code)]
pub fn has_strong_evidence(code: &str) -> bool {
    classify_cwe(code).is_some()
}

fn classify_cwe_fallback(code: &str) -> Option<&'static str> {
    // CWE-78: OS Command Injection
    if code.contains("system(")
        && (code.contains("snprintf(")
            || code.contains("sprintf(")
            || code.contains("strcat(")
            || code.contains("strcpy("))
    {
        return Some("CWE-78");
    }

    // CWE-134: Format String
    if code.contains("printf(input)") || code.contains("printf (input)") {
        return Some("CWE-134");
    }

    // CWE-416: Use After Free
    if has_use_after_free(code) {
        return Some("CWE-416");
    }

    // CWE-415: Double Free
    if has_double_free(code) {
        return Some("CWE-415");
    }

    None
}

fn has_double_free(code: &str) -> bool {
    let mut freed_variables = Vec::new();

    for line in code.lines() {
        let line = line.trim();

        if let Some(variable) = extract_free_variable(line) {
            if freed_variables.contains(&variable) {
                return true;
            }

            freed_variables.push(variable);
        }
    }

    false
}

#[allow(unused_assignments)]
fn has_use_after_free(code: &str) -> bool {
    let lines: Vec<&str> = code.lines().collect();

    for (index, line) in lines.iter().enumerate() {
        let line = line.trim();

        let Some(variable) = extract_free_variable(line) else {
            continue;
        };

        let mut pointer_invalidated = true;

        for later_line in lines.iter().skip(index + 1) {
            let later_line = later_line.trim();

            if later_line.is_empty() {
                continue;
            }

            if extract_free_variable(later_line).is_some() {
                continue;
            }

            if is_null_assignment(later_line, &variable) {
                pointer_invalidated = false;
                break;
            }

            if pointer_invalidated && is_dereference_of_variable(later_line, &variable) {
                return true;
            }
        }
    }

    false
}

fn is_null_assignment(line: &str, variable: &str) -> bool {
    let normalized = line.replace(' ', "");

    normalized == format!("{variable}=NULL;") || normalized == format!("{variable}=nullptr;")
}

fn is_dereference_of_variable(line: &str, variable: &str) -> bool {
    line.contains(&format!("{variable}["))
        || line.contains(&format!("*{variable}"))
        || line.contains(&format!("{variable}->"))
}

fn extract_free_variable(line: &str) -> Option<String> {
    let line = line.trim();
    let prefix = "free(";

    let start = line.find(prefix)?;
    let remainder = &line[start + prefix.len()..];
    let end = remainder.find(')')?;

    let variable = remainder[..end].trim();

    if variable.is_empty() {
        None
    } else {
        Some(variable.to_string())
    }
}
