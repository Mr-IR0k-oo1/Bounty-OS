use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::models::port::{Port, PortProtocol};

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("XML parse error: {0}")]
    Xml(String),
    #[error("No ports found")]
    NoPorts,
}

pub fn parse(xml_path: &str) -> Result<Vec<Port>, ParseError> {
    let content = std::fs::read_to_string(xml_path)?;
    let mut ports = Vec::new();

    let doc = roxmltree::Document::parse(&content).map_err(|e| ParseError::Xml(e.to_string()))?;

    for port_elem in doc.descendants().filter(|n| n.has_tag_name("port")) {
        let port_num: i32 = port_elem
            .attribute("portid")
            .and_then(|p| p.parse().ok())
            .unwrap_or(0);
        let protocol = match port_elem.attribute("protocol").unwrap_or("tcp") {
            "udp" => PortProtocol::Udp,
            _ => PortProtocol::Tcp,
        };

        let mut service = None;
        let mut state = "unknown".to_string();

        for child in port_elem.children() {
            if child.has_tag_name("state") {
                state = child.attribute("state").unwrap_or("unknown").to_string();
            }
            if child.has_tag_name("service") {
                service = child.attribute("name").map(|s| s.to_string());
            }
        }

        ports.push(Port {
            id: Uuid::new_v4(),
            program_id: Uuid::nil(),
            subdomain_id: None,
            ip: String::new(),
            port: port_num,
            protocol,
            service,
            state,
            banner: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }

    Ok(ports)
}
