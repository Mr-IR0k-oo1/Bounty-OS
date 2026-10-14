# Bounty OS — Stage 10: API and End-to-End Integration

Connect the implemented Bounty OS components into a usable vertical slice.

## Required workflow
Program → Scope → Target → Recon Job → Assets → Candidate Finding → Evidence → Validation → Confirmed Finding → Report

## API
Support, at minimum:
- create program
- create scope
- create target
- start recon
- inspect job
- list assets
- inspect asset
- list findings
- inspect finding
- attach evidence
- start validation
- inspect validation
- generate report

Follow existing API conventions.

## Model Gateway
Create an integration boundary for Ollama and VulnLLM-R-7B. Do not hard-code one model into business logic. Parse model output into typed structures and fail safely on invalid output.

## End-to-end test
Using controlled mock/fixed tool results, verify:
1. target accepted
2. scope enforced
3. recon job created
4. assets produced
5. candidate finding created
6. evidence attached
7. validation runs
8. finding becomes CONFIRMED only when validation succeeds
9. report generated

## Final quality gate
Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```
Also run existing frontend checks if present. Fix failures caused by your changes. Inspect the final git diff. Do not claim functionality that was not tested.

Then:
```bash
git add .
git commit -m "feat: integrate bounty os end to end"
```

Do not continue beyond this stage unless explicitly instructed.
