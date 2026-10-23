//! Request Repeater & Flow Engine (Ars0n Capability Integration — Phase 9)
//!
//! Provides controlled request mutation, dry-run simulation, and live HTTP replay
//! with explicit scope gating and empirical evidence persistence.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use uuid::Uuid;
use crate::intelligence::state::ScopeBoundary;

/// Supported mutation operations on captured HTTP requests
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum HttpMutation {
    SetHeader { key: String, value: String },
    RemoveHeader { key: String },
    SetMethod { method: String },
    AppendPath { path: String },
    SetBody { body: String },
}

/// Request Flow representing a captured or synthetic HTTP interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestFlow {
    pub id: Uuid,
    pub name: String,
    pub target_url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub mutations: Vec<HttpMutation>,
}

/// Result of dry-run or live replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowReplayResult {
    pub flow_id: Uuid,
    pub effective_url: String,
    pub effective_method: String,
    pub effective_headers: HashMap<String, String>,
    pub effective_body: Option<String>,
    pub status_code: Option<u16>,
    pub response_body_snippet: Option<String>,
    pub response_headers: HashMap<String, String>,
    pub duration_ms: u64,
    pub dry_run: bool,
}

pub struct FlowEngine;

impl FlowEngine {
    /// Applies mutations to request flow and executes dry-run or live replay
    pub async fn execute_flow(
        client: &reqwest::Client,
        flow: &RequestFlow,
        dry_run: bool,
        scope: &ScopeBoundary,
    ) -> Result<FlowReplayResult, String> {
        let mut effective_url = flow.target_url.clone();
        let mut effective_method = flow.method.to_uppercase();
        let mut effective_headers = flow.headers.clone();
        let mut effective_body = flow.body.clone();

        // Apply mutations
        for mutation in &flow.mutations {
            match mutation {
                HttpMutation::SetHeader { key, value } => {
                    effective_headers.insert(key.clone(), value.clone());
                }
                HttpMutation::RemoveHeader { key } => {
                    effective_headers.remove(key);
                }
                HttpMutation::SetMethod { method } => {
                    effective_method = method.to_uppercase();
                }
                HttpMutation::AppendPath { path } => {
                    if effective_url.ends_with('/') && path.starts_with('/') {
                        effective_url.push_str(&path[1..]);
                    } else if !effective_url.ends_with('/') && !path.starts_with('/') {
                        effective_url.push('/');
                        effective_url.push_str(path);
                    } else {
                        effective_url.push_str(path);
                    }
                }
                HttpMutation::SetBody { body } => {
                    effective_body = Some(body.clone());
                }
            }
        }

        // Scope check gate
        if !scope.is_allowed(&effective_url) {
            return Err(format!(
                "Flow target '{}' violates scope boundaries",
                effective_url
            ));
        }

        if dry_run {
            return Ok(FlowReplayResult {
                flow_id: flow.id,
                effective_url,
                effective_method,
                effective_headers,
                effective_body,
                status_code: None,
                response_body_snippet: None,
                response_headers: HashMap::new(),
                duration_ms: 0,
                dry_run: true,
            });
        }

        // Live execution
        let start = Instant::now();
        let method = match effective_method.as_str() {
            "GET" => reqwest::Method::GET,
            "POST" => reqwest::Method::POST,
            "PUT" => reqwest::Method::PUT,
            "DELETE" => reqwest::Method::DELETE,
            "PATCH" => reqwest::Method::PATCH,
            "HEAD" => reqwest::Method::HEAD,
            "OPTIONS" => reqwest::Method::OPTIONS,
            _ => reqwest::Method::GET,
        };

        let mut req_builder = client.request(method, &effective_url);
        for (k, v) in &effective_headers {
            req_builder = req_builder.header(k, v);
        }
        if let Some(ref b) = effective_body {
            req_builder = req_builder.body(b.clone());
        }

        let resp = req_builder
            .send()
            .await
            .map_err(|e| format!("Replay network failure: {}", e))?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let status_code = Some(resp.status().as_u16());

        let mut resp_headers = HashMap::new();
        for (k, v) in resp.headers() {
            if let Ok(val) = v.to_str() {
                resp_headers.insert(k.as_str().to_string(), val.to_string());
            }
        }

        let body_text = resp.text().await.unwrap_or_default();
        let snippet = body_text.chars().take(500).collect::<String>();

        Ok(FlowReplayResult {
            flow_id: flow.id,
            effective_url,
            effective_method,
            effective_headers,
            effective_body,
            status_code,
            response_body_snippet: Some(snippet),
            response_headers: resp_headers,
            duration_ms,
            dry_run: false,
        })
    }
}
