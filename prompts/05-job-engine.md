# Bounty OS — Stage 05: Job Engine

Implement the Bounty OS job/state engine.

## Required job categories
- recon
- tool execution
- analysis
- validation
- evidence processing
- reporting

## Job states
QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED, TIMEOUT

## Requirements
Implement job creation, state transitions, cancellation, failure handling, retry representation, timestamps, structured errors, and parent/child relationships where useful.

Do not build a complicated distributed scheduler yet. A reliable local worker model is sufficient for v1.

Use the project's async conventions. Avoid shared mutable global state.

## Tests
Test valid/invalid transitions, cancellation, failure, timeout, retry behavior, and concurrent job handling.

Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

Then:
```bash
git add .
git commit -m "feat: implement bounty os job engine"
```
Do not continue until the commit succeeds.
