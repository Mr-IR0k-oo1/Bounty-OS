//! Attack Surface Graph
//!
//! Models relationships between discovered reconnaissance and vulnerability assets:
//! RootTarget -> Subdomains -> Hosts -> Services -> Endpoints -> Parameters -> Findings / Technologies.
//!
//! Provides structural context for candidate action generation and explainable planning.

use crate::intelligence::state::InvestigationState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Types of nodes within the attack surface graph
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    RootTarget,
    Subdomain,
    Host,
    Service,
    Endpoint,
    Parameter,
    Technology,
    Finding,
}

/// A node in the attack surface graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphNode {
    pub id: String,
    pub node_type: NodeType,
    pub label: String,
    pub attributes: HashMap<String, String>,
}

impl GraphNode {
    pub fn new(id: impl Into<String>, node_type: NodeType, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            node_type,
            label: label.into(),
            attributes: HashMap::new(),
        }
    }

    pub fn with_attr(mut self, key: impl Into<String>, val: impl Into<String>) -> Self {
        self.attributes.insert(key.into(), val.into());
        self
    }
}

/// Relationship edge types between attack surface nodes
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    HasSubdomain,
    ResolvesTo,
    ExposesService,
    HostsEndpoint,
    HasParameter,
    RunsTechnology,
    HasFinding,
}

/// A directed edge in the attack surface graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub edge_type: EdgeType,
}

/// The Attack Surface Graph
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct AttackSurfaceGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub edges: Vec<GraphEdge>,
}

