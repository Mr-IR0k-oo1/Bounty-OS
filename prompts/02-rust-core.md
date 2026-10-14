# Bounty OS — Stage 02: Rust Core

Build the foundational Rust compute-engine structure based on the repository audit.

## Goal
Create the minimum clean foundation for the Bounty OS computation engine.

The engine must eventually coordinate scope, jobs, tools, assets, findings, evidence, validation, reporting, and model calls.

## Requirements
1. Preserve existing working architecture.
2. Establish clear boundaries between engine, scope/policy, jobs, tools, assets, findings, evidence, validation, and model gateway.
3. Define shared error handling, identifiers where appropriate, configuration handling, and logging/tracing.
4. Keep interfaces small and strongly typed.
5. Avoid premature plugin frameworks and unnecessary abstraction.
6. The Rust core must never assume an LLM is trusted.
7. Do not implement unrestricted shell execution.

## Definition of Done
The Rust core compiles and is ready for domain models.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: establish bounty os rust core"
```
Do not continue until the commit succeeds.
