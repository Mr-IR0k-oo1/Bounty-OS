//! Attack Surface Graph Engine (v0.2)
//!
//! Provides relational graph construction, provenance tracking, graph projection,
//! and unexplored attack surface discovery across:
//! Target -> Asset -> DNS Record -> IP -> Service -> HTTP Service -> Endpoint -> Parameter -> Finding -> Evidence

use std::collections::{HashMap, HashSet};
use chrono::Utc;
use uuid::Uuid;

use crate::models::attack_surface::{
    AttackSurfaceGraph, AttackSurfaceRelationship, AttackSurfaceSummary, DnsRecord,
    EndpointParameter, GraphEdge, GraphNode, HttpService, UnexploredSurface,
};
use crate::models::finding::Finding;
use crate::models::port::Port;
use crate::models::subdomain::Subdomain;
use crate::models::url::Url;
use crate::state::AppState;

pub struct AttackSurfaceEngine;

impl AttackSurfaceEngine {
    /// Builds the full normalized Attack Surface Graph for an investigation.
    pub async fn build_graph(app_state: &AppState, investigation_id: Uuid) -> AttackSurfaceGraph {
        let mut nodes: Vec<GraphNode> = Vec::new();
        let mut edges: Vec<GraphEdge> = Vec::new();

        // 1. Target node
        let (target_label, program_url) = {
            let programs = app_state.in_memory_programs().read().await;
            programs
                .iter()
                .find(|p| p.id == investigation_id)
                .map(|p| (p.name.clone(), p.program_url.clone()))
                .unwrap_or_else(|| (format!("target-{}", investigation_id), None))
        };
        let target_node_id = format!("target:{}", investigation_id);
        nodes.push(GraphNode {
            id: target_node_id.clone(),
            node_type: "target".to_string(),
            label: target_label.clone(),
            unexplored: false,
            parent_id: None,
            metadata: serde_json::json!({
                "investigation_id": investigation_id,
                "program_url": program_url
            }),
        });

        // 2. Assets (Subdomains + Scope targets fallback)
        let mut subdomains: Vec<Subdomain> = {
            if app_state.has_db() {
                sqlx::query_as::<_, Subdomain>(
                    "SELECT * FROM subdomains WHERE program_id = $1 ORDER BY subdomain ASC",
                )
                .bind(investigation_id)
                .fetch_all(app_state.db())
                .await
                .unwrap_or_default()
            } else {
                let lock = app_state.in_memory_subdomains().read().await;
                lock.iter()
                    .filter(|s| s.program_id == investigation_id)
                    .cloned()
                    .collect()
            }
        };

        if subdomains.is_empty() {
            let scope_targets: Vec<crate::models::scope::ScopeTarget> = if app_state.has_db() {
                sqlx::query_as::<_, crate::models::scope::ScopeTarget>(
                    "SELECT * FROM scope_targets WHERE program_id = $1",
                )
                .bind(investigation_id)
                .fetch_all(app_state.db())
                .await
                .unwrap_or_default()
            } else {
                let lock = app_state.in_memory_scope().read().await;
                lock.iter()
                    .filter(|s| s.program_id == investigation_id)
                    .cloned()
                    .collect()
            };
            for st in scope_targets {
                if !st.out_of_scope {
                    subdomains.push(Subdomain {
                        id: Uuid::new_v4(),
                        program_id: investigation_id,
                        subdomain: st.target.clone(),
                        ip_address: None,
                        status_code: None,
                        title: None,
                        web_server: None,
                        content_type: None,
                        content_length: None,
                        tech: vec![],
                        cdn_name: None,
                        source: "scope".to_string(),
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                    });
                }
            }
        }

        // 3. DNS Records
        let dns_records = crate::models::attack_surface::list_dns_records(app_state, investigation_id).await;
        let mut dns_by_host: HashMap<String, Vec<DnsRecord>> = HashMap::new();
        for r in &dns_records {
            dns_by_host.entry(r.host.clone()).or_default().push(r.clone());
        }

        // 4. Ports & Services
        let ports: Vec<Port> = {
            if app_state.has_db() {
                sqlx::query_as::<_, Port>(
                    "SELECT * FROM ports WHERE program_id = $1",
                )
                .bind(investigation_id)
                .fetch_all(app_state.db())
                .await
                .unwrap_or_default()
            } else {
                Vec::new()
            }
        };

        // 5. HTTP Services
        let mut http_services = crate::models::attack_surface::list_http_services(app_state, investigation_id).await;
        if http_services.is_empty() {
            if let Some(ref purl) = program_url {
                if let Ok(parsed) = reqwest::Url::parse(purl) {
                    let host = parsed.host_str().unwrap_or("").to_string();
                    let port = parsed.port_or_known_default().unwrap_or(80) as i32;
                    let scheme = parsed.scheme().to_string();
                    http_services.push(HttpService {
                        id: Uuid::new_v4(),
                        investigation_id,
                        port_id: None,
                        url: purl.clone(),
                        host,
                        port,
                        scheme,
                        status_code: Some(200),
                        title: Some("Root Web Application".to_string()),
                        web_server: None,
                        technologies: serde_json::json!([]),
                        source_tool: "scope".to_string(),
                        job_id: None,
                        confidence: 1.0,
                        first_seen: Utc::now(),
                        last_seen: Utc::now(),
                    });
                }
            }
        }

        // 6. Endpoints (URLs)
        let urls: Vec<Url> = {
            if app_state.has_db() {
                sqlx::query_as::<_, Url>(
                    "SELECT * FROM urls WHERE program_id = $1",
                )
                .bind(investigation_id)
                .fetch_all(app_state.db())
                .await
                .unwrap_or_default()
            } else {
                Vec::new()
            }
        };

        // 7. Parameters
        let mut parameters = crate::models::attack_surface::list_endpoint_parameters(app_state, investigation_id).await;
        let mut params_by_url: HashMap<String, Vec<EndpointParameter>> = HashMap::new();
        for p in &parameters {
            params_by_url.entry(p.endpoint_url.clone()).or_default().push(p.clone());
        }

        // Also extract query parameters from discovered URLs
        for u in &urls {
            if let Ok(parsed) = reqwest::Url::parse(&u.url) {
                for (k, v) in parsed.query_pairs() {
                    let entry = params_by_url.entry(u.url.clone()).or_default();
                    if !entry.iter().any(|p| p.name == k) {
                        let param = EndpointParameter {
                            id: Uuid::new_v4(),
                            investigation_id,
                            endpoint_id: Some(u.id),
                            endpoint_url: u.url.clone(),
                            name: k.to_string(),
                            param_location: "query".to_string(),
                            example_value: Some(v.to_string()),
                            reflected: true,
                            tested_actions: serde_json::json!([]),
                            source_tool: "crawler".to_string(),
                            job_id: None,
                            confidence: 1.0,
                            first_seen: Utc::now(),
                            last_seen: Utc::now(),
                        };
                        entry.push(param.clone());
                        parameters.push(param);
                    }
                }
            }
        }

        // 8. Findings
        let findings: Vec<Finding> = {
            if app_state.has_db() {
                sqlx::query_as::<_, Finding>(
                    "SELECT * FROM findings WHERE program_id = $1 ORDER BY severity DESC",
                )
                .bind(investigation_id)
                .fetch_all(app_state.db())
                .await
                .unwrap_or_default()
            } else {
                let lock = app_state.in_memory_findings().read().await;
                lock.iter()
                    .filter(|f| f.program_id == investigation_id)
                    .cloned()
                    .collect()
            }
        };

        // 9. Existing stored relationships
        let stored_relationships = crate::models::attack_surface::list_relationships(app_state, investigation_id).await;

        // Assemble Subdomain nodes
        let mut resolved_subdomains = HashSet::new();
        for sub in &subdomains {
            let sub_id = format!("asset:{}", sub.subdomain);
            let has_dns = dns_by_host.contains_key(&sub.subdomain) || sub.ip_address.is_some();
            if has_dns {
                resolved_subdomains.insert(sub.subdomain.clone());
            }

            nodes.push(GraphNode {
                id: sub_id.clone(),
                node_type: "asset".to_string(),
                label: sub.subdomain.clone(),
                unexplored: !has_dns,
                parent_id: Some(target_node_id.clone()),
                metadata: serde_json::json!({
                    "ip": sub.ip_address,
                    "source": sub.source,
                    "first_seen": sub.created_at
                }),
            });

            edges.push(GraphEdge {
                id: format!("{}:{}", target_node_id, sub_id),
                source: target_node_id.clone(),
                target: sub_id.clone(),
                relationship: "has_asset".to_string(),
                source_tool: sub.source.clone(),
                confidence: 1.0,
            });

            // If IP is present directly on subdomain, connect IP
            if let Some(ref ip) = sub.ip_address {
                let ip_id = format!("ip:{}", ip);
                nodes.push(GraphNode {
                    id: ip_id.clone(),
                    node_type: "ip".to_string(),
                    label: ip.clone(),
                    unexplored: false,
                    parent_id: Some(sub_id.clone()),
                    metadata: serde_json::json!({ "host": sub.subdomain }),
                });

                edges.push(GraphEdge {
                    id: format!("{}:{}", sub_id, ip_id),
                    source: sub_id.clone(),
                    target: ip_id.clone(),
                    relationship: "resolves_to".to_string(),
                    source_tool: "dnsx".to_string(),
                    confidence: 1.0,
                });
            }
        }

        // Assemble DNS nodes & edges
        for (host, records) in &dns_by_host {
            let host_node_id = format!("asset:{}", host);
            for rec in records {
                let dns_node_id = format!("dns:{}:{}:{}", rec.record_type, host, rec.value);
                nodes.push(GraphNode {
                    id: dns_node_id.clone(),
                    node_type: "dns_record".to_string(),
                    label: format!("{} -> {}", rec.record_type, rec.value),
                    unexplored: false,
                    parent_id: Some(host_node_id.clone()),
                    metadata: serde_json::json!({
                        "record_type": rec.record_type,
                        "value": rec.value,
                        "ttl": rec.ttl
                    }),
                });

                edges.push(GraphEdge {
                    id: format!("{}:{}", host_node_id, dns_node_id),
                    source: host_node_id.clone(),
                    target: dns_node_id.clone(),
                    relationship: "has_dns_record".to_string(),
                    source_tool: rec.source_tool.clone(),
                    confidence: rec.confidence,
                });

                // Connect to IP node if A or AAAA
                if rec.record_type == "A" || rec.record_type == "AAAA" {
                    let ip_id = format!("ip:{}", rec.value);
                    if !nodes.iter().any(|n| n.id == ip_id) {
                        nodes.push(GraphNode {
                            id: ip_id.clone(),
                            node_type: "ip".to_string(),
                            label: rec.value.clone(),
                            unexplored: false,
                            parent_id: Some(dns_node_id.clone()),
                            metadata: serde_json::json!({ "origin": host }),
                        });
                    }
                    edges.push(GraphEdge {
                        id: format!("{}:{}", dns_node_id, ip_id),
                        source: dns_node_id.clone(),
                        target: ip_id.clone(),
                        relationship: "maps_to_ip".to_string(),
                        source_tool: rec.source_tool.clone(),
                        confidence: rec.confidence,
                    });
                }
            }
        }

        // Assemble Ports & Services
        for p in &ports {
            let port_id = format!("service:{}:{}", p.port, p.service.as_deref().unwrap_or("unknown"));
            nodes.push(GraphNode {
                id: port_id.clone(),
                node_type: "service".to_string(),
                label: format!("{}/{}", p.port, p.service.as_deref().unwrap_or("tcp")),
                unexplored: p.service.is_none(),
                parent_id: None,
                metadata: serde_json::json!({
                    "port": p.port,
                    "service": p.service,
                    "banner": p.banner
                }),
            });
        }

        // Assemble HTTP Services
        for hs in &http_services {
            let hs_id = format!("http_service:{}", hs.url);
            let asset_id = format!("asset:{}", hs.host);
            nodes.push(GraphNode {
                id: hs_id.clone(),
                node_type: "http_service".to_string(),
                label: format!("{} ({})", hs.url, hs.status_code.unwrap_or(0)),
                unexplored: false,
                parent_id: Some(asset_id.clone()),
                metadata: serde_json::json!({
                    "url": hs.url,
                    "status_code": hs.status_code,
                    "title": hs.title,
                    "web_server": hs.web_server,
                    "technologies": hs.technologies
                }),
            });

            edges.push(GraphEdge {
                id: format!("{}:{}", asset_id, hs_id),
                source: asset_id.clone(),
                target: hs_id.clone(),
                relationship: "exposes_http".to_string(),
                source_tool: hs.source_tool.clone(),
                confidence: hs.confidence,
            });
        }

        // Assemble Endpoints (URLs) & Parameters
        let mut crawled_endpoints = HashSet::new();
        for u in &urls {
            crawled_endpoints.insert(u.url.clone());
            let ep_id = format!("endpoint:{}", u.url);
            let has_params = params_by_url.contains_key(&u.url) || u.url.contains('?');

            nodes.push(GraphNode {
                id: ep_id.clone(),
                node_type: "endpoint".to_string(),
                label: u.url.clone(),
                unexplored: has_params && !params_by_url.contains_key(&u.url),
                parent_id: None,
                metadata: serde_json::json!({
                    "status_code": u.status_code,
                    "content_length": u.content_length,
                    "content_type": u.content_type
                }),
            });

            // Connect parameters
            if let Some(params) = params_by_url.get(&u.url) {
                for param in params {
                    let param_id = format!("param:{}:{}:{}", u.url, param.param_location, param.name);
                    let is_unexplored = !param.reflected && param.tested_actions.as_array().map_or(true, |a| a.is_empty());

                    nodes.push(GraphNode {
                        id: param_id.clone(),
                        node_type: "parameter".to_string(),
                        label: format!("{}: {}", param.param_location, param.name),
                        unexplored: is_unexplored,
                        parent_id: Some(ep_id.clone()),
                        metadata: serde_json::json!({
                            "name": param.name,
                            "location": param.param_location,
                            "reflected": param.reflected,
                            "example_value": param.example_value,
                            "tested_actions": param.tested_actions
                        }),
                    });

                    edges.push(GraphEdge {
                        id: format!("{}:{}", ep_id, param_id),
                        source: ep_id.clone(),
                        target: param_id.clone(),
                        relationship: "accepts_parameter".to_string(),
                        source_tool: param.source_tool.clone(),
                        confidence: param.confidence,
                    });
                }
            }
        }

        // Connect Findings
        for f in &findings {
            let f_id = format!("finding:{}", f.id);
            nodes.push(GraphNode {
                id: f_id.clone(),
                node_type: "finding".to_string(),
                label: format!("[{}] {}", f.severity, f.title),
                unexplored: false,
                parent_id: None,
                metadata: serde_json::json!({
                    "severity": f.severity,
                    "confidence": f.llm_confidence.unwrap_or(1.0),
                    "status": f.status,
                    "cvss_score": f.cvss_score
                }),
            });
        }

        // Incorporate persisted relationship edges
        for rel in &stored_relationships {
            let edge_id = format!("{}:{}:{}", rel.source_id, rel.target_id, rel.relationship_type);
            if !edges.iter().any(|e| e.id == edge_id) {
                edges.push(GraphEdge {
                    id: edge_id,
                    source: rel.source_id.clone(),
                    target: rel.target_id.clone(),
                    relationship: rel.relationship_type.clone(),
                    source_tool: rel.source_tool.clone(),
                    confidence: rel.confidence,
                });
            }
        }

        // Calculate summary
        let summary = AttackSurfaceSummary {
            investigation_id,
            target_count: 1,
            asset_count: subdomains.len(),
            dns_record_count: dns_records.len(),
            service_count: ports.len(),
            http_service_count: http_services.len(),
            endpoint_count: urls.len(),
            parameter_count: parameters.len(),
            finding_count: findings.len(),
            evidence_count: stored_relationships.len(),
            unexplored_count: nodes.iter().filter(|n| n.unexplored).count(),
        };

        // Extract actionable unexplored items
        let unexplored = Self::extract_unexplored_surface(
            &subdomains,
            &resolved_subdomains,
            &http_services,
            &urls,
            &parameters,
            &findings,
        );

        AttackSurfaceGraph {
            investigation_id,
            nodes,
            edges,
            summary,
            unexplored,
        }
    }

