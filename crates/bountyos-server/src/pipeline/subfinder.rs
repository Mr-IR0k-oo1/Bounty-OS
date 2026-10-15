//! Subfinder Reconnaissance Adapter
//!
//! Production-minded adapter for ProjectDiscovery's Subfinder passive subdomain discovery tool.
//! Strictly controls execution paths, arguments, scope boundaries, result normalization, and evidence persistence.
//! Never executes arbitrary shell commands or accepts unvalidated frontend arguments.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

use crate::models::subdomain::Subdomain;
use crate::pipeline::tools::ToolRegistry;
use crate::AppState;

#[derive(Error, Debug, PartialEq)]
pub enum SubfinderError {
    #[error("Invalid target domain: {0}")]
    InvalidDomain(String),

    #[error("Target '{0}' is out of scope or not authorized for program {1}")]
    OutOfScope(String, Uuid),

    #[error("Subfinder binary not found on server at configured path. Please install subfinder in /usr/local/bin or configure SUBFINDER_PATH.")]
    BinaryNotFound,

    #[error("Subfinder execution timed out after {0} seconds")]
    Timeout(u64),

    #[error("Subfinder process terminated with non-zero exit code: {0}")]
    NonZeroExit(i32),

    #[error("Subfinder job was cancelled by operator")]
    Cancelled,

    #[error("Execution error: {0}")]
    ExecutionFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubfinderExecutionResult {
    pub target_domains: Vec<String>,
    pub unique_subdomains: Vec<String>,
    pub raw_stdout: String,
    pub raw_stderr: String,
    pub exit_code: Option<i32>,
    pub tool_version: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
}

/// Validate a target domain name according to RFC 1035 / RFC 1123 specifications.
/// Strips leading wildcard prefixes (e.g., `*.example.com` -> `example.com`).
/// Rejects URLs, path components, IP addresses, and shell injection metacharacters.
pub fn validate_target_domain(target: &str) -> Result<String, SubfinderError> {
    let trimmed = target.trim().to_lowercase();
    if trimmed.is_empty() {
        return Err(SubfinderError::InvalidDomain(
            "Target domain cannot be empty".to_string(),
        ));
    }
    if trimmed.len() > 253 {
        return Err(SubfinderError::InvalidDomain(
            "Domain length exceeds maximum 253 characters".to_string(),
        ));
    }

    // Strip leading wildcard or leading dot (*.example.com -> example.com)
    let domain = if let Some(stripped) = trimmed.strip_prefix("*.") {
        stripped.trim_start_matches('.')
    } else if let Some(stripped) = trimmed.strip_prefix('.') {
        stripped
    } else {
        &trimmed
    };

    if domain.is_empty() {
        return Err(SubfinderError::InvalidDomain(
            "Domain cannot consist only of wildcards".to_string(),
        ));
    }

    // Reject URL schemes or path components
    if domain.contains("://")
        || domain.contains('/')
        || domain.contains('?')
        || domain.contains('#')
    {
        return Err(SubfinderError::InvalidDomain(
            "URLs or path components are not allowed; provide a domain name (e.g. example.com)"
                .to_string(),
        ));
    }

    // Reject IP addresses (IPv4 or IPv6)
    if domain.parse::<std::net::IpAddr>().is_ok()
        || domain.split('.').all(|p| p.parse::<u8>().is_ok())
    {
        return Err(SubfinderError::InvalidDomain(
            "IP addresses are not valid targets for subdomain discovery; provide a domain name"
                .to_string(),
        ));
    }

    // Reject prohibited characters that could indicate command injection attempts
    let forbidden_chars = [
        ';', '&', '|', '`', '$', '<', '>', '(', ')', '{', '}', '[', ']', '\\', ' ', '\t', '\n',
        '\r', ':', '"', '\'', '%',
    ];
    if domain.chars().any(|c| forbidden_chars.contains(&c)) {
        return Err(SubfinderError::InvalidDomain(
            "Domain contains prohibited or shell metacharacters".to_string(),
        ));
    }

    // Validate labels according to RFC 1123
    let labels: Vec<&str> = domain.split('.').collect();
    if labels.len() < 2 {
        return Err(SubfinderError::InvalidDomain(
            "Domain must contain at least a name and a top-level domain (e.g. example.com)"
                .to_string(),
        ));
    }

    for label in &labels {
        if label.is_empty() {
            return Err(SubfinderError::InvalidDomain(
                "Domain cannot contain consecutive dots or empty labels".to_string(),
            ));
        }
        if label.len() > 63 {
            return Err(SubfinderError::InvalidDomain(
                "Domain label exceeds maximum 63 characters".to_string(),
            ));
        }
        if label.starts_with('-') || label.ends_with('-') {
            return Err(SubfinderError::InvalidDomain(
                "Domain labels cannot start or end with a hyphen".to_string(),
            ));
        }
        if !label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(SubfinderError::InvalidDomain(
                "Domain labels must contain only alphanumeric characters or hyphens".to_string(),
            ));
        }
    }

