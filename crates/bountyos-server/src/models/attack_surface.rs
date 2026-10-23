//! Graph-Backed Attack Surface Model (v0.2)
//!
//! Provides normalized database models and query projections for:
//! Target -> Asset -> DNS Record -> IP -> Service -> HTTP Service -> Endpoint -> Parameter -> Finding -> Evidence

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

/// Normalized record of a DNS resolution mapping
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DnsRecord {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub host: String,
    pub record_type: String,
    pub value: String,
    pub ttl: Option<i32>,
    pub source_tool: String,
    pub job_id: Option<Uuid>,
    pub confidence: f32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/// Normalized record of an active HTTP/HTTPS service
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HttpService {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub port_id: Option<Uuid>,
    pub url: String,
    pub host: String,
    pub port: i32,
    pub scheme: String,
    pub status_code: Option<i32>,
    pub title: Option<String>,
    pub web_server: Option<String>,
    pub technologies: serde_json::Value,
    pub source_tool: String,
    pub job_id: Option<Uuid>,
    pub confidence: f32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/// Normalized record of a discovered input parameter
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EndpointParameter {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub endpoint_id: Option<Uuid>,
    pub endpoint_url: String,
    pub name: String,
    pub param_location: String,
    pub example_value: Option<String>,
    pub reflected: bool,
    pub tested_actions: serde_json::Value,
    pub source_tool: String,
    pub job_id: Option<Uuid>,
    pub confidence: f32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/// Normalized provenance edge in the Attack Surface Graph
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AttackSurfaceRelationship {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub source_type: String,
    pub source_id: String,
    pub source_label: String,
    pub target_type: String,
    pub target_id: String,
    pub target_label: String,
    pub relationship_type: String,
    pub source_tool: String,
    pub job_id: Option<Uuid>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub confidence: f32,
    pub metadata: serde_json::Value,
}

/// Renderable graph node for visualization & query APIs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphNode {
    pub id: String,
    pub node_type: String,
    pub label: String,
    pub unexplored: bool,
    pub parent_id: Option<String>,
    pub metadata: serde_json::Value,
}

/// Renderable graph edge for visualization & query APIs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub relationship: String,
    pub source_tool: String,
    pub confidence: f32,
}

/// Graph view representation of an entire investigation attack surface
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AttackSurfaceGraph {
    pub investigation_id: Uuid,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub summary: AttackSurfaceSummary,
    pub unexplored: Vec<UnexploredSurface>,
}

/// Summary counts across each tier of the attack surface graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct AttackSurfaceSummary {
    pub investigation_id: Uuid,
    pub target_count: usize,
    pub asset_count: usize,
    pub dns_record_count: usize,
    pub service_count: usize,
    pub http_service_count: usize,
    pub endpoint_count: usize,
    pub parameter_count: usize,
    pub finding_count: usize,
    pub evidence_count: usize,
    pub unexplored_count: usize,
}

/// Actionable unexplored attack surface opportunity for the planner
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UnexploredSurface {
    pub id: String,
    pub category: String,
    pub target: String,
    pub node_type: String,
    pub parent_entity: String,
    pub recommended_capability: String,
    pub recommended_tool: String,
    pub priority_score: f64,
    pub reason: String,
}

// =========================================================================
// DATABASE / IN-MEMORY PERSISTENCE HELPERS
// =========================================================================

pub async fn save_relationship(app_state: &AppState, rel: &AttackSurfaceRelationship) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO attack_surface_relationships (
                id, investigation_id, source_type, source_id, source_label,
                target_type, target_id, target_label, relationship_type,
                source_tool, job_id, first_seen, last_seen, confidence, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (investigation_id, source_type, source_id, target_type, target_id, relationship_type)
            DO UPDATE SET last_seen = NOW(), confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata"#,
        )
        .bind(rel.id)
        .bind(rel.investigation_id)
        .bind(&rel.source_type)
        .bind(&rel.source_id)
        .bind(&rel.source_label)
        .bind(&rel.target_type)
        .bind(&rel.target_id)
        .bind(&rel.target_label)
        .bind(&rel.relationship_type)
        .bind(&rel.source_tool)
        .bind(rel.job_id)
        .bind(rel.first_seen)
        .bind(rel.last_seen)
        .bind(rel.confidence)
        .bind(&rel.metadata)
        .execute(app_state.db())
        .await;
    }

    let mut lock = app_state.in_memory_attack_surface_relationships().write().await;
    if let Some(pos) = lock.iter().position(|r| {
        r.investigation_id == rel.investigation_id
            && r.source_type == rel.source_type
            && r.source_id == rel.source_id
            && r.target_type == rel.target_type
            && r.target_id == rel.target_id
            && r.relationship_type == rel.relationship_type
    }) {
        lock[pos] = rel.clone();
    } else {
        lock.push(rel.clone());
    }
}

