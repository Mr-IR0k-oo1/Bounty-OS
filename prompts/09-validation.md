# Bounty OS — Stage 09: Validation Engine

Implement validation orchestration.

## Goal
Turn candidate findings into confirmed or rejected findings based on evidence.

## Architecture
Candidate → validation plan → scope/policy check → controlled test → evidence → validation result → finding state transition

## Requirements
1. Validation is explicit, scoped, and auditable.
2. Evidence is attached to results.
3. Failed validation cannot become a confirmed finding.
4. Insufficient evidence remains unresolved.
5. Prefer deterministic checks over LLM judgment.
6. VulnLLM-R-7B may propose validation hypotheses, steps, and expected evidence, but cannot bypass policy.

## Tests
Test successful validation, failed validation, insufficient evidence, out-of-scope validation, invalid transitions, and evidence requirements.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: implement finding validation engine"
```
Do not continue until the commit succeeds.