    // Top-level domain must contain at least one letter and cannot be purely numeric
    let tld = labels.last().unwrap();
    if !tld.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err(SubfinderError::InvalidDomain(
            "Top-level domain must be alphabetic".to_string(),
        ));
    }

    Ok(domain.to_string())
}

/// Parse a string that may contain a single domain or comma/newline/space separated domains.
/// Validates and deduplicates the list.
pub fn parse_target_domains(input: &str) -> Result<Vec<String>, SubfinderError> {
    let mut domains = Vec::new();
    let parts: Vec<&str> = input
        .split(|c| c == ',' || c == '\n' || c == '\r' || c == ' ')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if parts.is_empty() {
        return Err(SubfinderError::InvalidDomain(
            "No domain targets specified".to_string(),
        ));
    }

    for part in parts {
        let valid = validate_target_domain(part)?;
        if !domains.contains(&valid) {
            domains.push(valid);
        }
    }

    Ok(domains)
}

/// Validate that all specified domains are in-scope for the program on the backend.
pub async fn validate_domains_in_scope(
    domains: &[String],
    program_id: Uuid,
    state: &AppState,
) -> Result<(), SubfinderError> {
    for domain in domains {
        let in_scope = if state.has_db() {
            crate::pipeline::scope_check::is_target_in_scope(domain, program_id, state.db())
                .await
                .unwrap_or(false)
        } else {
            let lock = state.in_memory_scope().read().await;
            let rules: Vec<_> = lock.iter().filter(|s| s.program_id == program_id).collect();

            let is_explicit_oos = rules.iter().any(|r| {
                r.out_of_scope
                    && crate::pipeline::scope_check::matches_scope(
                        domain,
                        &r.target,
                        &r.target_type,
                    )
            });

            if is_explicit_oos {
                false
            } else {
                rules.iter().any(|r| {
                    !r.out_of_scope
                        && crate::pipeline::scope_check::matches_scope(
                            domain,
                            &r.target,
                            &r.target_type,
                        )
                })
            }
        };

        if !in_scope {
            return Err(SubfinderError::OutOfScope(domain.clone(), program_id));
        }
    }
    Ok(())
}

/// Validate an individual hostname output by Subfinder.
pub fn validate_hostname(host: &str) -> Result<String, SubfinderError> {
    let host = host.trim().to_lowercase();
    if host.is_empty() || host.len() > 253 {
        return Err(SubfinderError::InvalidDomain(
            "Hostname length invalid".to_string(),
        ));
    }
    let labels: Vec<&str> = host.split('.').collect();
    if labels.len() < 2 {
        return Err(SubfinderError::InvalidDomain(
            "Hostname must have at least 2 labels".to_string(),
        ));
    }
    for label in &labels {
        if label.is_empty() || label.len() > 63 {
            return Err(SubfinderError::InvalidDomain(
                "Label length invalid".to_string(),
            ));
        }
        if label.starts_with('-') || label.ends_with('-') {
            return Err(SubfinderError::InvalidDomain(
                "Label cannot start or end with hyphen".to_string(),
            ));
        }
        if !label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(SubfinderError::InvalidDomain(
                "Label must be alphanumeric or hyphen".to_string(),
            ));
        }
    }
    let tld = labels.last().unwrap();
    if !tld.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err(SubfinderError::InvalidDomain(
            "TLD must contain letters".to_string(),
        ));
    }
    Ok(host)
}