    /// Identifies all currently unexplored nodes and surfaces in the graph
    /// with recommended tool actions and priority scores for the planner.
    pub fn extract_unexplored_surface(
        subdomains: &[Subdomain],
        resolved_subdomains: &HashSet<String>,
        http_services: &[HttpService],
        urls: &[Url],
        parameters: &[EndpointParameter],
        findings: &[Finding],
    ) -> Vec<UnexploredSurface> {
        let mut unexplored = Vec::new();

        // 0. Empty attack surface -> Explore root target
        if subdomains.is_empty() && http_services.is_empty() {
            unexplored.push(UnexploredSurface {
                id: "unexp:recon_subdomains".to_string(),
                category: "reconnaissance".to_string(),
                target: "target.local".to_string(),
                node_type: "target".to_string(),
                parent_entity: "target".to_string(),
                recommended_capability: "recon_subdomains".to_string(),
                recommended_tool: "subfinder".to_string(),
                priority_score: 0.90,
                reason: "Investigation has no discovered assets; perform passive subdomain reconnaissance".to_string(),
            });
        }

        // 1. Unresolved subdomains -> Explore via DNS resolution (dnsx)
        for s in subdomains {
            if !resolved_subdomains.contains(&s.subdomain) && s.ip_address.is_none() {
                unexplored.push(UnexploredSurface {
                    id: format!("unres:{}", s.subdomain),
                    category: "dns_resolution".to_string(),
                    target: s.subdomain.clone(),
                    node_type: "asset".to_string(),
                    parent_entity: s.subdomain.clone(),
                    recommended_capability: "dns_resolution".to_string(),
                    recommended_tool: "dnsx".to_string(),
                    priority_score: 0.85,
                    reason: format!("Subdomain {} has no DNS resolution or IP mapped", s.subdomain),
                });
            }
        }

        // 2. Active HTTP services with zero crawl coverage -> Explore via Katana / GAU
        let crawled_hosts: HashSet<String> = urls
            .iter()
            .filter_map(|u| {
                reqwest::Url::parse(&u.url).ok().and_then(|parsed| parsed.host_str().map(|h| h.to_string()))
            })
            .collect();

        for hs in http_services {
            if !crawled_hosts.contains(&hs.host) {
                unexplored.push(UnexploredSurface {
                    id: format!("uncrawl:{}", hs.url),
                    category: "web_crawling".to_string(),
                    target: hs.url.clone(),
                    node_type: "http_service".to_string(),
                    parent_entity: hs.host.clone(),
                    recommended_capability: "crawl_application".to_string(),
                    recommended_tool: "katana".to_string(),
                    priority_score: 0.90,
                    reason: format!("Live HTTP service at {} has no discovered endpoints", hs.url),
                });
            }
        }

        // 3. Parameters with untested reflection / XSS
        let xss_tested_params: HashSet<String> = findings
            .iter()
            .filter(|f| f.finding_type.to_lowercase().contains("xss") || f.title.to_lowercase().contains("xss"))
            .filter_map(|f| f.matched_at.clone())
            .collect();

        for param in parameters {
            let tested = param
                .tested_actions
                .as_array()
                .map_or(false, |arr| arr.iter().any(|v| v.as_str() == Some("investigate_xss")));

            if !tested && !xss_tested_params.contains(&param.endpoint_url) {
                let priority = if param.reflected { 0.95 } else { 0.80 };
                unexplored.push(UnexploredSurface {
                    id: format!("unparam_xss:{}:{}", param.endpoint_url, param.name),
                    category: "parameter_fuzzing".to_string(),
                    target: param.endpoint_url.clone(),
                    node_type: "parameter".to_string(),
                    parent_entity: param.endpoint_url.clone(),
                    recommended_capability: "investigate_xss".to_string(),
                    recommended_tool: "dalfox".to_string(),
                    priority_score: priority,
                    reason: if param.reflected {
                        format!("Parameter '{}' is REFLECTED on {} but has no active XSS proof", param.name, param.endpoint_url)
                    } else {
                        format!("Parameter '{}' on {} has not been tested for injection vulnerabilities", param.name, param.endpoint_url)
                    },
                });
            }
        }

        // Sort descending by priority score
        unexplored.sort_by(|a, b| b.priority_score.partial_cmp(&a.priority_score).unwrap_or(std::cmp::Ordering::Equal));
        unexplored
    }

    /// Records a newly discovered graph relationship with full provenance.
    pub async fn record_relationship(
        app_state: &AppState,
        investigation_id: Uuid,
        source_type: &str,
        source_id: &str,
        source_label: &str,
        target_type: &str,
        target_id: &str,
        target_label: &str,
        relationship_type: &str,
        source_tool: &str,
        job_id: Option<Uuid>,
        confidence: f32,
        metadata: serde_json::Value,
    ) {
        let rel = AttackSurfaceRelationship {
            id: Uuid::new_v4(),
            investigation_id,
            source_type: source_type.to_string(),
            source_id: source_id.to_string(),
            source_label: source_label.to_string(),
            target_type: target_type.to_string(),
            target_id: target_id.to_string(),
            target_label: target_label.to_string(),
            relationship_type: relationship_type.to_string(),
            source_tool: source_tool.to_string(),
            job_id,
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            confidence,
            metadata,
        };

        crate::models::attack_surface::save_relationship(app_state, &rel).await;
    }
}
