use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::models::finding::{Finding, FindingSeverity, FindingStatus};

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Missing field: {0}")]
    MissingField(String),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn parse(jsonl: Vec<serde_json::Value>) -> Result<Vec<Finding>, ParseError> {
    let mut findings = Vec::new();
    for entry in jsonl {
        let template_id = entry["template-id"]
            .as_str()
            .ok_or_else(|| ParseError::MissingField("template-id".into()))?
            .to_string();
        let host = entry["host"]
            .as_str()
            .ok_or_else(|| ParseError::MissingField("host".into()))?
            .to_string();
        let severity_str = entry["severity"].as_str().unwrap_or("info");
        let severity = match severity_str {
            "critical" => FindingSeverity::Critical,
            "high" => FindingSeverity::High,
            "medium" => FindingSeverity::Medium,
            "low" => FindingSeverity::Low,
            _ => FindingSeverity::Info,
        };
        let matched_at = entry["matched-at"].as_str().unwrap_or(&host).to_string();
        let name = entry["template-name"]
            .as_str()
            .unwrap_or(&template_id)
            .to_string();
        let description = entry["description"].as_str().map(|s| s.to_string());
        let tags = entry["tags"]
            .as_str()
            .map(|s| s.split(',').map(|t| t.trim().to_string()).collect());
        let curl_command = entry["curl-command"].as_str().map(|s| s.to_string());
        let finding_type = entry["type"].as_str().unwrap_or("unknown").to_string();

        findings.push(Finding {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain_id: None,
            title: format!("{} - {}", name, host),
            description,
            severity,
            status: FindingStatus::New,
            finding_type,
            matched_at,
            curl_command,
            tags: tags.unwrap_or_default(),
            assigned_to: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    Ok(findings)
}
