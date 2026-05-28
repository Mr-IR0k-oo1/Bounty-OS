use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::models::url::Url;

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Empty input")]
    Empty,
}

pub fn parse(lines: Vec<String>) -> Result<Vec<Url>, ParseError> {
    if lines.is_empty() {
        return Err(ParseError::Empty);
    }

    let mut results = Vec::new();
    for line in lines {
        let trimmed = line.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }
        results.push(Url {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain_id: None,
            url: trimmed,
            status_code: None,
            content_type: None,
            content_length: None,
            source: "gau".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    Ok(results)
}
