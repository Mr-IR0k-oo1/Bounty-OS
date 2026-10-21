use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::models::scan_job::ScanJob;
use crate::AppState;
use bountyos_common::ScanStage;

#[derive(Deserialize)]
pub struct ListJobsParams {
    pub program_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub program_id: Uuid,
    pub tool: String,
    pub target: String,
    pub stage: Option<i32>,
    pub flags: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct JobLogsResponse {
    pub job_id: Uuid,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct JobArtifactsResponse {
    pub job_id: Uuid,
    pub available: bool,
    pub files: Vec<String>,
    pub evidence_path: Option<String>,
    pub message: Option<String>,
}

/// List jobs with optional filtering by program_id and status
pub async fn list_jobs(
    State(state): State<AppState>,
    Query(params): Query<ListJobsParams>,
) -> Result<Json<Vec<ScanJob>>, (StatusCode, Json<serde_json::Value>)> {
    if state.has_db() {
        let pool = state.db();
        let query_result = match (&params.program_id, &params.status) {
            (Some(pid), Some(st)) => {
                sqlx::query_as::<_, ScanJob>(
                    "SELECT * FROM scan_jobs WHERE program_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 100",
                )
                .bind(pid)
                .bind(st)
                .fetch_all(pool)
                .await
            }
            (Some(pid), None) => {
                sqlx::query_as::<_, ScanJob>(
                    "SELECT * FROM scan_jobs WHERE program_id = $1 ORDER BY created_at DESC LIMIT 100",
                )
                .bind(pid)
                .fetch_all(pool)
                .await
            }
            (None, Some(st)) => {
                sqlx::query_as::<_, ScanJob>(
                    "SELECT * FROM scan_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT 100",
                )
                .bind(st)
                .fetch_all(pool)
                .await
            }
            (None, None) => {
                sqlx::query_as::<_, ScanJob>(
                    "SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT 100",
                )
                .fetch_all(pool)
                .await
            }
        };

        if let Ok(jobs) = query_result {
            return Ok(Json(jobs));
        }
    }

    // In-memory fallback
    let lock = state.in_memory_jobs().read().await;
    let filtered: Vec<ScanJob> = lock
        .iter()
        .filter(|j| {
            if let Some(pid) = params.program_id {
                if j.program_id != pid {
                    return false;
                }
            }
            if let Some(ref st) = params.status {
                if !j.status.eq_ignore_ascii_case(st) {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect();

    Ok(Json(filtered))
}

/// List jobs for a specific program
pub async fn list_program_jobs(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Vec<ScanJob>>, (StatusCode, Json<serde_json::Value>)> {
    list_jobs(
        State(state),
        Query(ListJobsParams {
            program_id: Some(program_id),
            status: None,
        }),
    )
    .await
}

/// Get a single job by ID
pub async fn get_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScanJob>, (StatusCode, Json<serde_json::Value>)> {
    if state.has_db() {
        if let Ok(job) = sqlx::query_as::<_, ScanJob>("SELECT * FROM scan_jobs WHERE id = $1")
            .bind(id)
            .fetch_one(state.db())
            .await
        {
            return Ok(Json(job));
        }
    }

    let lock = state.in_memory_jobs().read().await;
    if let Some(job) = lock.iter().find(|j| j.id == id) {
        return Ok(Json(job.clone()));
    }

    Err((
        StatusCode::NOT_FOUND,
        Json(json!({"error": format!("Job {} not found", id)})),
    ))
}

/// Cancel a running or queued job
pub async fn cancel_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScanJob>, (StatusCode, Json<serde_json::Value>)> {
    let now = chrono::Utc::now();

    if state.has_db() {
        if let Ok(job) = sqlx::query_as::<_, ScanJob>(
            "UPDATE scan_jobs SET status = 'cancelled', completed_at = $1, updated_at = $1 WHERE id = $2 RETURNING *"
        )
        .bind(now)
        .bind(id)
        .fetch_one(state.db())
        .await
        {
            let _ = crate::pipeline::queue::update_job_status(state.redis(), id, "cancelled").await;
            let _ = state.ws_tx().send(format!("[job:{}] Job cancelled by operator", id));
            return Ok(Json(job));
        }
    }

    let mut lock = state.in_memory_jobs().write().await;
    if let Some(job) = lock.iter_mut().find(|j| j.id == id) {
        job.status = "cancelled".to_string();
        job.completed_at = Some(now);
        job.updated_at = now;
        let _ = state
            .ws_tx()
            .send(format!("[job:{}] Job cancelled by operator", id));
        return Ok(Json(job.clone()));
    }

    Err((
        StatusCode::NOT_FOUND,
        Json(json!({"error": format!("Job {} not found", id)})),
    ))
}

/// Create and launch a new scan job with strict tool whitelisting and scope verification
pub async fn create_job(
    State(state): State<AppState>,
    Json(payload): Json<CreateJobRequest>,
) -> Result<(StatusCode, Json<ScanJob>), (StatusCode, Json<serde_json::Value>)> {
    let tool = payload.tool.trim().to_lowercase();
    let target = payload.target.trim().to_string();

    if target.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Target must not be empty"})),
        ));
    }

    // Defense-in-depth: Reject shell metacharacters and injection primitives across all tools
    let forbidden_chars = [';', '|', '&', '`', '$', '\n', '\r', '\0', '<', '>'];
    if target.chars().any(|c| forbidden_chars.contains(&c)) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Target contains forbidden characters (command injection blocked)"
            })),
        ));
    }

    // 1. Strict tool whitelisting (never execute arbitrary paths or shell commands)
    let allowed_tools = [
        "subfinder",
        "dnsx",
        "httpx",
        "naabu",
        "katana",
        "nuclei",
        "gau",
        "waybackurls",
        "ffuf",
        "dalfox",
    ];
    if !allowed_tools.contains(&tool.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!("Tool '{}' is not supported or authorized. Permitted tools: {:?}", tool, allowed_tools)
            })),
        ));
    }

    // 2. Validate program existence and status
    let program = if state.has_db() {
        sqlx::query_as::<_, crate::models::program::Program>("SELECT * FROM programs WHERE id = $1")
            .bind(payload.program_id)
            .fetch_optional(state.db())
            .await
            .ok()
            .flatten()
    } else {
        let lock = state.in_memory_programs().read().await;
        lock.iter().find(|p| p.id == payload.program_id).cloned()
    };

    let program = match program {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({"error": format!("Program {} not found", payload.program_id)})),
            ));
        }
    };

    // 3. Determine stage and enforce active scanning approval safeguard
    let stage_num = payload.stage.unwrap_or_else(|| match tool.as_str() {
        "httpx" => 2,
        "naabu" => 3,
        "katana" => 4,
        "nuclei" => 4,
        _ => 1,
    });

    if stage_num >= 3 && !program.active_approved {
        return Err((
            StatusCode::PRECONDITION_REQUIRED,
            Json(json!({
                "error": format!("Program '{}' active scanning is not approved. Explicit approval is required before running stage {} tools.", program.name, stage_num)
            })),
        ));
    }

    // 4. Target validation and backend scope verification
    if tool == "subfinder" {
        let domains = match crate::pipeline::subfinder::parse_target_domains(&target) {
            Ok(d) => d,
            Err(e) => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("Invalid target domain: {}", e)})),
                ));
            }
        };

        if let Err(e) =
            crate::pipeline::subfinder::validate_domains_in_scope(&domains, program.id, &state)
                .await
        {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({"error": e.to_string()})),
            ));
        }
    } else {
        let in_scope = if state.has_db() {
            crate::pipeline::scope_check::is_target_in_scope(&target, program.id, state.db())
                .await
                .unwrap_or(false)
        } else {
            let lock = state.in_memory_scope().read().await;
            let rules: Vec<_> = lock.iter().filter(|s| s.program_id == program.id).collect();

            // Check explicit out-of-scope rules first
            let is_explicit_oos = rules.iter().any(|r| {
                r.out_of_scope
                    && crate::pipeline::scope_check::matches_scope(
                        &target,
                        &r.target,
                        &r.target_type,
                    )
            });

            if is_explicit_oos {
                false
            } else {
                // Check in-scope rules
                rules.iter().any(|r| {
                    !r.out_of_scope
                        && crate::pipeline::scope_check::matches_scope(
                            &target,
                            &r.target,
                            &r.target_type,
                        )
                })
            }
        };

        if !in_scope {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "error": format!("Target '{}' is out of scope or not authorized for program '{}'", target, program.name)
                })),
            ));
        }
    }

    // 5. Initial job status (always spawned as an active asynchronous managed task)
    let initial_status = "running".to_string();

    let job_id = Uuid::new_v4();
    let stage = ScanStage::try_from(stage_num).unwrap_or(ScanStage::Passive);
    let now = chrono::Utc::now();

    let mut flags_map = serde_json::Map::new();
    flags_map.insert("tool".to_string(), json!(tool));
    flags_map.insert("target".to_string(), json!(target));
    flags_map.insert(
        "command".to_string(),
        json!(format!("{} -d {} -silent -all", tool, target)),
    );
    flags_map.insert("exit_code".to_string(), json!(0));
    flags_map.insert(
        "stdout".to_string(),
        json!(format!(
            "[{}] Initialized security scan against target '{}'\n[{}] Target scope verified: IN-SCOPE\n[{}] Concurrency limit: {} workers\n[{}] Running analysis...",
            tool, target, tool, tool, state.config().max_concurrent_jobs, tool
        )),
    );
    flags_map.insert(
        "evidence_path".to_string(),
        json!(format!("evidence/jobs/{}/output.json", job_id)),
    );

    let job = ScanJob {
        id: job_id,
        program_id: program.id,
        stage,
        status: initial_status.clone(),
        subdomain_id: None,
        target: Some(target.clone()),
        flags: Some(serde_json::Value::Object(flags_map)),
        error_log: None,
        started_at: if initial_status == "running" {
            Some(now)
        } else {
            None
        },
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    // Save job in database if available
    if state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO scan_jobs (
                id, program_id, stage, status, target, flags, started_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
        )
        .bind(job.id)
        .bind(job.program_id)
        .bind(stage_num)
        .bind(&job.status)
        .bind(&job.target)
        .bind(&job.flags)
        .bind(job.started_at)
        .bind(job.created_at)
        .bind(job.updated_at)
        .execute(state.db())
        .await;
    }

    // Insert into in-memory store
    {
        let mut lock = state.in_memory_jobs().write().await;
        lock.insert(0, job.clone());
    }

    // Broadcast log over WebSocket
    let _ = state.ws_tx().send(format!(
        "[job:{}] Scan job created for {} ({}) - Status: {}",
        job_id, program.name, tool, initial_status
    ));

    // Write initial evidence artifact file
    let evidence_dir = state.evidence_base().join("jobs").join(job_id.to_string());
    let _ = std::fs::create_dir_all(&evidence_dir);
    let evidence_file = evidence_dir.join("output.json");
    let artifact_content = json!({
        "job_id": job_id,
        "program_id": program.id,
        "program_name": program.name,
        "target": target,
        "tool": tool,
        "stage": stage_num,
        "status": initial_status,
        "timestamp": now.to_rfc3339(),
        "findings": []
    });
    let _ = std::fs::write(evidence_file, artifact_content.to_string());

    // If job is running, execute tool adapter
    if initial_status == "running" {
        if tool == "subfinder" {
            let state_clone = state.clone();
            let target_clone = target.clone();
            tokio::spawn(async move {
                crate::pipeline::subfinder::run_managed_subfinder_job(
                    job_id,
                    program.id,
                    target_clone,
                    state_clone,
                )
                .await;
            });
        } else {
            let state_clone = state.clone();
            let target_clone = target.clone();
            let tool_clone = tool.clone();
            let flags_clone = payload.flags.clone();
            tokio::spawn(async move {
                crate::pipeline::runner::run_managed_tool_job(
                    job_id,
                    program.id,
                    tool_clone,
                    target_clone,
                    flags_clone,
                    state_clone,
                )
                .await;
            });
        }
    }

    Ok((StatusCode::CREATED, Json(job)))
}

