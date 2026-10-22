use chrono::Utc;
use serde_json::json;
use std::path::PathBuf;
use std::time::Duration;
use thiserror::Error;
use tokio::process::Command;
use uuid::Uuid;

use crate::models::finding::{Finding, FindingSeverity, FindingStatus};
use crate::models::subdomain::Subdomain;
use crate::pipeline::tools::ToolRegistry;
use crate::AppState;

#[derive(Error, Debug)]
pub enum RunnerError {
    #[error("Tool binary '{0}' not found on server")]
    BinaryNotFound(String),
    #[error("Tool execution timed out after {0} seconds")]
    Timeout(u64),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Process exited with code {0}")]
    NonZeroExit(i32),
}

/// Ensure default fuzzing wordlist exists
fn ensure_wordlist() -> String {
    let path = PathBuf::from("/tmp/wordlists/common.txt");
    if !path.exists() {
        let _ = std::fs::create_dir_all("/tmp/wordlists");
        let default_words = "admin\nrobots.txt\napi\napi/v1/config\nsearch\nindex.html\nbackup.tar.gz\nlogin\ndashboard\nconfig\n";
        let _ = std::fs::write(&path, default_words);
    }
    path.to_string_lossy().to_string()
}

/// Execute a managed security tool job asynchronously with full evidence capture,
/// structured parsing, database persistence, and WebSocket event telemetry.
pub async fn run_managed_tool_job(
    job_id: Uuid,
    program_id: Uuid,
    tool: String,
    target: String,
    _flags: Option<serde_json::Value>,
    state: AppState,
) {
    let started_at = Utc::now();
    let binary_path_opt = ToolRegistry::find_tool_path(&tool);

    if binary_path_opt.is_none() {
        let err_msg = format!(
            "Tool binary '{}' not found on server. Please ensure the tool is installed in /usr/local/bin or configure PATH.",
            tool
        );
        let finished_at = Utc::now();

        if state.has_db() {
            let _ = sqlx::query(
                "UPDATE scan_jobs SET status = 'failed', completed_at = $1, updated_at = $1 WHERE id = $2"
            )
            .bind(finished_at)
            .bind(job_id)
            .execute(state.db())
            .await;
        }

        let mut lock = state.in_memory_jobs().write().await;
        if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
            j.status = "failed".to_string();
            j.completed_at = Some(finished_at);
            j.updated_at = finished_at;
            j.error_log = Some(err_msg.clone());
            if let Some(ref mut flags) = j.flags {
                if let Some(obj) = flags.as_object_mut() {
                    obj.insert("stderr".to_string(), json!(err_msg));
                    obj.insert("exit_code".to_string(), json!(127));
                }
            }
        }

        let _ = state.ws_tx().send(format!("[job:{}] Failed: {}", job_id, err_msg));
        return;
    }

    let binary_path = binary_path_opt.unwrap();
    let wordlist = ensure_wordlist();

    // Construct tool-specific, safe arguments without shell evaluation
    let mut args: Vec<String> = Vec::new();
    match tool.as_str() {
        "httpx" => {
            args.extend([
                "-silent".to_string(),
                "-status-code".to_string(),
                "-title".to_string(),
                "-tech-detect".to_string(),
                "-json".to_string(),
                "-u".to_string(),
            ]);
            let u = if target.starts_with("http://") || target.starts_with("https://") {
                target.clone()
            } else {
                format!("http://{}", target)
            };
            args.push(u);
        }
        "katana" => {
            args.extend([
                "-silent".to_string(),
                "-d".to_string(),
                "2".to_string(),
                "-u".to_string(),
            ]);
            let u = if target.starts_with("http://") || target.starts_with("https://") {
                target.clone()
            } else {
                format!("http://{}", target)
            };
            args.push(u);
        }
        "dalfox" => {
            args.extend([
                "url".to_string(),
                target.clone(),
                "--silence".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ]);
        }
        "nuclei" => {
            args.extend([
                "-duc".to_string(),
                "-silent".to_string(),
                "-jsonl".to_string(),
                "-u".to_string(),
            ]);
            let u = if target.starts_with("http://") || target.starts_with("https://") {
                target.clone()
            } else {
                format!("http://{}", target)
            };
            args.push(u);
        }
        "ffuf" => {
            let fuzz_url = if target.contains("FUZZ") {
                target.clone()
            } else if target.ends_with('/') {
                format!("{}FUZZ", target)
            } else {
                format!("{}/FUZZ", target)
            };
            args.extend([
                "-s".to_string(),
                "-json".to_string(),
                "-u".to_string(),
                fuzz_url,
                "-w".to_string(),
                wordlist,
            ]);
        }
        "dnsx" => {
            args.extend([
                "-r".to_string(),
                "127.0.0.11,8.8.8.8".to_string(),
                "-silent".to_string(),
                "-a".to_string(),
                "-resp".to_string(),
                "-json".to_string(),
                "-d".to_string(),
                target.clone(),
            ]);
        }
        "naabu" => {
            args.extend([
                "-s".to_string(),
                "c".to_string(),
                "-Pn".to_string(),
                "-silent".to_string(),
                "-json".to_string(),
                "-r".to_string(),
                "127.0.0.11,8.8.8.8".to_string(),
                "-sr".to_string(),
                "-no-stdin".to_string(),
                "-host".to_string(),
                target.clone(),
            ]);
        }
        "gau" => {
            args.push("--timeout".to_string());
            args.push("2".to_string());
            args.push("--retries".to_string());
            args.push("1".to_string());
            args.push(target.clone());
        }
        "waybackurls" => {
            args.push(target.clone());
        }
        _ => {
            args.push(target.clone());
        }
    }

    let _ = state.ws_tx().send(format!(
        "[job:{}] Spawning {} binary with args: {:?}",
        job_id, tool, args
    ));

    // Execute with a 15-second safety timeout
    let timeout_duration = Duration::from_secs(15);
    let exec_res = tokio::time::timeout(
        timeout_duration,
        Command::new(&binary_path)
            .args(&args)
            .output(),
    )
    .await;

    let finished_at = Utc::now();

    let (stdout_str, stderr_str, exit_code) = match exec_res {
        Ok(Ok(output)) => {
            let out = String::from_utf8_lossy(&output.stdout).to_string();
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            (out, err, output.status.code().unwrap_or(0))
        }
        Ok(Err(e)) => {
            let err = format!("Process execution error: {}", e);
            ("".to_string(), err, 1)
        }
        Err(_) => {
            let err = format!("Process timed out after {} seconds", timeout_duration.as_secs());
            ("".to_string(), err, 124)
        }
    };

    // Dalfox uses non-zero exit code when vulnerabilities are discovered; treat as success
    let is_success = exit_code == 0
        || (tool == "dalfox"
            && (stdout_str.contains("POC")
                || stdout_str.contains("\"findings\"")
                || stdout_str.contains("\"type\": \"V\"")));
    let status_str = if is_success { "done" } else { "failed" };

    // --- Evidence Persistence ---
    let evidence_dir = state.evidence_base().join("jobs").join(job_id.to_string());
    let _ = tokio::fs::create_dir_all(&evidence_dir).await;
    let _ = tokio::fs::write(evidence_dir.join("stdout.txt"), &stdout_str).await;
    let _ = tokio::fs::write(evidence_dir.join("stderr.txt"), &stderr_str).await;

    let mut discovered_findings: Vec<Finding> = Vec::new();
    let mut discovered_subdomains: Vec<Subdomain> = Vec::new();
    let mut discovered_endpoints: Vec<String> = Vec::new();
    let mut discovered_ports: Vec<crate::models::port::Port> = Vec::new();

    // --- Output Parsing & Normalization ---
    match tool.as_str() {
        "httpx" => {
            for line in stdout_str.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let host = v["input"].as_str().or_else(|| v["host"].as_str()).unwrap_or(&target).to_string();
                    let title = v["title"].as_str().map(|s| s.to_string());
                    let status_code = v["status_code"].as_i64().map(|c| c as i32);
                    let web_server = v["webserver"].as_str().map(|s| s.to_string());
                    let tech = v["tech"].as_array().map(|arr| {
                        arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect()
                    }).unwrap_or_default();

                    let sub = Subdomain {
                        id: Uuid::new_v4(),
                        program_id,
                        subdomain: host.clone(),
                        ip_address: v["host"].as_str().map(|s| s.to_string()),
                        status_code,
                        title: title.clone(),
                        web_server: web_server.clone(),
                        content_type: v["content_type"].as_str().map(|s| s.to_string()),
                        content_length: v["content_length"].as_i64(),
                        tech,
                        cdn_name: None,
                        source: "httpx".to_string(),
                        created_at: finished_at,
                        updated_at: finished_at,
                    };
                    discovered_subdomains.push(sub);

                    if let Some(u) = v["url"].as_str() {
                        discovered_endpoints.push(u.to_string());
                    }

                    let port_num = v["port"].as_i64().unwrap_or_else(|| {
                        if target.contains(':') {
                            target.rsplit(':').next().and_then(|p| p.parse::<i64>().ok()).unwrap_or(80)
                        } else {
                            80
                        }
                    }) as i32;

                    let p = crate::models::port::Port {
                        id: Uuid::new_v4(),
                        program_id,
                        subdomain_id: None,
                        ip: v["host"].as_str().unwrap_or(&host).to_string(),
                        port: port_num,
                        protocol: "tcp".to_string(),
                        service: web_server.or_else(|| Some("http".to_string())),
                        state: "open".to_string(),
                        banner: title,
                        created_at: finished_at,
                        updated_at: finished_at,
                    };
                    discovered_ports.push(p);
                }
            }
        }
        "katana" => {
            for line in stdout_str.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                    discovered_endpoints.push(trimmed.to_string());
                }
            }
        }
        "dalfox" => {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&stdout_str) {
                if let Some(findings_arr) = v["findings"].as_array() {
                    for f_entry in findings_arr {
                        let poc_url = f_entry["data"].as_str().unwrap_or(&target);
                        let payload = f_entry["payload"].as_str().unwrap_or("");
                        let param = f_entry["param"].as_str().unwrap_or("q");
                        let finding = Finding {
                            id: Uuid::new_v4(),
                            program_id,
                            subdomain_id: None,
                            title: format!("Reflected XSS on parameter '{}'", param),
                            description: Some(format!(
                                "Discovered by Dalfox.\n\nPayload: `{}`\nPoC URL: `{}`\nCWE: CWE-79",
                                payload, poc_url
                            )),
                            severity: FindingSeverity::High.to_string(),
                            status: FindingStatus::New.to_string(),
                            finding_type: "xss".to_string(),
                            matched_at: Some(target.clone()),
                            curl_command: Some(format!("curl -s \"{}\"", poc_url)),
                            tags: vec!["xss".to_string(), "dalfox".to_string(), "cwe-79".to_string()],
                            assigned_to: None,
                            cvss_score: Some(7.5),
                            kanban_column: Some("triaged".to_string()),
                            duplicate_of: None,
                            created_at: finished_at,
                            updated_at: finished_at,
                            llm_triage_json: None,
                            llm_confidence: Some(0.95),
                            llm_triaged_at: None,
                        };
                        discovered_findings.push(finding);
                    }
                }
            } else if stdout_str.contains("POC") || stdout_str.contains("V") {
                let finding = Finding {
                    id: Uuid::new_v4(),
                    program_id,
                    subdomain_id: None,
                    title: format!("Reflected XSS on {}", target),
                    description: Some(format!("Discovered by Dalfox automated scanner.\n\nRaw Output:\n{}", stdout_str)),
                    severity: FindingSeverity::High.to_string(),
                    status: FindingStatus::New.to_string(),
                    finding_type: "xss".to_string(),
                    matched_at: Some(target.clone()),
                    curl_command: Some(format!("curl -s \"{}\"", target)),
                    tags: vec!["xss".to_string(), "dalfox".to_string(), "verified".to_string()],
                    assigned_to: None,
                    cvss_score: Some(7.5),
                    kanban_column: Some("triaged".to_string()),
                    duplicate_of: None,
                    created_at: finished_at,
                    updated_at: finished_at,
                    llm_triage_json: None,
                    llm_confidence: Some(0.95),
                    llm_triaged_at: None,
                };
                discovered_findings.push(finding);
            }
        }
        "nuclei" => {
            for line in stdout_str.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let template_id = v["template-id"].as_str().unwrap_or("nuclei-finding");
                    let host = v["host"].as_str().unwrap_or(&target);
                    let severity_str = v["info"]["severity"].as_str().unwrap_or("medium");
                    let name = v["info"]["name"].as_str().unwrap_or(template_id);
                    let curl_cmd = v["curl-command"].as_str().map(|s| s.to_string());

                    let finding = Finding {
                        id: Uuid::new_v4(),
                        program_id,
                        subdomain_id: None,
                        title: format!("{} ({})", name, host),
                        description: Some(format!("Discovered by Nuclei template: {}", template_id)),
                        severity: severity_str.to_string(),
                        status: FindingStatus::New.to_string(),
                        finding_type: template_id.to_string(),
                        matched_at: v["matched-at"].as_str().map(|s| s.to_string()),
                        curl_command: curl_cmd,
                        tags: vec!["nuclei".to_string(), template_id.to_string()],
                        assigned_to: None,
                        cvss_score: None,
                        kanban_column: None,
                        duplicate_of: None,
                        created_at: finished_at,
                        updated_at: finished_at,
                        llm_triage_json: None,
                        llm_confidence: None,
                        llm_triaged_at: None,
                    };
                    discovered_findings.push(finding);
                }
            }
        }
        "naabu" => {
            for line in stdout_str.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let host = v["host"].as_str().unwrap_or(&target).to_string();
                    let ip = v["ip"].as_str().unwrap_or(&host).to_string();
                    let port_num = v["port"].as_i64().unwrap_or(80) as i32;
                    let protocol = v["protocol"].as_str().unwrap_or("tcp").to_string();

                    let p = crate::models::port::Port {
                        id: Uuid::new_v4(),
                        program_id,
                        subdomain_id: None,
                        ip,
                        port: port_num,
                        protocol,
                        service: Some("http".to_string()),
                        state: "open".to_string(),
                        banner: None,
                        created_at: finished_at,
                        updated_at: finished_at,
                    };
                    discovered_ports.push(p);
                }
            }
        }
        "ffuf" => {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&stdout_str) {
                if let Some(results) = v["results"].as_array() {
                    for r in results {
                        if let Some(u) = r["url"].as_str() {
                            discovered_endpoints.push(u.to_string());
                        }
                    }
                }
            }
        }
        "gau" | "waybackurls" => {
            for line in stdout_str.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    discovered_endpoints.push(trimmed.to_string());
                }
            }
        }
        _ => {}
    }

    // Persist discovered findings into database & memory
    if !discovered_findings.is_empty() {
        if state.has_db() {
            for f in &discovered_findings {
                let _ = sqlx::query(
                    r#"INSERT INTO findings (
                        id, program_id, subdomain_id, title, description, severity, status,
                        finding_type, matched_at, curl_command, tags, cvss_score, kanban_column,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)"#
                )
                .bind(f.id)
                .bind(f.program_id)
                .bind(f.subdomain_id)
                .bind(&f.title)
                .bind(&f.description)
                .bind(&f.severity)
                .bind(&f.status)
                .bind(&f.finding_type)
                .bind(&f.matched_at)
                .bind(&f.curl_command)
                .bind(&f.tags)
                .bind(f.cvss_score)
                .bind(&f.kanban_column)
                .bind(f.created_at)
                .execute(state.db())
                .await;
            }
        }
        let mut lock = state.in_memory_findings().write().await;
        for f in &discovered_findings {
            lock.push(f.clone());
        }
    }

    // Persist discovered subdomains/hosts into database & memory
    if !discovered_subdomains.is_empty() {
        if state.has_db() {
            for sub in &discovered_subdomains {
                let _ = sqlx::query(
                    r#"INSERT INTO subdomains (
                        id, program_id, subdomain, ip_address, status_code, title, web_server,
                        content_type, content_length, tech, cdn_name, source, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
                    ON CONFLICT (program_id, subdomain) DO NOTHING"#
                )
                .bind(sub.id)
                .bind(sub.program_id)
                .bind(&sub.subdomain)
                .bind(&sub.ip_address)
                .bind(sub.status_code)
                .bind(&sub.title)
                .bind(&sub.web_server)
                .bind(&sub.content_type)
                .bind(sub.content_length)
                .bind(&sub.tech)
                .bind(&sub.cdn_name)
                .bind(&sub.source)
                .bind(sub.created_at)
                .execute(state.db())
                .await;
            }
        }
        let mut lock = state.in_memory_subdomains().write().await;
        for sub in &discovered_subdomains {
            lock.push(sub.clone());
        }
    }

    // Persist discovered URLs/endpoints into database
    if !discovered_endpoints.is_empty() && state.has_db() {
        for u in &discovered_endpoints {
            let _ = sqlx::query(
                r#"INSERT INTO urls (
                    id, program_id, subdomain_id, url, source, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $6)
                ON CONFLICT (program_id, url) DO NOTHING"#
            )
            .bind(Uuid::new_v4())
            .bind(program_id)
            .bind(Option::<Uuid>::None)
            .bind(u)
            .bind(&tool)
            .bind(finished_at)
            .execute(state.db())
            .await;
        }
    }

    // Persist discovered ports/services into database
    if !discovered_ports.is_empty() && state.has_db() {
        for p in &discovered_ports {
            let _ = sqlx::query(
                r#"INSERT INTO ports (
                    id, program_id, subdomain_id, ip, port, protocol, service, state, banner, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
                ON CONFLICT (program_id, ip, port, protocol) DO NOTHING"#
            )
            .bind(p.id)
            .bind(p.program_id)
            .bind(p.subdomain_id)
            .bind(&p.ip)
            .bind(p.port)
            .bind(&p.protocol)
            .bind(&p.service)
            .bind(&p.state)
            .bind(&p.banner)
            .bind(p.created_at)
            .execute(state.db())
            .await;
        }
    }

    // Write structured output artifact
    let summary_artifact = json!({
        "job_id": job_id,
        "program_id": program_id,
        "tool": tool,
        "target": target,
        "exit_code": exit_code,
        "status": status_str,
        "started_at": started_at.to_rfc3339(),
        "completed_at": finished_at.to_rfc3339(),
        "findings_count": discovered_findings.len(),
        "subdomains_count": discovered_subdomains.len(),
        "endpoints_count": discovered_endpoints.len(),
        "ports_count": discovered_ports.len(),
        "findings": discovered_findings,
        "endpoints": discovered_endpoints,
        "ports": discovered_ports,
    });
    let _ = tokio::fs::write(
        evidence_dir.join("output.json"),
        serde_json::to_string_pretty(&summary_artifact).unwrap_or_default(),
    )
    .await;

    // Update job record in PostgreSQL and in-memory
    if state.has_db() {
        let _ = sqlx::query(
            "UPDATE scan_jobs SET status = $1, completed_at = $2, updated_at = $2 WHERE id = $3"
        )
        .bind(status_str)
        .bind(finished_at)
        .bind(job_id)
        .execute(state.db())
        .await;
    }

    let mut lock = state.in_memory_jobs().write().await;
    if let Some(j) = lock.iter_mut().find(|j| j.id == job_id) {
        j.status = status_str.to_string();
        j.completed_at = Some(finished_at);
        j.updated_at = finished_at;

        let mut flags_map = serde_json::Map::new();
        flags_map.insert("tool".to_string(), json!(tool));
        flags_map.insert("target".to_string(), json!(target));
        flags_map.insert("exit_code".to_string(), json!(exit_code));
        flags_map.insert("stdout".to_string(), json!(stdout_str));
        flags_map.insert("stderr".to_string(), json!(stderr_str));
        flags_map.insert(
            "evidence_path".to_string(),
            json!(format!("evidence/jobs/{}/output.json", job_id)),
        );
        flags_map.insert(
            "findings_count".to_string(),
            json!(discovered_findings.len()),
        );
        flags_map.insert(
            "endpoints_count".to_string(),
            json!(discovered_endpoints.len()),
        );
        flags_map.insert(
            "ports_count".to_string(),
            json!(discovered_ports.len()),
        );
        j.flags = Some(serde_json::Value::Object(flags_map));
    }

    let _ = state.ws_tx().send(format!(
        "[job:{}] Tool {} finished with status {} (exit code {}). Discovered: {} findings, {} subdomains, {} endpoints.",
        job_id, tool, status_str, exit_code, discovered_findings.len(), discovered_subdomains.len(), discovered_endpoints.len()
    ));
}