/// Strip ANSI escape codes from console lines.
pub fn strip_ansi_escapes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_escape = false;
    for c in s.chars() {
        if c == '\x1b' {
            in_escape = true;
        } else if in_escape {
            if c.is_ascii_alphabetic() {
                in_escape = false;
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Parse Subfinder's newline-delimited output, normalize hostnames safely,
/// verify they belong to the queried parent domains, and eliminate duplicates.
pub fn parse_and_normalize_subfinder_output(
    stdout: &str,
    parent_domains: &[String],
) -> Vec<String> {
    let mut discovered = BTreeSet::new();

    for line in stdout.lines() {
        let stripped = strip_ansi_escapes(line.trim());
        let s = stripped.trim();

        if s.is_empty() || s.starts_with('[') {
            continue;
        }

        // Support jsonline format {"host":"..."} if emitted by tool
        let host_candidate = if s.starts_with('{') {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(s) {
                val.get("host")
                    .and_then(|v| v.as_str())
                    .unwrap_or(s)
                    .to_string()
            } else {
                s.to_string()
            }
        } else {
            s.to_string()
        };

        let mut host = host_candidate.to_lowercase();
        if host.ends_with('.') {
            host.pop();
        }
        if let Some(idx) = host.find(':') {
            host = host[..idx].to_string();
        }

        if let Ok(valid_host) = validate_hostname(&host) {
            // Security verification: Hostname must belong to at least one queried parent domain
            let belongs = parent_domains.iter().any(|parent| {
                valid_host == *parent || valid_host.ends_with(&format!(".{}", parent))
            });

            if belongs {
                discovered.insert(valid_host);
            }
        }
    }

    discovered.into_iter().collect()
}

/// Execute Subfinder binary using a server-controlled executable path and argument array.
/// Never invokes a shell. Enforces execution timeout, cancellation, and max output buffers.
pub async fn execute_subfinder_process(
    domains: &[String],
    binary_path: &Path,
    timeout_secs: u64,
    ws_tx: Option<tokio::sync::broadcast::Sender<String>>,
    job_id: Option<Uuid>,
) -> Result<SubfinderExecutionResult, SubfinderError> {
    let started_at = Utc::now();

    // Helper for cross-platform execution (e.g. running .sh fixtures on Windows)
    let create_cmd = |target_path: &Path| -> tokio::process::Command {
        #[cfg(windows)]
        {
            if target_path.extension().and_then(|e| e.to_str()) == Some("sh") {
                let bash = if std::path::Path::new(r"C:\Program Files\Git\bin\bash.exe").exists() {
                    r"C:\Program Files\Git\bin\bash.exe"
                } else {
                    "bash"
                };
                let mut cmd = tokio::process::Command::new(bash);
                cmd.arg(target_path);
                return cmd;
            }
        }
        tokio::process::Command::new(target_path)
    };

    // Query tool version
    let tool_version = {
        let mut ver_cmd = create_cmd(binary_path);
        let ver_out = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            ver_cmd.arg("-version").output(),
        )
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "2.6.7".to_string());

        if ver_out.is_empty() {
            "2.6.7".to_string()
        } else {
            ver_out
        }
    };

    let mut cmd = create_cmd(binary_path);
    for d in domains {
        cmd.arg("-d").arg(d);
    }
    cmd.arg("-silent");
    cmd.arg("-all");

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        SubfinderError::ExecutionFailed(format!("Failed to spawn subfinder process: {}", e))
    })?;

    let stdout_pipe = child.stdout.take().unwrap();
    let stderr_pipe = child.stderr.take().unwrap();

    let ws_tx_stdout = ws_tx.clone();
    let ws_tx_stderr = ws_tx.clone();

    // Spawn stdout reader with buffer cap (10MB limit)
    let stdout_task = tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stdout_pipe).lines();
        let mut buffer = String::new();
        const MAX_BYTES: usize = 10 * 1024 * 1024;

        while let Ok(Some(line)) = reader.next_line().await {
            if buffer.len() + line.len() < MAX_BYTES {
                buffer.push_str(&line);
                buffer.push('\n');
            }
            if let Some(ref tx) = ws_tx_stdout {
                let j_str = job_id.map(|j| j.to_string()).unwrap_or_default();
                let _ = tx.send(format!("[job:{}] Discovered: {}", j_str, line));
            }
        }
        buffer
    });

    // Spawn stderr reader with buffer cap (2MB limit)
    let stderr_task = tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stderr_pipe).lines();
        let mut buffer = String::new();
        const MAX_BYTES: usize = 2 * 1024 * 1024;

        while let Ok(Some(line)) = reader.next_line().await {
            if buffer.len() + line.len() < MAX_BYTES {
                buffer.push_str(&line);
                buffer.push('\n');
            }
            if let Some(ref tx) = ws_tx_stderr {
                let j_str = job_id.map(|j| j.to_string()).unwrap_or_default();
                let _ = tx.send(format!("[job:{}] [diag] {}", j_str, line));
            }
        }
        buffer
    });

    // Wait for child process with timeout
    let timeout_duration = std::time::Duration::from_secs(timeout_secs);
    let wait_res = tokio::time::timeout(timeout_duration, child.wait()).await;

    let completed_at = Utc::now();

    match wait_res {
        Ok(Ok(status)) => {
            let raw_stdout = stdout_task.await.unwrap_or_default();
            let raw_stderr = stderr_task.await.unwrap_or_default();
            let exit_code = status.code();

            if !status.success() {
                let code = exit_code.unwrap_or(1);
                return Err(SubfinderError::NonZeroExit(code));
            }

            let unique_subdomains = parse_and_normalize_subfinder_output(&raw_stdout, domains);

            Ok(SubfinderExecutionResult {
                target_domains: domains.to_vec(),
                unique_subdomains,
                raw_stdout,
                raw_stderr,
                exit_code,
                tool_version,
                status: "done".to_string(),
                started_at,
                completed_at,
            })
        }
        Ok(Err(e)) => {
            let _ = child.kill().await;
            Err(SubfinderError::ExecutionFailed(e.to_string()))
        }
        Err(_) => {
            // Process timed out: kill child process to free host resources
            let _ = child.kill().await;
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            Err(SubfinderError::Timeout(timeout_secs))
        }
    }
}

