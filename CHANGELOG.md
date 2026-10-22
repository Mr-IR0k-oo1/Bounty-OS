# Changelog

All notable changes to Bounty OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.0] - 2026-10-22

### Added
- **Target Archetype Classifier (`archetype.rs`)**: Dynamically infers target class (`web_legacy`, `web_modern`, `rest_api`, `graphql_api`, `spa`, `static_site`, `auth_boundary`, `multi_host`, `unknown`) from observed HTTP evidence, headers, and body structures rather than hostnames.
- **Global Experience Store (`experience.rs`)**: Persistent PostgreSQL memory bank (`experience_actions`) storing conditional empirical tool values $V(a \mid \text{archetype}, \text{technology})$.
- **Online Bayesian Running Average Estimator**: Continuous mathematical update $V_{\text{new}} = \frac{n \cdot V_{\text{old}} + V_{\text{observation}}}{n + 1}$ with zero-hallucination statistical learning.
- **Cross-Run Waste Pruning Safeguards**: Minimum sample size protection thresholds ($n < 10 \implies$ protected against pruning; $10 \le n < 30 \implies$ mild penalty; $n \ge 30 \implies$ eligible for pruning).
- **Exploration vs. Exploitation ($\epsilon$-Greedy)**: Integrated $\epsilon = 0.15$ exploration safeguard with uncertainty bonuses $\frac{c}{\sqrt{n}}$ preventing permanent disabling of tools from small sample anomalies.
- **Auditable Experience Provenance (`experience_provenance`)**: Full provenance chain linking learned action values to investigation IDs, action IDs, outcome IDs, and raw evidence.
- **MCP Intelligence Tools**: Added `experience.actions`, `experience.provenance`, and `investigation.archetype`.
- **4-Strategy Benchmark (A / B / C / D)**: Validated on real lab targets; Strategy D demonstrated a 5.3% reduction in TTFF and an 8.1% reduction in normalized compute cost over VulnLLM alone.

---

## [0.5.0] - 2026-10-22

### Added
- **Strategic VulnLLM Layer (`intelligence/llm/`)**: Shifted LLM from passive finding analyzer to active strategic reasoning engine.
- **Attack Surface Graph Prompt Context (`context.rs`)**: Structured prompt serialization condensing topology, findings, and empirical tool values into actionable context.
- **Stateful Security Hypotheses (`015_security_hypotheses.sql`)**: Database table and model tracking actionable attack hypotheses, falsification criteria, and required verification tools.
- **Strict Programmatic Validation (`validation.rs`)**: Hallucination firewall validating LLM recommendations against attack surface state, target scope, and valid tool adapters.
- **Strategy C Benchmark**: Evaluated VulnLLM against deterministic planner, proving improved targeted prioritization.

---

## [0.4.0] - 2026-10-22

### Added
- **Action Outcomes Telemetry (`014_action_outcomes.sql`)**: Granular outcome recording tracking execution time, assets discovered, endpoints found, findings confirmed, and compute cost.
- **Empirical Action-Value Model ($V(a)$)**: Computes multi-factor utility scores balancing discovery yield against resource expenditure.
- **Observation Diffing Engine (`observations.rs`)**: Structured pre/post execution diff analysis capturing state mutations.
- **Adaptive Scoring**: Planner dynamically updates action prior weights based on real observed tool yield.

---

## [0.3.0] - 2026-10-22

### Added
- **Autonomous Closed-Loop Runner (`runner.rs`)**: Implemented autonomous planning lifecycle: plan $\to$ execute $\to$ observe $\to$ update $\to$ re-plan.
- **Action Lifecycle Persistence (`013_investigation_actions.sql`)**: Persistent tracking of planned, executing, completed, and failed investigation actions.
- **Managed Tool Execution Improvements**: Safety timeouts (15s), container network DNS resolution, and execution error recovery.
- **Autonomous Lab Suite**: End-to-end verification of hands-off autonomous execution against vulnerable targets.

---

## [0.2.0] - 2026-10-22

### Added
- **Attack Surface Graph (`graph.rs`)**: Directed graph data structure modeling domains, subdomains, IP addresses, ports, HTTP endpoints, parameters, and vulnerabilities.
- **Graph Coverage & Phase Transitions (`coverage.rs`)**: Quantifies exploration progress and guides investigations across reconnaissance, discovery, and exploitation phases.
- **Deterministic Action Scoring (`scoring.rs`)**: Multi-dimensional candidate action scoring based on information gain, relevance, confidence, and risk.
- **Entropy & Uncertainty Metrics (`uncertainty.rs`)**: Shannon entropy calculations measuring uncertainty across unexplored nodes.
- **Resource Budgeting & Stopping Conditions (`budgets.rs`, `stopping.rs`)**: Hard and soft budget limits with automatic termination upon diminishing returns.

---

## [0.1.0] - 2026-10-21

### Added
- Initial Bounty OS platform architecture with Axum web server, Next.js frontend, and PostgreSQL/Redis backend.
- Managed security tool orchestration (Naabu, Subfinder, Katana, Nuclei, Dalfox, GAU, Waybackurls, FFuf).
- Scope enforcement engine ensuring zero out-of-scope executions.
- Cryptographic evidence collection and reproducible verification pipeline.
- Model Context Protocol (MCP) server for agentic interaction.
