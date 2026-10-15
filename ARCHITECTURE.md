# Bounty OS — Architecture & Repository Audit

## 1. Executive Summary
Bounty OS is a self-hosted bug bounty program management, reconnaissance orchestration, and vulnerability verification platform.
It combines a Rust backend workspace, a Next.js 14 frontend, local LLM/AST triage, and security tool subprocess execution.

---

## 2. Workspace & Crate Structure

The repository is organized as a Cargo workspace with four member crates:

```
Bounty-OS/
├── crates/
│   ├── bountyos-common/     # Domain models, scope engine, job engine, tool runner, validation engine
│   ├── bountyos-server/     # Axum 0.7 REST API, JWT/TOTP auth, SQLx/PostgreSQL, Redis, LLM triage
│   ├── bountyos-analyzer/   # Static AST analysis (Tree-sitter C) and LLM vulnerability correlator
│   └── bountyos-cli/        # Command-line interface for platform interaction
├── frontend/                # Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
├── scripts/                 # Security tool wrappers (subfinder, naabu, httpx, nuclei, etc.)
├── nginx/                   # Reverse proxy configuration
└── docker-compose.yml       # Production and dev container orchestration
```

### Crate Breakdown

1. **`crates/bountyos-common`**
   - Core domain types and enums (`Severity`, `Platform`, `JobStatus`, `FindingStatus`, `ProjectStatus`, `ScopeType`, `ScanStage`).
   - Domain models: `Program`, `Scope`, `Target`, `Asset`, `Job`, `Finding`, `Evidence`, and `ValidationReport`.
   - Security engines:
     - `scope`: Declarative scope validation supporting domains, wildcards, CIDRs, IPs, path exclusions, and protocol restrictions.
     - `tool_runner`: Shell-injection-safe command builder for subprocess execution.
     - `job_engine`: Job state transitions, retries, cancellation, and concurrency control.
     - `findings_engine`: Finding lifecycle management, state transitions, and evidence integrity hashing (SHA-256).
     - `validation_engine`: Verifier that tests hypotheses without allowing unverified claims to become confirmed findings.
     - `model_gateway`: Sanitized LLM response parser (strips code fences, validates JSON).

2. **`crates/bountyos-server`**
   - Web application backend built on `axum 0.7`, `tokio`, `sqlx 0.7` (PostgreSQL), and `redis 0.24`.
   - Modules:
     - `auth`: Password hashing (Argon2id), JWT issuance/verification, TOTP 2FA.
     - `db`: PostgreSQL connection pool management and migration runner.
     - `handlers`: REST endpoints for hunters, projects, programs, scopes, jobs, subdomains, ports, URLs, findings, alerts, and reports.
     - `pipeline`: Orchestration layer containing `ToolRegistry`, queue, scheduler, scope enforcement, and tool output parsers (`subfinder`, `httpx`, `naabu`, `nmap`, `nuclei`, `gau`).
     - `llm`: Client and triage integration with Ollama / VulnLLM.

3. **`crates/bountyos-analyzer`**
   - Vulnerability detection engine combining AST static analysis and LLM correlation.
   - Analyzers for C code using `tree-sitter`: buffer overflows, format string vulnerabilities, command injection, and use-after-free / double-free memory safety defects.
   - Correlator reconciling AST findings with LLM analysis output.

4. **`crates/bountyos-cli`**
   - CLI tool (`bountyos`) providing command groups: `auth`, `projects`, `programs`, `scope`, `scan`, `jobs`, `findings`, and `monitor`.

5. **`frontend/`**
   - Next.js 14 App Router with TypeScript and Tailwind CSS.
   - Comprehensive UI: Dashboard, Project Kanban/Timeline, Recon views (LiveLog, PortMap, SubdomainTable, UrlTable), Findings triage, and Report Builder.

---

## 3. Database & Storage Architecture

- **PostgreSQL**: Managed via SQLx with 12 sequential migrations (`001_hunters.sql` through `012_llm_triage.sql`).
- **Redis**: Asynchronous task queue (`scan_queue`), rate limiting, and real-time state.
- **Evidence Storage**: Local filesystem directory (`evidence/`) for storing raw tool outputs, normalized JSONL, and validation artifacts.

---

## 4. Current State & Verification

- **Cargo Workspace Build**: Compiles cleanly (`cargo check --workspace` passes).
- **Test Suite**: 89 passing unit and integration tests across all workspace crates (0 failed, 0 ignored):
  - `bountyos-analyzer`: 16 tests (AST rules, correlator, benchmarks).
  - `bountyos-common`: 45 tests (scope enforcement, model lifecycle, tool runner injection safety, job engine, validation engine, full end-to-end integration flow).
  - `bountyos-server`: 31 tests (auth tokens, middleware, subfinder parser/executor, scope checks).
- **Clippy**: Workspace lints succeed.
- **Toolchain**: Verified on `x86_64-pc-windows-gnu` with LLVM-MinGW GCC and on Linux container targets.

---

## 5. Audit Findings: Gaps, Duplications & Dead Code

1. **Dead Code in Pipeline Parsers**:
   - `crates/bountyos-server/src/pipeline/parsers/` (`gau`, `httpx`, `naabu`, `nmap`, `nuclei`, `subfinder`) and `queue.rs` contain functions and error enums flagged as dead code because the HTTP handlers currently only invoke `subfinder` directly rather than through a generalized dispatcher.
2. **Model Layer Separation**:
   - `bountyos-server` has SQLx-tied models in `src/models/` while `bountyos-common` provides generic domain entities in `src/models.rs`. The server handlers largely query the database directly using ad-hoc row structs rather than transforming to/from common domain models.
3. **Upstream Compatibility Warning**:
   - `sqlx-postgres v0.7.4` emits a future-incompatibility warning with future Rust compiler editions (will require updating SQLx when moving to newer minor versions).
4. **Tool Runner Unification**:
   - `bountyos-common::tool_runner` contains safe command construction abstractions, whereas `bountyos-server::pipeline::subfinder` implements its own custom execution wrapper. Unifying tool execution around the common runner will improve maintainability.