pub async fn list_relationships(
    app_state: &AppState,
    investigation_id: Uuid,
) -> Vec<AttackSurfaceRelationship> {
    if app_state.has_db() {
        if let Ok(rels) = sqlx::query_as::<_, AttackSurfaceRelationship>(
            "SELECT * FROM attack_surface_relationships WHERE investigation_id = $1 ORDER BY first_seen ASC",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            if !rels.is_empty() {
                return rels;
            }
        }
    }

    let lock = app_state.in_memory_attack_surface_relationships().read().await;
    lock.iter()
        .filter(|r| r.investigation_id == investigation_id)
        .cloned()
        .collect()
}

pub async fn save_dns_record(app_state: &AppState, rec: &DnsRecord) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO dns_records (
                id, investigation_id, host, record_type, value, ttl,
                source_tool, job_id, confidence, first_seen, last_seen
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (investigation_id, host, record_type, value)
            DO UPDATE SET last_seen = NOW(), confidence = EXCLUDED.confidence"#,
        )
        .bind(rec.id)
        .bind(rec.investigation_id)
        .bind(&rec.host)
        .bind(&rec.record_type)
        .bind(&rec.value)
        .bind(rec.ttl)
        .bind(&rec.source_tool)
        .bind(rec.job_id)
        .bind(rec.confidence)
        .bind(rec.first_seen)
        .bind(rec.last_seen)
        .execute(app_state.db())
        .await;
    }

    let mut lock = app_state.in_memory_dns_records().write().await;
    if let Some(pos) = lock.iter().position(|r| {
        r.investigation_id == rec.investigation_id
            && r.host == rec.host
            && r.record_type == rec.record_type
            && r.value == rec.value
    }) {
        lock[pos] = rec.clone();
    } else {
        lock.push(rec.clone());
    }
}

pub async fn list_dns_records(app_state: &AppState, investigation_id: Uuid) -> Vec<DnsRecord> {
    if app_state.has_db() {
        if let Ok(records) = sqlx::query_as::<_, DnsRecord>(
            "SELECT * FROM dns_records WHERE investigation_id = $1 ORDER BY host ASC",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            if !records.is_empty() {
                return records;
            }
        }
    }

    let lock = app_state.in_memory_dns_records().read().await;
    lock.iter()
        .filter(|r| r.investigation_id == investigation_id)
        .cloned()
        .collect()
}

pub async fn save_http_service(app_state: &AppState, svc: &HttpService) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO http_services (
                id, investigation_id, port_id, url, host, port, scheme,
                status_code, title, web_server, technologies, source_tool, job_id, confidence, first_seen, last_seen
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (investigation_id, url)
            DO UPDATE SET last_seen = NOW(), status_code = EXCLUDED.status_code, technologies = EXCLUDED.technologies"#,
        )
        .bind(svc.id)
        .bind(svc.investigation_id)
        .bind(svc.port_id)
        .bind(&svc.url)
        .bind(&svc.host)
        .bind(svc.port)
        .bind(&svc.scheme)
        .bind(svc.status_code)
        .bind(&svc.title)
        .bind(&svc.web_server)
        .bind(&svc.technologies)
        .bind(&svc.source_tool)
        .bind(svc.job_id)
        .bind(svc.confidence)
        .bind(svc.first_seen)
        .bind(svc.last_seen)
        .execute(app_state.db())
        .await;
    }

    let mut lock = app_state.in_memory_http_services().write().await;
    if let Some(pos) = lock
        .iter()
        .position(|s| s.investigation_id == svc.investigation_id && s.url == svc.url)
    {
        lock[pos] = svc.clone();
    } else {
        lock.push(svc.clone());
    }
}