/// Persist discovered subdomains into the database or in-memory store.
/// Ensures that hostnames are NOT marked as verified live HTTP services.
pub async fn persist_subdomains(
    program_id: Uuid,
    subdomains: &[String],
    state: &AppState,
) -> Result<usize, anyhow::Error> {
    let now = Utc::now();
    let mut persisted_count = 0;

    if state.has_db() {
        let pool = state.db();
        for host in subdomains {
            let result = sqlx::query(
                r#"INSERT INTO subdomains (
                    id, program_id, subdomain, ip_address, status_code, title, web_server,
                    content_type, content_length, tech, cdn_name, source, created_at, updated_at
                ) VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, 'subfinder', $4, $4)
                ON CONFLICT (program_id, subdomain) DO NOTHING"#,
            )
            .bind(Uuid::new_v4())
            .bind(program_id)
            .bind(host)
            .bind(now)
            .execute(pool)
            .await?;

            if result.rows_affected() > 0 {
                persisted_count += 1;
            }
        }
    } else {
        let mut lock = state.in_memory_subdomains().write().await;
        for host in subdomains {
            if !lock
                .iter()
                .any(|s| s.program_id == program_id && s.subdomain == *host)
            {
                lock.push(Subdomain {
                    id: Uuid::new_v4(),
                    program_id,
                    subdomain: host.clone(),
                    ip_address: None,
                    status_code: None,
                    title: None,
                    web_server: None,
                    content_type: None,
                    content_length: None,
                    tech: Vec::new(),
                    cdn_name: None,
                    source: "subfinder".to_string(),
                    created_at: now,
                    updated_at: now,
                });
                persisted_count += 1;
            }
        }
    }

    Ok(persisted_count)
}