/// Create a job scoped to a specific program URL path
pub async fn create_program_job(
    State(state): State<AppState>,
    Path(program_id): Path<Uuid>,
    Json(mut payload): Json<CreateJobRequest>,
) -> Result<(StatusCode, Json<ScanJob>), (StatusCode, Json<serde_json::Value>)> {
    payload.program_id = program_id;
    create_job(State(state), Json(payload)).await
}

/// Retrieve stdout, stderr, and exit code for a job
pub async fn get_job_logs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobLogsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let job = get_job(State(state.clone()), Path(id)).await?.0;

    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut exit_code = None;

    if let Some(ref flags) = job.flags {
        if let Some(out) = flags.get("stdout").and_then(|v| v.as_str()) {
            stdout = out.to_string();
        }
        if let Some(err) = flags.get("stderr").and_then(|v| v.as_str()) {
            stderr = err.to_string();
        }
        if let Some(code) = flags.get("exit_code").and_then(|v| v.as_i64()) {
            exit_code = Some(code as i32);
        }
    }

    if let Some(ref err) = job.error_log {
        if !err.is_empty() {
            if !stderr.is_empty() {
                stderr.push('\n');
            }
            stderr.push_str(err);
        }
    }

    if stdout.is_empty() && stderr.is_empty() {
        stdout = format!(
            "[job:{}] No console output captured yet (status: {}).",
            id, job.status
        );
    }

    Ok(Json(JobLogsResponse {
        job_id: id,
        stdout,
        stderr,
        exit_code,
        status: job.status,
    }))
}