pub async fn list_http_services(app_state: &AppState, investigation_id: Uuid) -> Vec<HttpService> {
    if app_state.has_db() {
        if let Ok(svcs) = sqlx::query_as::<_, HttpService>(
            "SELECT * FROM http_services WHERE investigation_id = $1 ORDER BY port ASC",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            if !svcs.is_empty() {
                return svcs;
            }
        }
    }

    let lock = app_state.in_memory_http_services().read().await;
    lock.iter()
        .filter(|s| s.investigation_id == investigation_id)
        .cloned()
        .collect()
}

pub async fn save_endpoint_parameter(app_state: &AppState, param: &EndpointParameter) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"INSERT INTO endpoint_parameters (
                id, investigation_id, endpoint_id, endpoint_url, name,
                param_location, example_value, reflected, tested_actions,
                source_tool, job_id, confidence, first_seen, last_seen
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (investigation_id, endpoint_url, name, param_location)
            DO UPDATE SET last_seen = NOW(), reflected = EXCLUDED.reflected, tested_actions = EXCLUDED.tested_actions"#,
        )
        .bind(param.id)
        .bind(param.investigation_id)
        .bind(param.endpoint_id)
        .bind(&param.endpoint_url)
        .bind(&param.name)
        .bind(&param.param_location)
        .bind(&param.example_value)
        .bind(param.reflected)
        .bind(&param.tested_actions)
        .bind(&param.source_tool)
        .bind(param.job_id)
        .bind(param.confidence)
        .bind(param.first_seen)
        .bind(param.last_seen)
        .execute(app_state.db())
        .await;
    }

    let mut lock = app_state.in_memory_endpoint_parameters().write().await;
    if let Some(pos) = lock.iter().position(|p| {
        p.investigation_id == param.investigation_id
            && p.endpoint_url == param.endpoint_url
            && p.name == param.name
            && p.param_location == param.param_location
    }) {
        lock[pos] = param.clone();
    } else {
        lock.push(param.clone());
    }
}

pub async fn list_endpoint_parameters(
    app_state: &AppState,
    investigation_id: Uuid,
) -> Vec<EndpointParameter> {
    if app_state.has_db() {
        if let Ok(params) = sqlx::query_as::<_, EndpointParameter>(
            "SELECT * FROM endpoint_parameters WHERE investigation_id = $1 ORDER BY name ASC",
        )
        .bind(investigation_id)
        .fetch_all(app_state.db())
        .await
        {
            if !params.is_empty() {
                return params;
            }
        }
    }

    let lock = app_state.in_memory_endpoint_parameters().read().await;
    lock.iter()
        .filter(|p| p.investigation_id == investigation_id)
        .cloned()
        .collect()
}

pub async fn mark_parameter_tested(
    app_state: &AppState,
    investigation_id: Uuid,
    url: &str,
    param_name: &str,
    action: &str,
) {
    if app_state.has_db() {
        let _ = sqlx::query(
            r#"UPDATE endpoint_parameters
            SET tested_actions = CASE 
                WHEN NOT (tested_actions ? $1) THEN tested_actions || jsonb_build_array($1)
                ELSE tested_actions
            END,
            last_seen = NOW()
            WHERE investigation_id = $2 AND endpoint_url = $3 AND name = $4"#,
        )
        .bind(action)
        .bind(investigation_id)
        .bind(url)
        .bind(param_name)
        .execute(app_state.db())
        .await;
    }

    let mut lock = app_state.in_memory_endpoint_parameters().write().await;
    if let Some(p) = lock.iter_mut().find(|p| {
        p.investigation_id == investigation_id
            && (p.endpoint_url == url || url.contains(&p.endpoint_url))
            && (p.name == param_name || param_name == "*")
    }) {
        if let Some(arr) = p.tested_actions.as_array_mut() {
            let act_val = serde_json::Value::String(action.to_string());
            if !arr.contains(&act_val) {
                arr.push(act_val);
            }
        } else {
            p.tested_actions = serde_json::json!([action]);
        }
        p.last_seen = Utc::now();
    }
}