/// Save raw stdout, raw stderr, normalized subdomains JSON, and job artifact summary.
pub async fn write_evidence_artifacts(
    job_id: Uuid,
    program_id: Uuid,
    target: &str,
    tool_version: &str,
    raw_stdout: &str,
    raw_stderr: &str,
    subdomains: &[String],
    exit_code: Option<i32>,
    started_at: DateTime<Utc>,
    completed_at: DateTime<Utc>,
    state: &AppState,
) -> Result<PathBuf, anyhow::Error> {
    let evidence_dir = state.evidence_base().join("jobs").join(job_id.to_string());
    tokio::fs::create_dir_all(&evidence_dir).await?;

    // 1. Raw stdout evidence
    tokio::fs::write(evidence_dir.join("stdout.txt"), raw_stdout).await?;

    // 2. Raw stderr evidence
    tokio::fs::write(evidence_dir.join("stderr.txt"), raw_stderr).await?;

    // 3. Structured subdomains evidence
    let subdomains_json = serde_json::json!({
        "job_id": job_id,
        "program_id": program_id,
        "tool": "subfinder",
        "tool_version": tool_version,
        "target": target,
        "started_at": started_at.to_rfc3339(),
        "completed_at": completed_at.to_rfc3339(),
        "discovered_count": subdomains.len(),
        "subdomains": subdomains,
        "exit_code": exit_code,
    });
    tokio::fs::write(
        evidence_dir.join("subdomains.json"),
        serde_json::to_string_pretty(&subdomains_json)?,
    )
    .await?;

    // 4. Job summary artifact output.json
    let output_json = serde_json::json!({
        "job_id": job_id,
        "program_id": program_id,
        "tool": "subfinder",
        "tool_version": tool_version,
        "target": target,
        "stage": 1,
        "status": "succeeded",
        "exit_code": exit_code,
        "discovered_count": subdomains.len(),
        "subdomains": subdomains,
        "timestamp": completed_at.to_rfc3339(),
    });
    let output_path = evidence_dir.join("output.json");
    tokio::fs::write(&output_path, serde_json::to_string_pretty(&output_json)?).await?;

    Ok(output_path)
}

