# Bounty OS — Stage 01: Repository Audit

Inspect the existing Bounty OS repository before making changes.

## Requirements
1. Inspect repository structure, Rust code, frontend, configuration, database, tests, build system, security tooling, and documentation.
2. Identify what works, what is incomplete, duplicate implementations, dead code, architectural conflicts, and missing foundations.
3. Do NOT rewrite working code or introduce unnecessary dependencies.
4. Do NOT create fake implementations.
5. Produce a concise `ARCHITECTURE.md` describing the actual repository.
6. Adapt to the existing implementation where reasonable.
7. Run the existing build and test commands.
8. Fix only problems that prevent building/testing.

## Definition of Done
- Repository inspected.
- Architecture documented.
- Build/test state known.
- Repository remains buildable.

## Mandatory final step
Run:
```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```
Use appropriate existing commands if this is not currently a Cargo workspace.

Only after successful checks:
```bash
git add .
git commit -m "chore: audit bounty os repository"
```
Do not continue until the commit succeeds.
