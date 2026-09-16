use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::models::port::{Port, PortProtocol};

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Missing field: {0}")]
    MissingField(String),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn parse(jsonl: Vec<serde_json::Value>) -> Result<Vec<Port>, ParseError> {
    let mut results = Vec::new();
    for entry in jsonl {
        let ip = entry["ip"]
            .as_str()
            .ok_or_else(|| ParseError::MissingField("ip".into()))?
            .to_string();
        let port_num = entry["port"]
            .as_u64()
            .ok_or_else(|| ParseError::MissingField("port".into()))? as i32;
        let protocol = match entry["protocol"].as_str().unwrap_or("tcp") {
            "udp" => PortProtocol::Udp,
            _ => PortProtocol::Tcp,
        };

        results.push(Port {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain_id: None,
            ip,
            port: port_num,
            protocol: protocol.to_string(),
            service: None,
            state: "open".to_string(),
            banner: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    Ok(results)
}
