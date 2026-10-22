# Bounty OS v0.4 — Empirical Intelligence Experiment Framework

This directory houses the empirical benchmark suite and experimental comparisons designed to measure whether the Bounty OS Intelligence Engine improves investigation outcomes compared to fixed pipelines and static planners.

```text
experiments/
├── action_order/      # Action sequencing & priority permutation analyses
├── scoring/           # Bayesian shrinkage parameters (K prior weights, feature weights)
├── stopping/          # Stopping checker efficiency & early saturation thresholds
├── coverage/          # Attack surface coverage velocity and discovery delta logs
├── benchmarks/        # Automated comparative benchmark runners
└── reports/           # Automated JSON & Markdown trial evaluation reports
```

## Evaluated Strategies

### Strategy A: Fixed Linear Pipeline
Standard predefined sequence:
$$\text{subfinder} \rightarrow \text{naabu} \rightarrow \text{httpx} \rightarrow \text{katana} \rightarrow \text{nuclei}$$
Blindly executes all tools regardless of attack surface feedback, wasting cycles on empty assets and failing to adapt to reflected parameters or discovered services.

### Strategy B: Deterministic Intelligence Planner (v0.2 / v0.3)
Generates and scores candidate actions based on rule-prior deterministic formula:
$$\text{Score}(A) = \frac{IG(A) \times R(A) \times C(A)}{\text{Cost}(A) + \text{Risk}(A)}$$
Dynamically adapts to observations, enforces budget and scope gates, avoids redundant scans, but relies on static human-tuned heuristics.

### Strategy C: Empirical Adaptive Planner (v0.4)
Scores candidate actions using empirical Bayesian action-value estimation:
$$V(a) = \frac{w_1(\text{new attack surface}) + w_2(\text{new findings}) + w_3(\text{confirmed findings}) + w_4(\text{coverage improvement})}{\text{time} + \text{resource cost} + \text{risk}}$$
$$\hat{V}(a) = \frac{K \cdot \text{Score}_{prior} + N \cdot \bar{V}_{tool}}{K + N}$$
Penalizes historically unproductive tools (e.g., zero-yield archive lookups on isolated targets) and accelerates high-yield discovery and verification probes.

## Measured Comparative Metrics
1. **Confirmed Findings Yield**: Verified, reproducible vulnerabilities discovered
2. **Unique Attack Surface Discoveries**: Subdomains, ports, services, endpoints, parameters, and technologies
3. **Time to First Useful Finding (TTFF)**: Elapsed execution time until initial vulnerability identification
4. **Total Execution Time**: Total runtime across the entire investigation
5. **Tool Execution Count**: Number of processes launched
6. **False Positive Rate**: Unverified or fabricated candidate findings
7. **Redundant Execution Rate**: Tools executed without discovering new attack surface
8. **Attack Surface Coverage**: Completeness of service and endpoint discovery (%)
