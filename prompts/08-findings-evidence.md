# Bounty OS — Stage 08: Findings and Evidence

Implement the candidate finding and evidence system.

## Goal
Separate hypotheses from confirmed vulnerabilities. A model observation must never automatically become a confirmed finding.

## Candidate finding
Support vulnerability class, target, endpoint, hypothesis, confidence, proposed validation, required evidence, source model run, and creation time.

## Evidence
Support HTTP request, HTTP response, headers, payload, screenshot, DOM snapshot, tool output, and validation result. Store large artifacts outside ordinary relational rows.

## Evidence integrity
Where appropriate record content hash, timestamp, source, and relationship to the finding.

## Finding lifecycle
DISCOVERED → CANDIDATE → EVIDENCE_REQUIRED → VALIDATING → CONFIRMED/REJECTED → REPORT_READY → REVIEWED → EXPORTED

Reject invalid transitions.

## Tests
Test candidate creation, evidence attachment, evidence integrity, state transitions, rejection, confirmation, and invalid transitions.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: implement findings and evidence engine"
```
Do not continue until the commit succeeds.