impl AttackSurfaceGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_node(&mut self, node: GraphNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    pub fn add_edge(&mut self, from: impl Into<String>, to: impl Into<String>, edge_type: EdgeType) {
        let from_str = from.into();
        let to_str = to.into();
        if !self.edges.iter().any(|e| e.from == from_str && e.to == to_str && e.edge_type == edge_type) {
            self.edges.push(GraphEdge {
                from: from_str,
                to: to_str,
                edge_type,
            });
        }
    }

    pub fn get_node(&self, id: &str) -> Option<&GraphNode> {
        self.nodes.get(id)
    }

    /// Retrieve direct children IDs of a given node
    pub fn children_of(&self, parent_id: &str) -> Vec<(&GraphNode, EdgeType)> {
        let mut results = Vec::new();
        for edge in &self.edges {
            if edge.from == parent_id {
                if let Some(child_node) = self.nodes.get(&edge.to) {
                    results.push((child_node, edge.edge_type));
                }
            }
        }
        results
    }

    /// Build graph representation directly from InvestigationState
    pub fn from_state(state: &InvestigationState) -> Self {
        let mut graph = Self::new();

        // 1. Root Target Node
        let root_id = format!("root:{}", state.target);
        graph.add_node(
            GraphNode::new(&root_id, NodeType::RootTarget, &state.target)
                .with_attr("profile", format!("{:?}", state.profile)),
        );

        // 2. Subdomains
        for sub in &state.subdomains {
            let sub_id = format!("sub:{}", sub.subdomain);
            graph.add_node(
                GraphNode::new(&sub_id, NodeType::Subdomain, &sub.subdomain)
                    .with_attr("dns_resolved", sub.dns_resolved.to_string())
                    .with_attr("discovered_by", sub.discovered_by.clone()),
            );
            graph.add_edge(&root_id, &sub_id, EdgeType::HasSubdomain);
        }

        // 3. Hosts
        for host in &state.hosts {
            let host_id = format!("host:{}", host.host);
            let mut node = GraphNode::new(&host_id, NodeType::Host, &host.host)
                .with_attr("ports_scanned", host.ports_scanned.to_string());
            if let Some(ref ip) = host.ip {
                node = node.with_attr("ip", ip);
            }
            graph.add_node(node);

            // Connect subdomain to host if matched
            let sub_id = format!("sub:{}", host.host);
            if graph.nodes.contains_key(&sub_id) {
                graph.add_edge(&sub_id, &host_id, EdgeType::ResolvesTo);
            } else {
                graph.add_edge(&root_id, &host_id, EdgeType::ResolvesTo);
            }
        }

        // 4. Services
        for svc in &state.services {
            let host_id = format!("host:{}", svc.host);
            let svc_id = format!("svc:{}:{}", svc.host, svc.port);
            let label = format!("{}:{}", svc.host, svc.port);
            let mut node = GraphNode::new(&svc_id, NodeType::Service, label)
                .with_attr("port", svc.port.to_string())
                .with_attr("protocol", svc.protocol.clone())
                .with_attr("http_probed", svc.http_probed.to_string());
            if let Some(ref name) = svc.service_name {
                node = node.with_attr("service_name", name);
            }
            if let Some(ref b) = svc.banner {
                node = node.with_attr("banner", b);
            }
            graph.add_node(node);
            graph.add_edge(&host_id, &svc_id, EdgeType::ExposesService);
        }

        // 5. Technologies
        for tech in &state.technologies {
            let tech_id = format!("tech:{}", tech.name);
            let label = if let Some(ref v) = tech.version {
                format!("{} {}", tech.name, v)
            } else {
                tech.name.clone()
            };
            let mut node = GraphNode::new(&tech_id, NodeType::Technology, label);
            if let Some(ref v) = tech.version {
                node = node.with_attr("version", v);
            }
            graph.add_node(node);

            // Connect to relevant services or root
            if state.services.is_empty() {
                graph.add_edge(&root_id, &tech_id, EdgeType::RunsTechnology);
            } else {
                for svc in &state.services {
                    if svc.is_likely_http() {
                        let svc_id = format!("svc:{}:{}", svc.host, svc.port);
                        graph.add_edge(&svc_id, &tech_id, EdgeType::RunsTechnology);
                    }
                }
            }
        }

        // 6. Endpoints & Parameters
        for ep in &state.endpoints {
            let svc_id = format!("svc:{}:{}", ep.host, ep.port);
            let ep_id = format!("ep:{}", ep.url);
            let mut ep_node = GraphNode::new(&ep_id, NodeType::Endpoint, &ep.path)
                .with_attr("url", &ep.url)
                .with_attr("method", &ep.method);
            if let Some(status) = ep.status_code {
                ep_node = ep_node.with_attr("status", status.to_string());
            }
            graph.add_node(ep_node);

            if graph.nodes.contains_key(&svc_id) {
                graph.add_edge(&svc_id, &ep_id, EdgeType::HostsEndpoint);
            } else {
                let host_id = format!("host:{}", ep.host);
                graph.add_edge(&host_id, &ep_id, EdgeType::HostsEndpoint);
            }

            // Parameters
            for param in &ep.params {
                let param_id = format!("param:{}:{}", ep.url, param.name);
                let mut p_node = GraphNode::new(&param_id, NodeType::Parameter, format!("parameter {}", param.name))
                    .with_attr("name", &param.name)
                    .with_attr("reflected", param.reflected.to_string())
                    .with_attr("tested_xss", param.tested_for_xss.to_string());
                if let Some(ref ctx) = param.reflection_context {
                    p_node = p_node.with_attr("reflection_context", ctx);
                }
                graph.add_node(p_node);
                graph.add_edge(&ep_id, &param_id, EdgeType::HasParameter);
            }
        }

        // 7. Findings
        for finding in &state.findings {
            let f_id = format!("finding:{}", finding.id);
            let f_node = GraphNode::new(&f_id, NodeType::Finding, &finding.title)
                .with_attr("severity", format!("{:?}", finding.severity))
                .with_attr("confidence", format!("{:?}", finding.confidence))
                .with_attr("verified", finding.verified.to_string());
            graph.add_node(f_node);

            // Link finding to matching endpoint or root
            let matched_ep_id = graph.nodes.values().find(|n| {
                n.node_type == NodeType::Endpoint && n.attributes.get("url").map(|u| u == &finding.target).unwrap_or(false)
            }).map(|n| n.id.clone());

            if let Some(ep_id) = matched_ep_id {
                graph.add_edge(&ep_id, &f_id, EdgeType::HasFinding);
            } else {
                graph.add_edge(&root_id, &f_id, EdgeType::HasFinding);
            }
        }

        graph
    }

    /// Render an ASCII hierarchy tree for explainability and auditing
    pub fn render_ascii_tree(&self, root_id: &str) -> String {
        let mut out = String::new();
        if let Some(root) = self.get_node(root_id) {
            out.push_str(&format!("{}\n", root.label));
            self.render_node_recursive(root_id, "  ", &mut out);
        }
        out
    }

    fn render_node_recursive(&self, node_id: &str, indent: &str, out: &mut String) {
        let children = self.children_of(node_id);
        for (i, (child, edge)) in children.iter().enumerate() {
            let is_last = i == children.len() - 1;
            let branch = if is_last { "└── " } else { "├── " };
            let type_tag = match edge {
                EdgeType::RunsTechnology => " [tech]",
                EdgeType::HasFinding => " [vuln]",
                EdgeType::HasParameter => " [param]",
                _ => "",
            };
            out.push_str(&format!("{}{}{}{}\n", indent, branch, child.label, type_tag));
            let next_indent = format!("{}{}", indent, if is_last { "    " } else { "│   " });
            self.render_node_recursive(&child.id, &next_indent, out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intelligence::state::{
        DiscoveredEndpoint, DiscoveredParam, DiscoveredTechnology, FindingConfidence, FindingSeverity,
        InvestigationProfile, ParamLocation, ScopeBoundary, StateFinding,
    };

    #[test]
    fn test_graph_construction_from_state() {
        let scope = ScopeBoundary::new();
        let mut state = InvestigationState::new("target.local", scope, InvestigationProfile::Standard);

        // Add service
        state.add_service("target.local", 8888, "tcp", Some("http".to_string()), None);

        // Add technologies
        state.add_technology(DiscoveredTechnology {
            name: "Apache".to_string(),
            version: Some("2.4.41".to_string()),
            cpe: None,
            category: Some("Web Server".to_string()),
            templates_matched: vec![],
        });
        state.add_technology(DiscoveredTechnology {
            name: "PHP".to_string(),
            version: Some("7.4.3".to_string()),
            cpe: None,
            category: Some("Language".to_string()),
            templates_matched: vec![],
        });

        // Add endpoints
        let mut ep1 = DiscoveredEndpoint::new(
            "http://target.local:8888/search?q=test",
            "target.local",
            8888,
            "/search?q=test",
        );
        ep1.params.push(DiscoveredParam {
            name: "q".to_string(),
            location: ParamLocation::Query,
            reflected: true,
            reflection_context: Some("body".to_string()),
            tested_for_xss: false,
            tested_for_sqli: false,
        });
        state.add_endpoint(ep1);

        state.add_endpoint(DiscoveredEndpoint::new(
            "http://target.local:8888/api/v1/config",
            "target.local",
            8888,
            "/api/v1/config",
        ));

        state.add_endpoint(DiscoveredEndpoint::new(
            "http://target.local:8888/admin",
            "target.local",
            8888,
            "/admin",
        ));

        // Add finding
        let finding = StateFinding::new(
            "Reflected XSS in search endpoint",
            FindingSeverity::Medium,
            FindingConfidence::Firm,
            "http://target.local:8888/search?q=test",
        );
        state.add_finding(finding);

        let graph = AttackSurfaceGraph::from_state(&state);
        let root_id = "root:target.local";
        assert!(graph.nodes.contains_key(root_id));

        let ascii = graph.render_ascii_tree(root_id);
        assert!(ascii.contains("target.local"));
        assert!(ascii.contains("8888"));
        assert!(ascii.contains("Apache 2.4.41"));
        assert!(ascii.contains("/search?q=test"));
        assert!(ascii.contains("parameter q"));
    }
}
