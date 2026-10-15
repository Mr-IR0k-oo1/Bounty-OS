# Bounty OS — System Architecture & Repository Audit

## 1. Overview
Bounty OS is a self-hosted bug bounty program management and reconnaissance orchestration platform.
The repository coordinates target discovery, scope validation, tool execution, job management, candidate findings, evidence recording, and verification reports.

## 2. Workspace & Crate Structure
The Cargo workspace comprises four member crates:

1. **`crates/bountyos-common`**
   - Core shared data contracts, enums, and types (`Severity`, `Platform`, `JobStatus`, `FindingStatus`, `ProjectStatus`, `ScopeType`, `ScanStage`, `SecurityFinding`).
   - Serialization / deserialization via `serde` and UUID/chrono support.

2. **`crates/bountyos-server`**
   - Web application backend built on `axum 0.7`, `tokio`, `sqlx 0.7` (PostgreSQL), and `redis 0.24`.
   - Modules:
     - `app`: Router composition and middleware registration.
     - `auth`: Local credentials, Argon2 password hashing, JWT token lifecycle, TOTP 2FA.
     - `db`: Connection pooling and SQLx migrations.
     - `handlers`: REST API endpoints for projects, programs, scopes, jobs, findings, assets, and reports.
     - `llm`: Client and prompt contracts for local Ollama / VulnLLM-R-7B model gateway.
     - `pipeline`: Recon orchestration, security tool discovery (`ToolRegistry`), scope enforcement, subfinder executor, queue, and scheduler.

3. **`crates/bountyos-analyzer`**
   - Security analysis engine combining AST parsing (`tree-sitter` for C) and LLM correlation.
   - Detects buffer overflows, format string vulnerabilities, command injection, and use-after-free/double-free memory bugs.

4. **`crates/bountyos-cli`**
   - Command-line interface (`bountyos`) providing command sets for authentication, program management, scope inspection, and job control.

5. **`frontend/`**
   - Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui components.

## 3. Tool Orchestration & Execution Boundary
- Tools are executed using structured argument arrays via `tokio::process::Command` without invoking arbitrary shell strings.
- Executables are detected dynamically via `ToolRegistry::find_tool_path` verifying standard system paths, host `PATH`, and environment overrides.
- Subfinder execution streams output to WebSocket subscribers and writes evidence files to the storage layer.

## 4. Current State & Working Features
- Workspace compiles and runs tests cleanly with the Rust GNU toolchain on Windows and POSIX.
- Unit and integration tests cover auth tokens, scope checking (domain, wildcard, CIDR), subfinder parser/executor (including mock scripts and timeout handling), and AST/LLM analyzers (100% test pass rate).

## 5. Areas for Modular Enhancement
- **Domain Models**: Standardize models for `Program`, `Scope`, `Target`, `Asset`, `Endpoint`, `Parameter`, `Job`, `Finding`, `Evidence`, and `Report` with strict lifecycle states.
- **Scope & Policy Engine**: Unify pre-execution scope checks covering domains, IPs, CIDRs, URL patterns, excluded assets, and protocol policies.
- **Job Engine**: Implement categorical job tracking (`recon`, `tool execution`, `analysis`, `validation`, `evidence processing`, `reporting`) with explicit state transitions.
- **Tool Runner**: Implement unified typed adapters for `subfinder`, `dnsx`, `httpx`, `naabu`, `nmap`, `katana`, `gau`, `waybackurls`, `ffuf`, and `nuclei`.
- **Validation Engine**: Controlled evidence-backed verification orchestrator separating hypotheses from confirmed findings.
