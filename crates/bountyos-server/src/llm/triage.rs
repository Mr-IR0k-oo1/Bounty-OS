//! Triage orchestrator: fetches a finding, builds evidence context,
//! calls VulnLLM-R-7B via Ollama, and stores the structured result.
//!
//! Uses sqlx::query() (not sqlx::query!) throughout to avoid needing
//! DATABASE_URL at compile time.

use anyhow::{bail, Context};
use chrono::Utc;
use sqlx::{PgPool, Row};
use std::path::{Path, PathBuf};
use tracing::{info, warn};
use uuid::Uuid;

use crate::llm::{
    client::OllamaClient,
    prompts::{build_messages, read_snippet},
    schemas::{AssetContext, EndpointContext, EvidenceRef, Observation, TriageInput, TriageOutput},
};
use bountyos_analyzer::{
    types::{AnalysisResult, DetectionSource, SecurityFinding, Severity, ValidationStatus},
    Correlator, RuleAnalyzer, VulnerabilityAnalyzer,
};

/// Run triage for a single finding.
///
/// This is async and meant to be spawned with `tokio::spawn` —
/// the HTTP handler returns 202 immediately, triage happens in background.
pub async fn triage_finding(
    pool: &PgPool,
    finding_id: Uuid,
    client: &OllamaClient,
    evidence_base: &Path,
) -> anyhow::Result<TriageOutput> {
    // -------------------------------------------------------------------
    // 1. Fetch finding + related context from DB
    // -------------------------------------------------------------------
    let row = sqlx::query(
        r#"
        SELECT
            f.title,
            f.description,
            f.severity,
            f.finding_type,
            f.matched_at,
            f.curl_command,
            s.subdomain,
            s.status_code               AS subdomain_status_code,
            s.tech_stack,
            p.name                      AS program_name,
            p.platform,
            p.slug                      AS program_slug,
            pr.slug                     AS project_slug
        FROM findings f
        LEFT JOIN subdomains s ON s.id = f.subdomain_id
        JOIN programs p ON p.id = f.program_id
        JOIN projects pr ON pr.id = p.project_id
        WHERE f.id = $1
        "#,
    )
    .bind(finding_id)
    .fetch_optional(pool)
    .await
    .context("DB error fetching finding for triage")?;

    let row = match row {
        Some(r) => r,
        None => bail!("Finding {} not found", finding_id),
    };

    // Extract fields from row
    let title: String = row.try_get("title").unwrap_or_default();
    let description: Option<String> = row.try_get("description").ok().flatten();
    let severity: String = row
        .try_get("severity")
        .unwrap_or_else(|_| "info".to_string());
    let finding_type: String = row
        .try_get("finding_type")
        .unwrap_or_else(|_| "unknown".to_string());
    let matched_at: Option<String> = row.try_get("matched_at").ok().flatten();
    let curl_command: Option<String> = row.try_get("curl_command").ok().flatten();
    let subdomain: Option<String> = row.try_get("subdomain").ok().flatten();
    let subdomain_status_code: Option<i32> = row.try_get("subdomain_status_code").ok().flatten();
    let tech_stack: Option<serde_json::Value> = row.try_get("tech_stack").ok().flatten();
    let program_name: String = row.try_get("program_name").unwrap_or_default();
    let platform: String = row.try_get("platform").unwrap_or_default();
    let program_slug: String = row.try_get("program_slug").unwrap_or_default();
    let project_slug: String = row.try_get("project_slug").unwrap_or_default();

    // -------------------------------------------------------------------
    // 2. Locate evidence directory for this finding
    // -------------------------------------------------------------------
    let subdomain_dir = subdomain.clone().unwrap_or_else(|| "unknown".to_string());
    let evidence_dir = evidence_base
        .join(&project_slug)
        .join(&program_slug)
        .join(&subdomain_dir);

    // -------------------------------------------------------------------
    // 3. Gather evidence refs — load snippets where available
    // -------------------------------------------------------------------
    let mut evidence: Vec<EvidenceRef> = Vec::new();

    let nuclei_path = evidence_dir.join("stage4_vuln").join("nuclei.jsonl");
    if nuclei_path.exists() {
        evidence.push(EvidenceRef {
            evidence_type: "nuclei_output".to_string(),
            location: relative_path(&nuclei_path, evidence_base),
            snippet: read_snippet(&nuclei_path),
        });
    }

    if let Some(ref curl) = curl_command {
        evidence.push(EvidenceRef {
            evidence_type: "http_request".to_string(),
            location: "inline_curl".to_string(),
            snippet: Some(curl.chars().take(2048).collect()),
        });
    }

    let httpx_path = evidence_dir.join("stage2_validate").join("httpx.jsonl");
    if httpx_path.exists() {
        evidence.push(EvidenceRef {
            evidence_type: "httpx_output".to_string(),
            location: relative_path(&httpx_path, evidence_base),
            snippet: read_snippet(&httpx_path),
        });
    }

    if evidence.is_empty() {
        warn!(
            "No evidence files found for finding {} — triage will have low confidence",
            finding_id
        );
    }

    // -------------------------------------------------------------------
    // 4. Build observations
    // -------------------------------------------------------------------
    let observations = vec![Observation {
        source: "nuclei".to_string(),
        observation_type: "vuln_template_match".to_string(),
        detail: description.clone(),
        template_id: matched_at.clone(),
        template_name: Some(title.clone()),
        severity: Some(severity.clone()),
    }];

    let technologies: Vec<String> = tech_stack
        .as_ref()
        .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
        .unwrap_or_default();

    // -------------------------------------------------------------------
    // 5. Assemble TriageInput
    // -------------------------------------------------------------------
    let host = subdomain.clone().unwrap_or_else(|| program_slug.clone());
    let base_url = format!("https://{}{}", host, matched_at.as_deref().unwrap_or(""));

    let input = TriageInput {
        run_id: Utc::now().format("%Y%m%d_%H%M%S").to_string(),
        finding_id,
        asset: AssetContext {
            host: host.clone(),
            url: base_url,
            program_name,
            platform,
        },
        endpoint: EndpointContext {
            method: "GET".to_string(),
            path: matched_at.clone().unwrap_or_else(|| "/".to_string()),
            query_parameters: vec![],
            status_code: subdomain_status_code,
            content_length: None,
            technologies,
        },
        observations,
        evidence: evidence.clone(),
        generated_at: Utc::now(),
    };

    // -------------------------------------------------------------------
    // 6. Persist input to disk
    // -------------------------------------------------------------------
    let llm_dir = evidence_dir.join("llm");
    if let Err(e) = std::fs::create_dir_all(&llm_dir) {
        warn!("Could not create llm evidence dir {:?}: {}", llm_dir, e);
    }

    let input_path = llm_dir.join(format!("finding_{}_input.json", finding_id));
    if let Ok(json) = serde_json::to_string_pretty(&input) {
        let _ = std::fs::write(&input_path, json);
    }

    // -------------------------------------------------------------------
    // 7. Call the model
    // -------------------------------------------------------------------
    info!("Starting LLM triage for finding {}", finding_id);
    let messages = build_messages(&input);
    let output = client
        .chat(messages)
        .await
        .context("Ollama inference failed")?;

    // -------------------------------------------------------------------
    // 8. Persist output to disk
    // -------------------------------------------------------------------
    let output_path = llm_dir.join(format!("finding_{}_output.json", finding_id));
    if let Ok(json) = serde_json::to_string_pretty(&output) {
        let _ = std::fs::write(&output_path, json);
    }

    // -------------------------------------------------------------------
    // 9. Run deterministic rule analysis & correlate with LLM triage
    // -------------------------------------------------------------------
    let rule_analyzer = RuleAnalyzer::new();
    let mut evidence_context = String::new();
    if let Some(ref curl) = curl_command {
        evidence_context.push_str(curl);
        evidence_context.push('\n');
    }
    for ev in &evidence {
        if let Some(ref snip) = ev.snippet {
            evidence_context.push_str(snip);
            evidence_context.push('\n');
        }
    }
    if evidence_context.is_empty() {
        if let Some(ref desc) = description {
            evidence_context.push_str(desc);
        }
    }

    let rule_result = rule_analyzer
        .analyze(&evidence_context)
        .await
        .unwrap_or_else(|_| AnalysisResult {
            finding: SecurityFinding {
                vulnerability: None,
                cwe: None,
                severity: None,
                confidence: 0.0,
                evidence: "No deterministic rule matched evidence context.".to_string(),
                impact: None,
                remediation: None,
                detection_source: DetectionSource::Rule,
                validation_status: ValidationStatus::Rejected,
            },
            source: DetectionSource::Rule,
            status: ValidationStatus::Rejected,
        });

    let llm_vulnerable = output.finding_type != "fp"
        && output.finding_type != "none"
        && !output.finding_type.is_empty();
    let llm_status = if llm_vulnerable {
        ValidationStatus::Candidate
    } else {
        ValidationStatus::Rejected
    };

    let llm_finding = SecurityFinding {
        vulnerability: if llm_vulnerable {
            Some(output.finding_type.clone())
        } else {
            None
        },
        cwe: None,
        severity: match output.severity.to_lowercase().as_str() {
            "critical" => Some(Severity::Critical),
            "high" => Some(Severity::High),
            "medium" => Some(Severity::Medium),
            "low" => Some(Severity::Low),
            "info" => Some(Severity::Info),
            _ => None,
        },
        confidence: output.sanitized_confidence() as f32,
        evidence: output.reasoning_summary.clone(),
        impact: None,
        remediation: if output.recommended_manual_verification.is_empty() {
            None
        } else {
            Some(output.recommended_manual_verification.join("\n"))
        },
        detection_source: DetectionSource::Llm,
        validation_status: llm_status,
    };

    let llm_analysis = AnalysisResult {
        finding: llm_finding,
        source: DetectionSource::Llm,
        status: llm_status,
    };

    let correlated = Correlator::correlate(&llm_analysis, &rule_result);
    let confidence_db = correlated.finding.confidence as f64;

    let mut triage_val = serde_json::to_value(&output).unwrap_or(serde_json::Value::Null);
    if let serde_json::Value::Object(ref mut map) = triage_val {
        map.insert(
            "security_finding".to_string(),
            serde_json::to_value(&correlated.finding).unwrap_or_default(),
        );
        map.insert(
            "validation_status".to_string(),
            serde_json::to_value(correlated.status).unwrap_or_default(),
        );
        map.insert(
            "detection_source".to_string(),
            serde_json::to_value(correlated.source).unwrap_or_default(),
        );
        map.insert(
            "composite_confidence".to_string(),
            serde_json::json!(confidence_db),
        );
    }

    // -------------------------------------------------------------------
    // 10. Write correlated triage result back to DB
    // -------------------------------------------------------------------
    sqlx::query(
        r#"
        UPDATE findings
        SET
            llm_triage_json  = $1,
            llm_confidence   = $2,
            llm_triaged_at   = NOW()
        WHERE id = $3
        "#,
    )
    .bind(triage_val)
    .bind(confidence_db)
    .bind(finding_id)
    .execute(pool)
    .await
    .context("Failed to write triage result to DB")?;

    info!(
        "Triage complete for finding {} — type: {}, source: {:?}, status: {:?}, composite confidence: {:.0}%, severity: {}",
        finding_id,
        correlated.finding.vulnerability.as_deref().unwrap_or(&output.finding_type),
        correlated.source,
        correlated.status,
        confidence_db * 100.0,
        output.severity
    );

    Ok(output)
}

fn relative_path(path: &PathBuf, base: &Path) -> String {
    path.strip_prefix(base)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}