/// Retrieve artifact metadata and evidence files for a job
pub async fn get_job_artifacts(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<JobArtifactsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let job = get_job(State(state.clone()), Path(id)).await?.0;

    let evidence_dir = state.evidence_base().join("jobs").join(id.to_string());
    let mut files = Vec::new();

    if evidence_dir.exists() && evidence_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&evidence_dir) {
            for entry in entries.flatten() {
                if let Ok(name) = entry.file_name().into_string() {
                    files.push(name);
                }
            }
        }
    }

    let evidence_path = job.flags.as_ref().and_then(|f| {
        f.get("evidence_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });

    if !files.is_empty() {
        Ok(Json(JobArtifactsResponse {
            job_id: id,
            available: true,
            files,
            evidence_path,
            message: None,
        }))
    } else if let Some(ref ep) = evidence_path {
        Ok(Json(JobArtifactsResponse {
            job_id: id,
            available: true,
            files: vec![ep.clone()],
            evidence_path: Some(ep.clone()),
            message: None,
        }))
    } else {
        Ok(Json(JobArtifactsResponse {
            job_id: id,
            available: false,
            files: vec![],
            evidence_path: None,
            message: Some(
                "No saved evidence artifacts are available for this job, or they have expired."
                    .to_string(),
            ),
        }))
    }
}
