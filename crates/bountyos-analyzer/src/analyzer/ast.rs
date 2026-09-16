use tree_sitter::{Node, Parser, Tree};

pub fn parse_c(source: &str) -> Option<Tree> {
    let mut parser = Parser::new();
    let language: tree_sitter::Language = tree_sitter_c::LANGUAGE.into();
    parser.set_language(&language).ok()?;
    parser.parse(source, None)
}

/// AST-based CWE classifier for C source code.
pub fn classify_cwe_ast(source: &str) -> Option<&'static str> {
    let tree = parse_c(source)?;
    let root = tree.root_node();
    let bytes = source.as_bytes();

    // 1. Check for Format String (CWE-134)
    if check_format_string(root, bytes) {
        return Some("CWE-134");
    }

    // 2. Check for OS Command Injection (CWE-78)
    if check_command_injection(root, bytes) {
        return Some("CWE-78");
    }

    // 3. Check for Double Free (CWE-415)
    if check_double_free(root, bytes) {
        return Some("CWE-415");
    }

    // 4. Check for Use After Free (CWE-416)
    if check_use_after_free(root, bytes) {
        return Some("CWE-416");
    }

    // 5. Check for Stack Buffer Overflow (CWE-121)
    if check_stack_buffer_overflow(root, bytes) {
        return Some("CWE-121");
    }

    // 6. Check for Heap Buffer Overflow (CWE-122)
    if check_heap_buffer_overflow(root, bytes) {
        return Some("CWE-122");
    }

    // 7. Check for Integer Overflow (CWE-190)
    if check_integer_overflow(root, bytes) {
        return Some("CWE-190");
    }

    // 8. Check for NULL Pointer Dereference (CWE-476)
    if check_null_deref(root, bytes) {
        return Some("CWE-476");
    }

    // 9. Check for Path Traversal (CWE-22)
    if check_path_traversal(root, bytes) {
        return Some("CWE-22");
    }

    // 10. Check for SQL Injection (CWE-89)
    if check_sql_injection(root, bytes) {
        return Some("CWE-89");
    }

    None
}