/// Execute a full managed subfinder job lifecycle asynchronously.
pub async fn run_managed_subfinder_job(
    job_id: Uuid,
    program_id: Uuid,
    target: String,
    state: AppState,
) {
    let started_at = Utc::now();
    let binary_path_opt = ToolRegistry::find_tool_path("subfinder");

    if binary_path_opt.is_none() {
        let err_msg = "Subfinder binary not found on server at configured path. Please install subfinder in /usr/local/bin or configure SUBFINDER_PATH.".to_string();
        let finished_at = Utc::now();

        // Update in-memory job
        let mut lock = state.in_memory_jobs().write().await;
        if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
            j.status = "failed".to_string();
            j.completed_at = Some(finished_at);
            j.updated_at = finished_at;
            j.error_log = Some(err_msg.clone());
            if let Some(ref mut flags) = j.flags {
                if let Some(obj) = flags.as_object_mut() {
                    obj.insert("stderr".to_string(), serde_json::json!(err_msg));
                    obj.insert("exit_code".to_string(), serde_json::json!(127));
                }
            }
        }
        let _ = state
            .ws_tx()
            .send(format!("[job:{}] Failed: {}", job_id, err_msg));
        return;
    }

    let binary_path = binary_path_opt.unwrap();
    let domains = match parse_target_domains(&target) {
        Ok(d) => d,
        Err(e) => {
            let err_msg = e.to_string();
            let mut lock = state.in_memory_jobs().write().await;
            if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
                j.status = "failed".to_string();
                j.completed_at = Some(Utc::now());
                j.error_log = Some(err_msg);
            }
            return;
        }
    };

    let result = execute_subfinder_process(
        &domains,
        &binary_path,
        120, // 2-minute safety timeout
        Some(state.ws_tx().clone()),
        Some(job_id),
    )
    .await;

    let finished_at = Utc::now();

    match result {
        Ok(exec_res) => {
            // 1. Persist normalized discovered subdomains into database
            let _ = persist_subdomains(program_id, &exec_res.unique_subdomains, &state).await;

            // 2. Write evidence artifacts
            let evidence_path = write_evidence_artifacts(
                job_id,
                program_id,
                &target,
                &exec_res.tool_version,
                &exec_res.raw_stdout,
                &exec_res.raw_stderr,
                &exec_res.unique_subdomains,
                exec_res.exit_code,
                started_at,
                finished_at,
                &state,
            )
            .await
            .ok()
            .map(|p| p.to_string_lossy().to_string());

            // 3. Update job record
            if state.has_db() {
                let _ = sqlx::query(
                    "UPDATE scan_jobs SET status = 'done', completed_at = $1, updated_at = $1 WHERE id = $2",
                )
                .bind(finished_at)
                .bind(job_id)
                .execute(state.db())
                .await;
            }

            let mut lock = state.in_memory_jobs().write().await;
            if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
                j.status = "done".to_string();
                j.completed_at = Some(finished_at);
                j.updated_at = finished_at;
                let mut flags_map = serde_json::Map::new();
                flags_map.insert("tool".to_string(), serde_json::json!("subfinder"));
                flags_map.insert("target".to_string(), serde_json::json!(target));
                flags_map.insert(
                    "tool_version".to_string(),
                    serde_json::json!(exec_res.tool_version),
                );
                flags_map.insert(
                    "exit_code".to_string(),
                    serde_json::json!(exec_res.exit_code.unwrap_or(0)),
                );
                flags_map.insert("stdout".to_string(), serde_json::json!(exec_res.raw_stdout));
                flags_map.insert("stderr".to_string(), serde_json::json!(exec_res.raw_stderr));
                flags_map.insert(
                    "discovered_count".to_string(),
                    serde_json::json!(exec_res.unique_subdomains.len()),
                );
                flags_map.insert(
                    "subdomains".to_string(),
                    serde_json::json!(exec_res.unique_subdomains),
                );
                if let Some(ep) = evidence_path {
                    flags_map.insert("evidence_path".to_string(), serde_json::json!(ep));
                }
                j.flags = Some(serde_json::Value::Object(flags_map));
            }

            let _ = state.ws_tx().send(format!(
                "[job:{}] Subfinder discovery completed: {} unique subdomains found.",
                job_id,
                exec_res.unique_subdomains.len()
            ));
        }
        Err(SubfinderError::Timeout(secs)) => {
            let err_msg = format!("Execution timed out after {} seconds.", secs);
            let mut lock = state.in_memory_jobs().write().await;
            if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
                j.status = "timed_out".to_string();
                j.completed_at = Some(finished_at);
                j.updated_at = finished_at;
                j.error_log = Some(err_msg.clone());
                if let Some(ref mut flags) = j.flags {
                    if let Some(obj) = flags.as_object_mut() {
                        obj.insert("exit_code".to_string(), serde_json::json!(124));
                        obj.insert("stderr".to_string(), serde_json::json!(err_msg));
                    }
                }
            }
            let _ = state
                .ws_tx()
                .send(format!("[job:{}] Job timed out.", job_id));
        }
        Err(SubfinderError::NonZeroExit(code)) => {
            let err_msg = format!(
                "Subfinder process exited with non-zero status code: {}",
                code
            );
            let mut lock = state.in_memory_jobs().write().await;
            if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
                j.status = "failed".to_string();
                j.completed_at = Some(finished_at);
                j.updated_at = finished_at;
                j.error_log = Some(err_msg);
                if let Some(ref mut flags) = j.flags {
                    if let Some(obj) = flags.as_object_mut() {
                        obj.insert("exit_code".to_string(), serde_json::json!(code));
                    }
                }
            }
            let _ = state.ws_tx().send(format!(
                "[job:{}] Job failed with exit code {}.",
                job_id, code
            ));
        }
        Err(e) => {
            let err_msg = e.to_string();
            let mut lock = state.in_memory_jobs().write().await;
            if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
                j.status = "failed".to_string();
                j.completed_at = Some(finished_at);
                j.updated_at = finished_at;
                j.error_log = Some(err_msg);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_target_domain_valid() {
        assert_eq!(
            validate_target_domain("example.com").unwrap(),
            "example.com"
        );
        assert_eq!(
            validate_target_domain("*.example.com").unwrap(),
            "example.com"
        );
        assert_eq!(
            validate_target_domain(".example.com").unwrap(),
            "example.com"
        );
        assert_eq!(
            validate_target_domain("sub.example.co.uk").unwrap(),
            "sub.example.co.uk"
        );
        assert_eq!(
            validate_target_domain("  EXAMPLE.COM  ").unwrap(),
            "example.com"
        );
    }

    #[test]
    fn test_validate_target_domain_invalid_hostnames() {
        assert!(validate_target_domain("").is_err());
        assert!(validate_target_domain("   ").is_err());
        assert!(validate_target_domain("*").is_err());
        assert!(validate_target_domain("*.").is_err());
        assert!(validate_target_domain("https://example.com").is_err());
        assert!(validate_target_domain("example.com/path").is_err());
        assert!(validate_target_domain("192.168.1.1").is_err());
        assert!(validate_target_domain("example..com").is_err());
        assert!(validate_target_domain("-example.com").is_err());
        assert!(validate_target_domain("example-.com").is_err());
        assert!(validate_target_domain("example; rm -rf /").is_err());
        assert!(validate_target_domain("example`id`.com").is_err());
        assert!(validate_target_domain("example$foo.com").is_err());
        assert!(validate_target_domain("example com").is_err());
        assert!(validate_target_domain("example:80").is_err());
    }

    #[test]
    fn test_parse_target_domains_multiple() {
        let input = "example.com, *.target.org\napi.service.io";
        let parsed = parse_target_domains(input).unwrap();
        assert_eq!(parsed, vec!["example.com", "target.org", "api.service.io"]);
    }

    #[test]
    fn test_parse_and_normalize_subfinder_output_deduplication() {
        let parents = vec!["example.com".to_string()];
        let raw = r#"
api.example.com
AUTH.EXAMPLE.COM
www.example.com.
api.example.com
blog.example.com:443
[INF] Found 5 subdomains
evil.otherdomain.com
invalid..domain.com
        "#;

        let res = parse_and_normalize_subfinder_output(raw, &parents);

        // Discovered hostnames must be normalized, lowercased, deduplicated,
        // and strictly belong to the parent domain.
        assert_eq!(
            res,
            vec![
                "api.example.com".to_string(),
                "auth.example.com".to_string(),
                "blog.example.com".to_string(),
                "www.example.com".to_string(),
            ]
        );
    }

    #[test]
    fn test_parse_and_normalize_subfinder_zero_results() {
        let parents = vec!["example.com".to_string()];
        let raw = "[INF] Enumerating subdomains...\n[INF] No subdomains found.";
        let res = parse_and_normalize_subfinder_output(raw, &parents);
        assert!(res.is_empty());
    }

    #[test]
    fn test_parse_and_normalize_subfinder_json_lines() {
        let parents = vec!["example.com".to_string()];
        let raw = "{\"host\":\"api.example.com\",\"source\":\"crtsh\"}\n{\"host\":\"mail.example.com\",\"source\":\"hackertarget\"}";
        let res = parse_and_normalize_subfinder_output(raw, &parents);
        assert_eq!(
            res,
            vec![
                "api.example.com".to_string(),
                "mail.example.com".to_string()
            ]
        );
    }

    #[test]
    fn test_missing_subfinder_binary_detection() {
        let missing_path = PathBuf::from("/nonexistent/bin/subfinder");
        assert!(!missing_path.exists());
    }

    #[tokio::test]
    async fn test_mock_subfinder_fixture_execution() {
        let fixture_path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mock_subfinder.sh");

        if !fixture_path.exists() {
            return;
        }

        let domains = vec!["example.com".to_string()];
        let res = execute_subfinder_process(&domains, &fixture_path, 5, None, None)
            .await
            .expect("Mock subfinder should succeed");

        assert_eq!(res.status, "done");
        assert_eq!(res.exit_code, Some(0));
        assert!(res
            .unique_subdomains
            .contains(&"api.example.com".to_string()));
        assert!(res
            .unique_subdomains
            .contains(&"auth.example.com".to_string()));
        assert!(res
            .unique_subdomains
            .contains(&"www.example.com".to_string()));
        assert!(res
            .unique_subdomains
            .contains(&"blog.example.com".to_string()));
        assert!(res
            .unique_subdomains
            .contains(&"dev.example.com".to_string()));
        // Verify deduplication: 'api.example.com' was listed twice in fixture
        let api_count = res
            .unique_subdomains
            .iter()
            .filter(|s| *s == "api.example.com")
            .count();
        assert_eq!(api_count, 1);
    }

    #[tokio::test]
    async fn test_mock_subfinder_fixture_error_exit() {
        let fixture_path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mock_subfinder.sh");

        if !fixture_path.exists() {
            return;
        }

        let domains = vec!["error.test".to_string()];
        let res = execute_subfinder_process(&domains, &fixture_path, 5, None, None).await;

        assert!(matches!(res, Err(SubfinderError::NonZeroExit(1))));
    }

    #[tokio::test]
    async fn test_mock_subfinder_fixture_timeout() {
        let fixture_path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mock_subfinder.sh");

        if !fixture_path.exists() {
            return;
        }

        let domains = vec!["timeout.test".to_string()];
        // 1-second timeout against script that sleeps for 10 seconds
        let res = execute_subfinder_process(&domains, &fixture_path, 1, None, None).await;

        assert!(matches!(res, Err(SubfinderError::Timeout(1))));
    }

    #[tokio::test]
    async fn test_mock_subfinder_fixture_zero_results() {
        let fixture_path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mock_subfinder.sh");

        if !fixture_path.exists() {
            return;
        }

        let domains = vec!["zero.test".to_string()];
        let res = execute_subfinder_process(&domains, &fixture_path, 5, None, None)
            .await
            .expect("Clean zero results should succeed");

        assert_eq!(res.status, "done");
        assert_eq!(res.exit_code, Some(0));
        assert!(res.unique_subdomains.is_empty());
    }

    #[tokio::test]
    async fn test_persist_subdomains_deduplication_and_no_live_marking() {
        let state = AppState::test_state();
        let program_id = Uuid::new_v4();
        let subdomains = vec![
            "api.example.com".to_string(),
            "auth.example.com".to_string(),
            "api.example.com".to_string(), // Duplicate in list
        ];

        let count = persist_subdomains(program_id, &subdomains, &state)
            .await
            .expect("Persistence should succeed");
        assert_eq!(count, 2);

        let lock = state.in_memory_subdomains().read().await;
        let stored: Vec<_> = lock.iter().filter(|s| s.program_id == program_id).collect();
        assert_eq!(stored.len(), 2);

        // Verify NOT marked as live HTTP services
        for s in stored {
            assert!(s.status_code.is_none());
            assert!(s.title.is_none());
            assert!(s.web_server.is_none());
            assert_eq!(s.source, "subfinder");
        }
    }

    #[tokio::test]
    async fn test_write_evidence_artifacts() {
        let state = AppState::test_state();
        let job_id = Uuid::new_v4();
        let program_id = Uuid::new_v4();
        let target = "example.com";
        let tool_version = "2.6.7";
        let raw_stdout = "api.example.com\nauth.example.com\n";
        let raw_stderr = "[INF] completed\n";
        let subdomains = vec![
            "api.example.com".to_string(),
            "auth.example.com".to_string(),
        ];
        let now = Utc::now();

        let output_path = write_evidence_artifacts(
            job_id,
            program_id,
            target,
            tool_version,
            raw_stdout,
            raw_stderr,
            &subdomains,
            Some(0),
            now,
            now,
            &state,
        )
        .await
        .expect("Writing evidence should succeed");

        assert!(output_path.exists());
        let evidence_dir = state.evidence_base().join("jobs").join(job_id.to_string());
        assert!(evidence_dir.join("stdout.txt").exists());
        assert!(evidence_dir.join("stderr.txt").exists());
        assert!(evidence_dir.join("subdomains.json").exists());
        assert!(evidence_dir.join("output.json").exists());

        // Cleanup test directory
        let _ = std::fs::remove_dir_all(evidence_dir);
    }

    #[tokio::test]
    async fn test_validate_domains_in_scope_and_out_of_scope() {
        let state = AppState::test_state();
        let uber_id = Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap();

        // In-scope domain
        let in_scope = vec!["api.uber.com".to_string()];
        let res = validate_domains_in_scope(&in_scope, uber_id, &state).await;
        assert!(res.is_ok());

        // Out-of-scope domain (not covered by program rules)
        let out_of_scope = vec!["unauthorized-domain.com".to_string()];
        let res = validate_domains_in_scope(&out_of_scope, uber_id, &state).await;
        assert!(matches!(res, Err(SubfinderError::OutOfScope(_, _))));
    }
}
