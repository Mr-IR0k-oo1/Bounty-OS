# Bounty OS — Stage 07: Recon Pipeline

Implement the first end-to-end reconnaissance workflow.

## Pipeline
Target → scope check → subdomain discovery → DNS resolution → HTTP probing → asset normalization → persistence

## Requirements
1. Every operation has a job.
2. Every active operation passes scope validation.
3. Tool results are normalized.
4. Duplicate assets are deduplicated.
5. Provenance is retained.
6. Failures are visible.
7. Partial results are preserved where practical.
8. Never scan arbitrary targets, bypass scope, fabricate results, or silently swallow failures.

## Asset provenance
Record source tool, source job, parent asset when known, first seen, and last seen.

## Tests
Create fixture-based parser tests and a complete mocked pipeline test.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: implement initial recon pipeline"
```
Do not continue until the commit succeeds.
