# Bounty OS — Stage 03: Domain Models

Implement the core Bounty OS domain models.

## Required concepts
- Program
- Scope
- Target
- Asset
- Endpoint
- Parameter
- Job
- Finding
- Evidence
- Report

Use existing project conventions.

## Requirements
Models should have stable identifiers, timestamps where appropriate, explicit status where appropriate, serialization support where required, and validation where required.

Finding lifecycle:
DISCOVERED → CANDIDATE → EVIDENCE_REQUIRED → VALIDATING → CONFIRMED/REJECTED → REPORT_READY → REVIEWED → EXPORTED

Evidence is first-class data and may reference requests, responses, screenshots, tool outputs, validation results, and artifacts. Large binary data should not be stored directly in ordinary relational rows.

## Tests
Test status transitions, model validation, serialization/deserialization, and invalid states.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: add bounty os domain models"
```
Do not continue until the commit succeeds.
