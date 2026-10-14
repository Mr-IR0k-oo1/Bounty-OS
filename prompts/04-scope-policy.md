# Bounty OS — Stage 04: Scope and Policy Engine

Implement the security-critical scope and policy boundary.

## Goal
No active security operation should execute unless Bounty OS determines that the requested target is allowed.

## Scope
Support domains, subdomains, IP addresses, CIDR ranges, URL patterns, excluded assets, excluded paths, protocol restrictions, and rate limits.

## Requirements
1. Scope checks happen before tool execution.
2. Denied requests must not execute.
3. Scope decisions must be auditable.
4. Matching logic must have deterministic tests.
5. Exclusions take precedence over broad inclusions.
6. Never trust model-generated scope decisions.
7. Do not implement bypass mechanisms.

## Tests
Test exact domains, subdomains, unrelated domains, IPs, CIDRs, exclusions, excluded paths, protocol restrictions, malformed targets, ambiguous targets, and denied requests.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: implement scope and policy engine"
```
Do not continue until the commit succeeds.