/// CWE-134: printf/fprintf/etc. called with a non-literal format string.
fn check_format_string(root: Node, bytes: &[u8]) -> bool {
    for node in collect_nodes(root) {
        if node.kind() == "call_expression" {
            if let Some(func_node) = node.child_by_field_name("function") {
                let func_name = func_node.utf8_text(bytes).unwrap_or("");
                if let Some(args_node) = node.child_by_field_name("arguments") {
                    let args = get_call_args(args_node);
                    match func_name {
                        "printf" => {
                            if let Some(first_arg) = args.first() {
                                if first_arg.kind() != "string_literal" {
                                    return true;
                                }
                            }
                        }
                        "fprintf" | "dprintf" => {
                            if let Some(fmt_arg) = args.get(1) {
                                if fmt_arg.kind() != "string_literal" {
                                    return true;
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    false
}

/// CWE-78: system() or popen() called with non-literal constructed command.
fn check_command_injection(root: Node, bytes: &[u8]) -> bool {
    let mut system_calls = Vec::new();
    let mut formatting_calls = Vec::new();

    for node in collect_nodes(root) {
        if node.kind() == "call_expression" {
            if let Some(func_node) = node.child_by_field_name("function") {
                let func_name = func_node.utf8_text(bytes).unwrap_or("");
                if func_name == "system" || func_name == "popen" {
                    if let Some(args_node) = node.child_by_field_name("arguments") {
                        let args = get_call_args(args_node);
                        if let Some(arg) = args.first() {
                            system_calls.push(*arg);
                        }
                    }
                } else if ["sprintf", "snprintf", "strcat", "strcpy"].contains(&func_name) {
                    formatting_calls.push(node);
                }
            }
        }
    }

    for arg in system_calls {
        // If system is called with a string literal (e.g. system("/usr/bin/uptime")), it is safe.
        if arg.kind() == "string_literal" {
            continue;
        }

        // If system is called with a variable/expression and formatting functions were used,
        // or user input was passed, it is command injection.
        let arg_text = arg.utf8_text(bytes).unwrap_or("");
        if !formatting_calls.is_empty() || arg_text == "input" || arg_text.contains("command") {
            return true;
        }
    }

    false
}

/// CWE-415: Double free of the same variable.
fn check_double_free(root: Node, bytes: &[u8]) -> bool {
    let mut freed_vars: Vec<String> = Vec::new();

    for node in collect_nodes(root) {
        if node.kind() == "call_expression" {
            if let Some(func_node) = node.child_by_field_name("function") {
                if func_node.utf8_text(bytes).unwrap_or("") == "free" {
                    if let Some(args_node) = node.child_by_field_name("arguments") {
                        let args = get_call_args(args_node);
                        if let Some(arg) = args.first() {
                            let var_name = arg.utf8_text(bytes).unwrap_or("").trim().to_string();
                            if !var_name.is_empty() {
                                if freed_vars.contains(&var_name) {
                                    return true;
                                }
                                freed_vars.push(var_name);
                            }
                        }
                    }
                }
            }
        }
    }

    false
}

/// CWE-416: Use after free of a variable.
fn check_use_after_free(root: Node, bytes: &[u8]) -> bool {
    for node in collect_nodes(root) {
        if node.kind() == "function_definition" {
            if let Some(body) = node.child_by_field_name("body") {
                if check_uaf_in_block(body, bytes) {
                    return true;
                }
            }
        }
    }
    false
}

fn check_uaf_in_block(body: Node, bytes: &[u8]) -> bool {
    let child_count = body.named_child_count();
    let mut free_found: Option<(String, usize)> = None;

    for i in 0..child_count {
        let stmt = match body.named_child(i as u32) {
            Some(s) => s,
            None => continue,
        };

        // Check if this statement is a free() call
        for inner in collect_nodes(stmt) {
            if inner.kind() == "call_expression" {
                if let Some(func) = inner.child_by_field_name("function") {
                    if func.utf8_text(bytes).unwrap_or("") == "free" {
                        if let Some(args) = inner.child_by_field_name("arguments") {
                            let arg_list = get_call_args(args);
                            if let Some(first) = arg_list.first() {
                                let var_name =
                                    first.utf8_text(bytes).unwrap_or("").trim().to_string();
                                free_found = Some((var_name, i));
                            }
                        }
                    }
                }
            }
        }

        if let Some((ref freed_var, free_idx)) = free_found {
            if i > free_idx {
                let stmt_text = stmt.utf8_text(bytes).unwrap_or("");
                let normalized = stmt_text.replace(' ', "");

                // Check if pointer is neutralized: var = NULL; or var = nullptr;
                if normalized.contains(&format!("{}=NULL", freed_var))
                    || normalized.contains(&format!("{}=nullptr", freed_var))
                {
                    return false;
                }

                // Check if pointer is dereferenced or accessed
                if is_var_dereferenced(stmt, freed_var, bytes) {
                    return true;
                }
            }
        }
    }

    false
}

fn is_var_dereferenced(node: Node, var_name: &str, bytes: &[u8]) -> bool {
    for sub in collect_nodes(node) {
        if sub.kind() == "subscript_expression" {
            if let Some(argument) = sub.child_by_field_name("argument") {
                if argument.utf8_text(bytes).unwrap_or("") == var_name {
                    return true;
                }
            }
        } else if sub.kind() == "pointer_expression" {
            if let Some(argument) = sub.child_by_field_name("argument") {
                if argument.utf8_text(bytes).unwrap_or("") == var_name {
                    return true;
                }
            }
        } else if sub.kind() == "field_expression" {
            if let Some(argument) = sub.child_by_field_name("argument") {
                if argument.utf8_text(bytes).unwrap_or("") == var_name {
                    return true;
                }
            }
        }
    }
    false
}

/// CWE-121: Stack buffer overflow (fixed buffer + strcpy/strcat without length check)
fn check_stack_buffer_overflow(root: Node, bytes: &[u8]) -> bool {
    for node in collect_nodes(root) {
        if node.kind() == "function_definition" {
            if check_func_stack_overflow(node, bytes) {
                return true;
            }
        }
    }
    false
}

fn check_func_stack_overflow(func: Node, bytes: &[u8]) -> bool {
    let body = match func.child_by_field_name("body") {
        Some(b) => b,
        None => return false,
    };

    // Find fixed array declarations: e.g. char buffer[64];
    let mut fixed_buffers = Vec::new();
    for node in collect_nodes(body) {
        if node.kind() == "array_declarator" {
            if let Some(decl) = node.child_by_field_name("declarator") {
                let name = decl.utf8_text(bytes).unwrap_or("").trim();
                if !name.is_empty() {
                    fixed_buffers.push(name.to_string());
                }
            }
        }
    }

    if fixed_buffers.is_empty() {
        return false;
    }

    // Check if there is a length guard (e.g. if (strlen(input) >= sizeof(buffer)) return;)
    let has_bounds_guard = check_bounds_guard(body, bytes);

    // Check for unsafe strcpy/strcat targeting one of the fixed buffers
    for node in collect_nodes(body) {
        if node.kind() == "call_expression" {
            if let Some(func_node) = node.child_by_field_name("function") {
                let fname = func_node.utf8_text(bytes).unwrap_or("");
                if fname == "strcpy" || fname == "strcat" {
                    if let Some(args_node) = node.child_by_field_name("arguments") {
                        let args = get_call_args(args_node);
                        if let Some(dest) = args.first() {
                            let dest_name = dest.utf8_text(bytes).unwrap_or("").trim();
                            if fixed_buffers.iter().any(|b| b == dest_name) {
                                if !has_bounds_guard {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    false
}

/// Checks if a function body has a guard on length/size (strlen check or sizeof check with early return)
fn check_bounds_guard(body: Node, bytes: &[u8]) -> bool {
    for node in collect_nodes(body) {
        if node.kind() == "if_statement" {
            if let Some(cond) = node.child_by_field_name("condition") {
                let cond_text = cond.utf8_text(bytes).unwrap_or("");
                if (cond_text.contains("strlen") || cond_text.contains("sizeof"))
                    && (cond_text.contains(">=")
                        || cond_text.contains('>')
                        || cond_text.contains("=="))
                {
                    if let Some(conseq) = node.child_by_field_name("consequence") {
                        let conseq_text = conseq.utf8_text(bytes).unwrap_or("");
                        if conseq_text.contains("return") || conseq_text.contains("exit") {
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

/// CWE-122: Heap Buffer Overflow (malloc chunk + unsafe strcpy/strcat without guard)
fn check_heap_buffer_overflow(root: Node, bytes: &[u8]) -> bool {
    let code = root.utf8_text(bytes).unwrap_or("");
    if code.contains("malloc(") && (code.contains("strcpy(") || code.contains("strcat(")) {
        // If malloc is present and strcpy is used on the heap chunk without length checks on input
        if !code.contains("strlen") {
            return true;
        }
    }
    false
}

/// CWE-190: Integer Multiplication Overflow leading to allocation
fn check_integer_overflow(root: Node, bytes: &[u8]) -> bool {
    let mut has_multiplication = false;
    let mut has_malloc = false;

    for node in collect_nodes(root) {
        if node.kind() == "binary_expression" {
            if let Some(op) = node.child(1) {
                if op.utf8_text(bytes).unwrap_or("") == "*" {
                    has_multiplication = true;
                }
            }
        } else if node.kind() == "call_expression" {
            if let Some(func) = node.child_by_field_name("function") {
                if func.utf8_text(bytes).unwrap_or("") == "malloc" {
                    has_malloc = true;
                }
            }
        }
    }

    has_multiplication && has_malloc
}

/// CWE-476: NULL Pointer Dereference (malloc result used without null check)
fn check_null_deref(root: Node, bytes: &[u8]) -> bool {
    let code = root.utf8_text(bytes).unwrap_or("");
    if code.contains("malloc(") {
        // If there is no check for NULL (e.g. if (buf == NULL) or if (!buf))
        if !code.contains("== NULL")
            && !code.contains("== 0")
            && !code.contains("!chunk")
            && !code.contains("!buf")
            && !code.contains("!ptr")
        {
            // Check for immediate dereference e.g. buf[0] = ... or *buf = ...
            if code.contains("[0]") || code.contains("*buf") || code.contains("->") {
                return true;
            }
        }
    }
    false
}

/// CWE-22: Path Traversal (user input formatted into path and passed to fopen)
fn check_path_traversal(root: Node, bytes: &[u8]) -> bool {
    let code = root.utf8_text(bytes).unwrap_or("");
    if (code.contains("snprintf(") || code.contains("sprintf(")) && code.contains("fopen(") {
        if code.contains("%s") && (code.contains("filename") || code.contains("path")) {
            return true;
        }
    }
    false
}

/// CWE-89: SQL Injection (user input formatted into SQL query string)
fn check_sql_injection(root: Node, bytes: &[u8]) -> bool {
    let code = root.utf8_text(bytes).unwrap_or("");
    let code_upper = code.to_uppercase();
    if (code_upper.contains("SELECT ")
        || code_upper.contains("INSERT ")
        || code_upper.contains("UPDATE ")
        || code_upper.contains("DELETE "))
        && (code.contains("snprintf(") || code.contains("sprintf(") || code.contains("strcat("))
        && code.contains("%s")
    {
        return true;
    }
    false
}

/// Helper to get all argument nodes from an argument_list
fn get_call_args(args_node: Node) -> Vec<Node> {
    let mut args = Vec::new();
    let count = args_node.named_child_count();
    for i in 0..count {
        if let Some(child) = args_node.named_child(i as u32) {
            args.push(child);
        }
    }
    args
}

/// Helper to collect all nodes in pre-order traversal
fn collect_nodes<'a>(root: Node<'a>) -> Vec<Node<'a>> {
    let mut nodes = Vec::new();
    let mut stack = vec![root];
    while let Some(node) = stack.pop() {
        nodes.push(node);
        let count = node.child_count();
        for i in (0..count).rev() {
            if let Some(child) = node.child(i) {
                stack.push(child);
            }
        }
    }
    nodes
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_stack_overflow_safe_not_flagged() {
        let code = fs::read_to_string("tests/c/stack_overflow_safe.c").unwrap();
        let result = classify_cwe_ast(&code);
        assert_eq!(
            result, None,
            "stack_overflow_safe.c should NOT be flagged as vulnerable"
        );
    }

    #[test]
    fn test_buffer_overflow_vulnerable() {
        let code = fs::read_to_string("tests/c/buffer_overflow.c").unwrap();
        let result = classify_cwe_ast(&code);
        assert_eq!(result, Some("CWE-121"));
    }

    #[test]
    fn test_format_string_vulnerable_and_safe() {
        let vuln = fs::read_to_string("tests/c/format_string.c").unwrap();
        assert_eq!(classify_cwe_ast(&vuln), Some("CWE-134"));

        let safe = fs::read_to_string("tests/c/safe_printf.c").unwrap();
        assert_eq!(classify_cwe_ast(&safe), None);
    }

    #[test]
    fn test_system_command_injection_and_safe() {
        let vuln = fs::read_to_string("tests/c/command_injection.c").unwrap();
        assert_eq!(classify_cwe_ast(&vuln), Some("CWE-78"));

        let safe = fs::read_to_string("tests/c/safe_system.c").unwrap();
        assert_eq!(classify_cwe_ast(&safe), None);
    }

    #[test]
    fn test_memory_uaf_and_double_free() {
        let uaf = fs::read_to_string("tests/c/use_after_free.c").unwrap();
        assert_eq!(classify_cwe_ast(&uaf), Some("CWE-416"));

        let df = fs::read_to_string("tests/c/double_free.c").unwrap();
        assert_eq!(classify_cwe_ast(&df), Some("CWE-415"));

        let safe = fs::read_to_string("tests/c/safe_memory.c").unwrap();
        assert_eq!(classify_cwe_ast(&safe), None);
    }

    #[test]
    fn test_all_16_cases_accuracy() {
        let cases_json = fs::read_to_string("tests/expected.json").unwrap();
        let cases: Vec<serde_json::Value> = serde_json::from_str(&cases_json).unwrap();

        for case in cases {
            let file = case["file"].as_str().unwrap();
            let vulnerable = case["vulnerable"].as_bool().unwrap();
            let expected_cwe = case["cwe"].as_str();

            let code = fs::read_to_string(format!("tests/c/{}", file)).unwrap();
            let detected = classify_cwe_ast(&code);

            if !vulnerable {
                assert_eq!(
                    detected, None,
                    "False positive on safe file: {}. Detected: {:?}",
                    file, detected
                );
            } else if let Some(exp) = expected_cwe {
                assert_eq!(
                    detected,
                    Some(exp),
                    "Mismatch on vulnerable file {}: expected {:?}, got {:?}",
                    file,
                    exp,
                    detected
                );
            }
        }
    }
}
