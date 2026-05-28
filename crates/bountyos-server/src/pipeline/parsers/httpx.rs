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
        let url = entry["url"]
            .as_str()
            .ok_or_else(|| ParseError::MissingField("url".into()))?
            .to_string();
        let status_code = entry["status_code"].as_u64().map(|c| c as i32);
        let title = entry["title"].as_str().map(|s| s.to_string());
        let web_server = entry["web_server"].as_str().map(|s| s.to_string());
        let content_type = entry["content_type"].as_str().map(|s| s.to_string());
        let content_length = entry["content_length"].as_i64();
        let tech = entry["tech"].as_array().map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        });
        let cdn_name = entry["cdn_name"].as_str().map(|s| s.to_string());

        let host = entry["host"].as_str().unwrap_or(&url).to_string();

        results.push(Subdomain {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain: host,
            ip_address: None,
            status_code,
            title,
            web_server,
            content_type,
            content_length,
            tech: tech.unwrap_or_default(),
            cdn_name,
            source: "httpx".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    Ok(results)
}
