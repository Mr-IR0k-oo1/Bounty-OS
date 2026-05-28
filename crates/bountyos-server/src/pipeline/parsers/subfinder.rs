use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::models::subdomain::Subdomain;

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Missing field: {0}")]
    MissingField(String),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn parse(jsonl: Vec<serde_json::Value>) -> Result<Vec<Subdomain>, ParseError> {
    let mut results = Vec::new();
    for entry in jsonl {
        let host = entry["host"]
            .as_str()
            .ok_or_else(|| ParseError::MissingField("host".into()))?
            .to_string();
        let ip = entry["ip"].as_str().map(|s| s.to_string());
        let source = entry["source"].as_str().map(|s| s.to_string());

        results.push(Subdomain {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain: host,
            ip_address: ip,
            status_code: None,
            title: None,
            web_server: None,
            content_type: None,
            content_length: None,
            tech: Vec::new(),
            cdn_name: None,
            source: source.unwrap_or_else(|| "subfinder".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    Ok(results)
}
