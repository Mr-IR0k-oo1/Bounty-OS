# BountyOS v3.0 — FINAL LOCKED ARCHITECTURE
# Rust Backend | Bash Tool Orchestration | Next.js UI
# Project-based Management | CLI + Web | Local Accounts

============================================================
## LOCKED DECISIONS SUMMARY
============================================================

Backend:          Rust (Axum)
Tool calling:     Bash scripts (one per tool, spawned by Rust)
Frontend:         Next.js 14 — primary interface for everything
Auth:             Local accounts, argon2, JWT, TOTP 2FA
Chat panel:       Smart template engine — no external LLM API
Interface:        Web UI + CLI (bountyos command)
Management:       Project → Program → Targets → Findings hierarchy
Infrastructure:   Docker Compose, fully local, no cloud dependency

============================================================
## TECH STACK
============================================================

BACKEND (Rust)
  Framework:      Axum 0.7
  DB queries:     SQLx (async, compile-time checked, no ORM magic)
  Migrations:     SQLx migrate (embedded in binary)
  Auth:           argon2 + jsonwebtoken + totp-rs + rand
  WebSockets:     Axum native WebSockets (tokio-tungstenite)
  Session store:  Redis via deadpool-redis
  Rate limiting:  tower-governor
  Serialization:  serde + serde_json
  Config:         config crate (config.toml)
  Logging:        tracing + tracing-subscriber
  HTTP client:    reqwest (crt.sh API, webhook delivery)
  Runtime:        Tokio

TOOL ORCHESTRATION (Bash)
  One .sh script per tool
  Rust spawns scripts via tokio::process::Command
  Scripts write JSONL to stdout → Rust parsers → PostgreSQL
  Scripts write human-readable logs to stderr → WebSocket → UI
  Scripts are standalone — debuggable without the web UI
  Shared lib: scripts/lib/common.sh (log helpers, tool checks)

FRONTEND (Next.js)
  Framework:      Next.js 14 App Router
  Language:       TypeScript strict mode
  Styling:        Tailwind CSS + CSS variables (design tokens)
  Components:     shadcn/ui (radix-ui primitives)
  State:          Zustand (client) + TanStack Query (server)
  Charts:         Recharts
  Code/diff:      Monaco Editor (request/response, markdown)
  Terminal:       xterm.js (WebSocket log stream)
  Icons:          Lucide React
  Animations:     Framer Motion (subtle only)
  Markdown:       react-markdown + remark-gfm

DATABASE:         PostgreSQL 15
CACHE/SESSIONS:   Redis 7
CLI:              Rust (same workspace, bountyos-cli crate)
                  clap (args) + colored + tabled (output) + reqwest

============================================================
## PROJECT MANAGEMENT HIERARCHY
============================================================

PROJECT
  Top-level container. Groups related programs together.
  Examples:
    "H1 Private Programs — Q1 2025"
    "Client Pentest — Acme Corp"
    "Personal Continuous Bug Bounty"
    "Synack Red Team — March"

  Each project has:
    - Name, description, status (active/archived)
    - Start date, end date
    - Shared markdown notes (methodology, scope decisions)
    - Timeline view (all events across programs)
    - Team assignment (which hunters work this project)
    - Stats rollup across all programs

  └── PROGRAM (belongs to one project)
        e.g. "Uber — HackerOne", "Grab — Bugcrowd"

        Each program has:
          - Platform label (H1/Bugcrowd/Intigriti/Synack/Other)
          - Scope targets (in/out of scope)
          - Active scanning approval gate
          - Rescan interval
          - Bounty range

        └── SCOPE TARGETS
        └── SUBDOMAINS + PORTS + URLs
        └── FINDINGS
        └── REPORTS

============================================================
## FULL DIRECTORY STRUCTURE
============================================================

bountyos/
│
├── Cargo.toml                         ← workspace root
├── Cargo.lock
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
├── .env.example
├── README.md
│
├── crates/
│   │
│   ├── bountyos-common/               ← shared types (api + cli)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── types.rs               ← DTOs, enums, shared structs
│   │
│   ├── bountyos-api/                  ← Axum web server
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.rs                ← server startup, router mount
│   │       ├── config.rs              ← config.toml loader
│   │       ├── state.rs               ← AppState (db pool, redis, config)
│   │       ├── errors.rs              ← AppError → HTTP responses
│   │       │
│   │       ├── middleware/
│   │       │   ├── mod.rs
│   │       │   ├── auth.rs            ← JWT extraction + role check
│   │       │   ├── rate_limit.rs      ← tower-governor per-endpoint
│   │       │   └── audit.rs          ← log every action to audit_log
│   │       │
│   │       ├── routes/
│   │       │   ├── mod.rs             ← assemble all routers
│   │       │   ├── auth.rs
│   │       │   ├── projects.rs
│   │       │   ├── programs.rs
│   │       │   ├── scope.rs
│   │       │   ├── subdomains.rs
│   │       │   ├── ports.rs
│   │       │   ├── urls.rs
│   │       │   ├── findings.rs
│   │       │   ├── hunters.rs
│   │       │   ├── jobs.rs
│   │       │   ├── reports.rs
│   │       │   ├── settings.rs
│   │       │   ├── tokens.rs
│   │       │   └── ws.rs              ← WebSocket: /ws/jobs/:id
│   │       │
│   │       ├── handlers/              ← business logic
│   │       │   ├── auth.rs
│   │       │   ├── projects.rs
│   │       │   ├── programs.rs
│   │       │   ├── findings.rs
│   │       │   ├── jobs.rs
│   │       │   └── reports.rs
│   │       │
│   │       ├── models/                ← SQLx FromRow structs
│   │       │   ├── project.rs
│   │       │   ├── program.rs
│   │       │   ├── scope.rs
│   │       │   ├── subdomain.rs
│   │       │   ├── port.rs
│   │       │   ├── url.rs
│   │       │   ├── finding.rs
│   │       │   ├── hunter.rs
│   │       │   ├── job.rs
│   │       │   └── audit.rs
│   │       │
│   │       ├── pipeline/
│   │       │   ├── mod.rs
│   │       │   ├── runner.rs          ← spawn bash, stream stderr→WS
│   │       │   ├── queue.rs           ← Redis-backed job queue
│   │       │   ├── scheduler.rs       ← tokio interval rescan tasks
│   │       │   ├── scope_check.rs     ← OOS enforcement
│   │       │   └── parsers/
│   │       │       ├── mod.rs
│   │       │       ├── nuclei.rs
│   │       │       ├── httpx.rs
│   │       │       ├── naabu.rs
│   │       │       ├── subfinder.rs
│   │       │       ├── gau.rs
│   │       │       └── nmap.rs
│   │       │
│   │       ├── alerts/
│   │       │   ├── mod.rs
│   │       │   ├── discord.rs
│   │       │   ├── slack.rs
│   │       │   └── email.rs
│   │       │
│   │       └── db/
│   │           ├── mod.rs
│   │           └── migrations/
│   │               ├── 001_hunters.sql
│   │               ├── 002_projects.sql
│   │               ├── 003_programs.sql
│   │               ├── 004_scope.sql
│   │               ├── 005_subdomains.sql
│   │               ├── 006_ports_urls.sql
│   │               ├── 007_findings.sql
│   │               ├── 008_jobs.sql
│   │               ├── 009_alerts.sql
│   │               ├── 010_tokens.sql
│   │               └── 011_audit.sql
│   │
│   └── bountyos-cli/                  ← CLI binary
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs                ← clap command tree
│           ├── config.rs              ← ~/.bountyos/config.toml
│           ├── client.rs             ← reqwest API client
│           ├── output.rs             ← tabled + colored formatting
│           └── commands/
│               ├── auth.rs
│               ├── projects.rs
│               ├── programs.rs
│               ├── scope.rs
│               ├── scan.rs
│               ├── findings.rs
│               ├── jobs.rs
│               └── monitor.rs
│
├── scripts/                           ← Bash tool scripts
│   ├── lib/
│   │   ├── common.sh                  ← log_info, check_tool, emit_json
│   │   ├── scope_check.sh             ← OOS guard (called by active scripts)
│   │   └── output.sh                  ← JSONL formatting helpers
│   │
│   ├── stage1_passive/
│   │   ├── run_subfinder.sh
│   │   ├── run_amass.sh
│   │   ├── run_assetfinder.sh
│   │   ├── run_crtsh.sh               ← curl crt.sh → JSONL
│   │   ├── run_gau.sh
│   │   ├── run_waybackurls.sh
│   │   └── run_trufflehog.sh
│   │
│   ├── stage2_validate/
│   │   ├── run_httpx.sh
│   │   ├── run_naabu.sh
│   │   ├── run_gowitness.sh
│   │   └── run_katana_passive.sh
│   │
│   ├── stage3_active/                 ← requires active_approved=true
│   │   ├── run_ffuf.sh
│   │   ├── run_katana_active.sh
│   │   ├── run_arjun.sh
│   │   ├── run_nmap.sh
│   │   └── run_kiterunner.sh
│   │
│   ├── stage4_vuln/
│   │   ├── run_nuclei.sh
│   │   ├── run_nuclei_tech.sh
│   │   ├── run_wpscan.sh
│   │   ├── run_testssl.sh
│   │   └── run_subjack.sh
│   │
│   └── monitor/
│       └── run_monitor.sh
│
├── frontend/                          ← Next.js 14
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   │
│   ├── app/
│   │   ├── layout.tsx                 ← root layout
│   │   ├── page.tsx                   ← redirect → /dashboard
│   │   ├── globals.css                ← design tokens, base styles
│   │   │
│   │   ├── (auth)/                    ← public routes
│   │   │   ├── login/page.tsx
│   │   │   ├── setup/page.tsx         ← first-run wizard
│   │   │   └── 2fa/page.tsx
│   │   │
│   │   └── (app)/                     ← protected routes
│   │       ├── layout.tsx             ← sidebar + topbar + panel
│   │       ├── dashboard/page.tsx
│   │       │
│   │       ├── projects/
│   │       │   ├── page.tsx
│   │       │   └── [id]/
│   │       │       ├── page.tsx       ← overview
│   │       │       ├── programs/page.tsx
│   │       │       ├── notes/page.tsx
│   │       │       ├── timeline/page.tsx
│   │       │       └── team/page.tsx
│   │       │
│   │       ├── programs/
│   │       │   ├── page.tsx
│   │       │   └── [id]/
│   │       │       ├── page.tsx       ← overview
│   │       │       ├── scope/page.tsx
│   │       │       ├── recon/page.tsx
│   │       │       ├── findings/page.tsx
│   │       │       └── reports/page.tsx
│   │       │
│   │       ├── findings/
│   │       │   ├── page.tsx           ← global cross-project
│   │       │   └── [id]/page.tsx      ← detail + report builder
│   │       │
│   │       ├── gallery/page.tsx
│   │       ├── jobs/page.tsx
│   │       ├── hunters/page.tsx       ← admin only
│   │       │
│   │       └── settings/
│   │           ├── page.tsx
│   │           ├── tools/page.tsx
│   │           ├── wordlists/page.tsx
│   │           ├── alerts/page.tsx
│   │           ├── schedule/page.tsx
│   │           ├── tokens/page.tsx    ← CLI API token management
│   │           └── security/page.tsx  ← 2FA, password, sessions
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── AssistantPanel.tsx     ← right panel, template engine
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   ├── ProjectTimeline.tsx
│   │   │   └── ProjectNotes.tsx       ← Monaco markdown editor
│   │   │
│   │   ├── programs/
│   │   │   ├── ProgramCard.tsx
│   │   │   ├── ProgramForm.tsx
│   │   │   ├── ScopeEditor.tsx
│   │   │   ├── ApprovalGateBanner.tsx
│   │   │   └── PipelineStatus.tsx
│   │   │
│   │   ├── findings/
│   │   │   ├── FindingsTable.tsx
│   │   │   ├── FindingDetail.tsx
│   │   │   ├── EvidenceViewer.tsx
│   │   │   ├── SeverityBadge.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── CvssCalculator.tsx
│   │   │
│   │   ├── recon/
│   │   │   ├── SubdomainTable.tsx
│   │   │   ├── PortMap.tsx
│   │   │   ├── LiveLog.tsx            ← xterm.js + WebSocket
│   │   │   ├── ScreenshotGrid.tsx
│   │   │   └── UrlTable.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportBuilder.tsx
│   │   │   └── ReportPreview.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsRow.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── ActiveJobs.tsx
│   │   │   └── SeverityChart.tsx
│   │   │
│   │   └── ui/                        ← shadcn + custom components
│   │       ├── terminal.tsx
│   │       ├── code-block.tsx
│   │       └── markdown-editor.tsx
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   │
│   └── hooks/
│       ├── useAuth.ts
│       ├── useProjects.ts
│       ├── usePrograms.ts
│       ├── useFindings.ts
│       └── useWebSocket.ts
│
├── evidence/                          ← bind mounted raw tool output
│   └── {project_slug}/
│       └── {program_slug}/
│           └── {subdomain}/
│               ├── stage1_passive/
│               ├── stage2_validate/
│               ├── stage3_active/
│               ├── stage4_vuln/
│               ├── screenshots/
│               └── reports/
│
├── config/
│   └── config.toml
│
├── nginx/
│   ├── nginx.conf
│   └── ssl/                           ← auto-generated self-signed certs
│
└── logs/
    ├── pipeline.log
    └── audit.log

============================================================
## DATABASE SCHEMA
============================================================

-- Hunters (users)
CREATE TABLE hunters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'hunter', -- admin | hunter
    password_hash   TEXT NOT NULL,                  -- argon2
    totp_secret     TEXT,
    totp_enabled    BOOLEAN DEFAULT FALSE,
    discord_webhook TEXT,
    slack_webhook   TEXT,
    email           TEXT,
    active          BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_by      UUID REFERENCES hunters(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- API tokens for CLI
CREATE TABLE api_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunter_id   UUID REFERENCES hunters(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    token_hash  TEXT UNIQUE NOT NULL,   -- SHA256 of token
    last_used   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,            -- NULL = never expires
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Session blacklist (invalidated JWTs)
CREATE TABLE session_blacklist (
    jti         TEXT PRIMARY KEY,       -- JWT ID
    expires_at  TIMESTAMPTZ NOT NULL
);

-- Projects
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active',  -- active | archived
    start_date  DATE,
    end_date    DATE,
    created_by  UUID REFERENCES hunters(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Project notes (shared markdown docs)
CREATE TABLE project_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT,                   -- markdown
    tags        TEXT[] DEFAULT '{}',
    created_by  UUID REFERENCES hunters(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Project <-> Hunter assignment
CREATE TABLE project_hunters (
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    hunter_id   UUID REFERENCES hunters(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, hunter_id)
);

-- Programs (belong to a project)
CREATE TABLE programs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID REFERENCES projects(id) ON DELETE CASCADE,
    slug                 TEXT UNIQUE NOT NULL,
    name                 TEXT NOT NULL,
    platform             TEXT NOT NULL DEFAULT 'other',
    program_url          TEXT,
    status               TEXT NOT NULL DEFAULT 'active',
    bounty_range_low     INTEGER,
    bounty_range_high    INTEGER,
    currency             TEXT DEFAULT 'USD',
    active_approved      BOOLEAN DEFAULT FALSE,  -- human gate
    notes                TEXT,
    rescan_interval_hrs  INTEGER DEFAULT 24,
    last_scanned_at      TIMESTAMPTZ,
    created_by           UUID REFERENCES hunters(id),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Scope targets
CREATE TABLE scope_targets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id   UUID REFERENCES programs(id) ON DELETE CASCADE,
    target_type  TEXT NOT NULL,   -- domain|ip|cidr|wildcard|apk|url
    target_value TEXT NOT NULL,
    in_scope     BOOLEAN NOT NULL DEFAULT TRUE,
    notes        TEXT,
    added_by     UUID REFERENCES hunters(id),
    added_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Subdomains discovered
CREATE TABLE subdomains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
    root_domain     TEXT NOT NULL,
    subdomain       TEXT NOT NULL,
    ip_address      TEXT,
    status_code     INTEGER,
    title           TEXT,
    web_server      TEXT,
    tech_stack      JSONB DEFAULT '[]',
    cdn             BOOLEAN DEFAULT FALSE,
    cdn_provider    TEXT,
    is_new          BOOLEAN DEFAULT TRUE,
    is_alive        BOOLEAN DEFAULT FALSE,
    screenshot_path TEXT,
    first_seen      TIMESTAMPTZ DEFAULT NOW(),
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, subdomain)
);

-- Open ports
CREATE TABLE ports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdomain_id UUID REFERENCES subdomains(id) ON DELETE CASCADE,
    port         INTEGER NOT NULL,
    protocol     TEXT NOT NULL DEFAULT 'tcp',
    service      TEXT,
    version      TEXT,
    banner       TEXT,
    first_seen   TIMESTAMPTZ DEFAULT NOW(),
    last_seen    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subdomain_id, port, protocol)
);

-- Discovered URLs
CREATE TABLE urls (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdomain_id   UUID REFERENCES subdomains(id) ON DELETE CASCADE,
    url            TEXT NOT NULL,
    method         TEXT DEFAULT 'GET',
    status_code    INTEGER,
    content_length INTEGER,
    source         TEXT,   -- katana|gau|wayback|ffuf
    params         JSONB DEFAULT '[]',
    found_at       TIMESTAMPTZ DEFAULT NOW(),
    last_seen      TIMESTAMPTZ DEFAULT NOW()
);

-- Findings (vulnerabilities)
CREATE TABLE findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
    subdomain_id    UUID REFERENCES subdomains(id),
    url_id          UUID REFERENCES urls(id),
    title           TEXT NOT NULL,
    description     TEXT,
    template_id     TEXT,
    template_name   TEXT,
    tool            TEXT,
    severity        TEXT NOT NULL DEFAULT 'info',
    cvss_score      NUMERIC(4,1),
    cve_id          TEXT,
    request         TEXT,
    response        TEXT,
    curl_command    TEXT,
    evidence_paths  JSONB DEFAULT '[]',
    screenshot_path TEXT,
    status          TEXT NOT NULL DEFAULT 'new',
    assigned_to     UUID REFERENCES hunters(id),
    found_at        TIMESTAMPTZ DEFAULT NOW(),
    triaged_at      TIMESTAMPTZ,
    validated_at    TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ,
    bounty_amount   NUMERIC(10,2),
    notes           TEXT,
    report_path     TEXT,
    dedup_hash      TEXT UNIQUE      -- sha256(template_id+host+param)
);

-- Scan jobs
CREATE TABLE scan_jobs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id             UUID REFERENCES programs(id) ON DELETE CASCADE,
    stage                  INTEGER NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'queued',
    started_at             TIMESTAMPTZ,
    finished_at            TIMESTAMPTZ,
    triggered_by           UUID REFERENCES hunters(id),
    triggered_by_scheduler BOOLEAN DEFAULT FALSE,
    tool                   TEXT,
    script_path            TEXT,
    output_path            TEXT,
    findings_count         INTEGER DEFAULT 0,
    error_message          TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts sent
CREATE TABLE alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id  UUID REFERENCES findings(id),
    job_id      UUID REFERENCES scan_jobs(id),
    alert_type  TEXT NOT NULL,
    message     TEXT NOT NULL,
    sent_to     UUID REFERENCES hunters(id),
    channel     TEXT NOT NULL,
    sent_at     TIMESTAMPTZ DEFAULT NOW(),
    success     BOOLEAN DEFAULT TRUE
);

-- Full audit log
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunter_id   UUID REFERENCES hunters(id),
    action      TEXT NOT NULL,
    resource    TEXT,
    resource_id UUID,
    detail      JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

============================================================
## BASH SCRIPT CONTRACT
============================================================

Every script follows this exact contract:
  Args:    positional, passed by Rust runner
  STDOUT:  JSONL (one JSON object per line) → Rust parser → DB
  STDERR:  human-readable log lines → Rust → WebSocket → UI terminal
  Exit 0:  success
  Exit 1:  tool error (tool ran but failed)
  Exit 2:  tool not found

─── scripts/lib/common.sh ─────────────────────────────────

#!/usr/bin/env bash
set -euo pipefail

log_info()   { echo "[INFO]  $(date -u +%H:%M:%S) $*" >&2; }
log_warn()   { echo "[WARN]  $(date -u +%H:%M:%S) $*" >&2; }
log_error()  { echo "[ERROR] $(date -u +%H:%M:%S) $*" >&2; }

check_tool() {
    if ! command -v "$1" &>/dev/null; then
        log_error "Required tool not found: $1"
        exit 2
    fi
    log_info "$1 found at $(command -v "$1")"
}

emit_json() { echo "$1"; }   # stdout → Rust JSONL parser

─── scripts/stage1_passive/run_subfinder.sh ───────────────

#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

DOMAIN="$1"
OUTPUT_DIR="$2"
THREADS="${3:-10}"

check_tool subfinder
log_info "subfinder starting on $DOMAIN"

subfinder -d "$DOMAIN" -silent -json -t "$THREADS" \
    2>&1 | while IFS= read -r line; do
        # Try to parse as JSON (subdomain result) or log as info
        if echo "$line" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
            emit_json "$line"          # → Rust parser
        else
            log_info "$line"           # → WebSocket live log
        fi
    done

log_info "subfinder complete on $DOMAIN"

─── scripts/stage4_vuln/run_nuclei.sh ─────────────────────

#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

URL_LIST="$1"
OUTPUT_DIR="$2"
TEMPLATES_DIR="${3:-$HOME/nuclei-templates}"
SEVERITY="${4:-critical,high,medium,low,info}"

check_tool nuclei

COUNT=$(wc -l < "$URL_LIST")
log_info "nuclei scanning $COUNT targets with severity: $SEVERITY"

nuclei \
    -l "$URL_LIST" \
    -t "$TEMPLATES_DIR" \
    -severity "$SEVERITY" \
    -tags cve,rce,sqli,xss,lfi,ssrf,xxe,idor,exposure,misconfig,default-login,takeover \
    -jsonl \
    -silent \
    2>&1 | while IFS= read -r line; do
        if echo "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'template-id' in d" 2>/dev/null; then
            emit_json "$line"
        else
            log_info "$line"
        fi
    done

log_info "nuclei complete"

============================================================
## RUST PIPELINE RUNNER (KEY PATTERN)
============================================================

// src/pipeline/runner.rs

pub struct ScriptRunner {
    pub script: String,
    pub args: Vec<String>,
    pub job_id: Uuid,
    pub ws_tx: broadcast::Sender<String>,
}

impl ScriptRunner {
    pub async fn run(&self) -> Result<Vec<serde_json::Value>, RunnerError> {
        let mut child = tokio::process::Command::new("bash")
            .arg(&self.script)
            .args(&self.args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let tx = self.ws_tx.clone();
        let job_id = self.job_id;

        // stderr → WebSocket (live logs in UI)
        let stderr_task = tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                let msg = format!("[job:{}] {}", job_id, line);
                let _ = tx.send(msg);
            }
        });

        // stdout → JSONL collection for parser
        let mut results = Vec::new();
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                results.push(json);
            }
        }

        let status = child.wait().await?;
        let _ = stderr_task.await;

        if !status.success() {
            return Err(RunnerError::ScriptFailed(status.code()));
        }

        Ok(results)
    }
}

// Usage in a stage handler:
// let runner = ScriptRunner { script, args, job_id, ws_tx };
// let jsonl = runner.run().await?;
// let findings = parsers::nuclei::parse(jsonl)?;
// db::findings::insert_many(&pool, findings).await?;

============================================================
## UI DESIGN SPEC
============================================================

DESIGN LANGUAGE
  Inspired by:    Claude (clean prose, sidebar, soft depth)
                  Grok (dense tables, inline annotations)
                  ChatGPT (right panel, prompt buttons)

COLOR TOKENS (CSS variables in globals.css)
  --bg-base:        #0f1117    deep near-black base
  --bg-surface:     #1a1d27    card/panel backgrounds
  --bg-elevated:    #22263a    modal/dropdown/hover
  --border:         #2a2d3e    all borders
  --primary:        #7c6af7    purple (actions, links)
  --accent:         #00d4aa    teal (success, new badge)
  --danger:         #f85149    critical severity
  --warning:        #d29922    high severity
  --info:           #58a6ff    medium severity
  --success:        #3fb950    low / confirmed
  --text-primary:   #e6edf3
  --text-muted:     #8b949e
  --text-subtle:    #484f58

THREE-PANEL LAYOUT
  ┌─────────────────────────────────────────────────────────┐
  │ TopBar: [🔱 BountyOS] [Global Search ⌘K] [🔔] [User▾] │
  ├──────────┬─────────────────────────────┬────────────────┤
  │          │                             │                │
  │ Sidebar  │     Main Content            │  Assistant     │
  │  220px   │     flex-1                  │  Panel 300px   │
  │          │                             │  (closeable)   │
  │ Projects │                             │                │
  │ ──────── │                             │  Context-aware │
  │ [proj 1] │                             │  template      │
  │ [proj 2] │                             │  buttons       │
  │          │                             │                │
  │ Programs │                             │  Output area   │
  │ ──────── │                             │  (editable     │
  │ [prog 1] │                             │   markdown)    │
  │ [prog 2] │                             │                │
  │          │                             │                │
  │ ──────── │                             │                │
  │ Findings │                             │                │
  │ Gallery  │                             │                │
  │ Jobs     │                             │                │
  │ Settings │                             │                │
  └──────────┴─────────────────────────────┴────────────────┘

──────────────────────────────────────────────────────────────
DASHBOARD /dashboard
──────────────────────────────────────────────────────────────
  Stats row (5 cards):
    [ Active Projects ] [ Programs ] [ New Findings 24h ]
    [ Unassigned ] [ Submitted This Week ]

  Row 2:
    Severity donut chart (left)
    Findings over time — 7 day sparkline (right)

  Row 3:
    Active jobs: tool + stage + elapsed + progress bar
    [Cancel] per job

  Row 4:
    Activity feed:
      Each entry: icon + message + timestamp + program badge
      e.g. "🔴 Critical: SSRF in api.uber.com — nuclei"
           "✅ Stage 2 complete — grab.bugcrowd — 47 live hosts"
           "🆕 New subdomain: secret.uber.com"

  Quick actions: [+ New Project] [Run Scan] [View Unassigned]

──────────────────────────────────────────────────────────────
PROJECTS /projects
──────────────────────────────────────────────────────────────
  Card grid (3 col desktop):
    Name + status badge
    Program count | Finding count (C/H/M/L breakdown)
    Date range
    Finding status funnel: new→triaged→validated→submitted
    Team avatars
    [View] [+ Program] [Archive]

──────────────────────────────────────────────────────────────
PROJECT DETAIL /projects/[id]
──────────────────────────────────────────────────────────────
  Tabs: Overview | Programs | Notes | Timeline | Team

  Overview:
    Cross-program stats rollup
    Finding funnel visualization
    Top unsubmitted findings (by severity)
    Recent activity feed

  Programs:
    Same program cards but filtered to this project

  Notes:
    Sidebar: list of notes (title, tag, last edited)
    Main: Monaco markdown editor for selected note
    Tags: methodology | scope | findings | recon | misc
    [+ New Note] button
    Auto-save on change (debounced 2s)
    Version history: last 10 edits (expandable)

  Timeline:
    Chronological event stream across all programs:
      Program added / Scan started / Scan complete
      Finding discovered / Finding submitted / Bounty received
    Filterable by type, severity, program, hunter
    [Export as PDF] for client reporting

  Team:
    Hunter cards: avatar + name + stats
      (findings claimed / validated / submitted)
    [Assign Hunter] [Remove]

──────────────────────────────────────────────────────────────
PROGRAM DETAIL /programs/[id]
──────────────────────────────────────────────────────────────
  Header: name | platform badge | status | [Scan Now ▾] [⋮]
  Scan Now dropdown: Stage 1 | Stage 2 | Stage 3 | Stage 4 | Full

  Tabs: Overview | Scope | Recon | Findings | Reports

  Overview:
    Stats: subdomains | live hosts | open ports | findings (C/H/M/L)
    Pipeline status: each stage — last run | duration | status icon
    Approval gate: banner if not approved for active scanning
      [Approve Active Scanning] button (admin only)

  Scope:
    Two-section table: In-Scope | Out-of-Scope
    Columns: type badge | value | notes | added by | date | actions
    [+ Add Target] → inline expandable form
    Import: paste textarea → auto-parse | CSV upload
    Wildcard expansion preview

  Recon:
    Sub-tabs: Subdomains | Ports | URLs | Screenshots

    Subdomains: subdomain | IP | status | title | tech badges | new? | alive?
    Filters: alive only | new only | has findings | by tech

    Ports: grouped by host → port/service/version rows
    Expandable: banner grab content

    URLs: url | method | status | content-length | source | params
    Filter: by source | status code | has params

    Screenshots: 4-col grid
      Each: img | domain | status | title | tech
      Click → modal (full screenshot + host metadata + [Go to Recon])

  Findings:
    Same as global findings table but scoped to this program

  Reports:
    List of saved reports (title | template | date | [Preview] [Download])
    [Generate Report] → finding picker → template picker → preview

──────────────────────────────────────────────────────────────
FINDINGS /findings (global)
──────────────────────────────────────────────────────────────
  Dense sortable table:
    severity | project | program | title | host | status | hunter | date
  Filter sidebar:
    Severity checkboxes | status | project | program | assigned | date range
  Search: full text across title + description
  Bulk actions: [Assign to me] [Mark FP] [Export CSV]
  Row click → finding detail slide-over (no full page nav)

──────────────────────────────────────────────────────────────
FINDING DETAIL /findings/[id]
──────────────────────────────────────────────────────────────
  Left panel (65%):
    Breadcrumb: Project > Program > Subdomain > Finding

    Header:
      Title (h1, inline edit)
      Severity badge | Status dropdown | Assigned dropdown
      [Validate] [Mark FP] [Mark Dup] [Mark Submitted] buttons

    Tabs: Details | Evidence | Notes | History

    Details:
      Host | URL | Parameter | Found by tool
      Description (rendered markdown)
      Template: ID + name
      CVE: linked if present
      CVSS: score + vector string

    Evidence:
      HTTP Request (Monaco, read-only, syntax highlighted)
      HTTP Response (Monaco, collapsible)
      cURL command block (copy button)
      Screenshot gallery (click to expand)
      Raw tool output (collapsible)

    Notes:
      Monaco markdown editor
      Auto-save, timestamped edits

    History:
      Audit trail: status changes | assignments | notes | report generated

  Right panel (35%) — Assistant Panel:
    Header: "Report Builder"
    Sub-header: finding title + severity

    Action buttons:
      [ 📝 Draft Full Report ]
      [ 🎯 Write Impact Statement ]
      [ 🔁 Reproduction Steps ]
      [ 📊 CVSS Calculator ]
      [ 🔧 Remediation Suggestion ]
      [ 🔍 Similar in DB ]
      [ 📤 Export for Platform ]

    Platform selector: H1 | Bugcrowd | Intigriti | Synack | Generic

    Output area:
      Rendered editable markdown
      [Copy] [Save Draft] [Save Final]

──────────────────────────────────────────────────────────────
JOBS /jobs
──────────────────────────────────────────────────────────────
  Table: id | program | stage | tool | status | started | duration | findings
  Status badges: queued (gray) | running (blue pulse) | done (green) | failed (red)
  [Cancel] on running
  Row click → inline log drawer (xterm.js connected to WS /ws/jobs/:id)
  Filter: by status | program | stage | date

──────────────────────────────────────────────────────────────
SETTINGS /settings (admin only)
──────────────────────────────────────────────────────────────
  Tabs: Tools | Wordlists | Alerts | Schedule | Tokens | Security | Hunters

  Tools:
    Each tool row: name | detected path | version | health ✓/✗
    Custom path override input
    Custom flags per tool
    [Check All Tools] button

  Wordlists:
    Content discovery | DNS | Parameters | Passwords
    File picker + manual path + preview (line count, size)

  Alerts:
    Discord: webhook URL per severity (critical | high | all)
    Slack: same
    Email: SMTP host/port/user/pass + recipients
    [Test Alert] per channel

  Schedule:
    Global rescan interval (slider: 1h–72h)
    Per-program overrides table
    Quiet hours: start/end picker
    Next scheduled scans list

  Tokens:
    Table: name | created | last used | expires | [Revoke]
    [Generate New Token] → shown once modal (copy to clipboard)

  Security:
    Change password form
    2FA: QR code setup | backup codes | disable
    Active sessions: device | IP | last active | [Revoke]

  Hunters:
    Table: username | display name | role | 2FA | last login | status
    [+ Add Hunter] | [Edit] | [Deactivate]

============================================================
## ASSISTANT PANEL — TEMPLATE ENGINE DETAIL
============================================================

Context detection (no LLM — all local):

  When on /findings/[id]:
    Loads: finding.title, finding.severity, finding.host,
           finding.description, finding.request, finding.cve_id,
           finding.cvss_score, finding.template_name
    Shows: Report Builder buttons

  When on /programs/[id]/recon:
    Loads: program stats from DB
    Shows: Attack surface summary button, quick wins, export

  When on /projects/[id]:
    Loads: project stats, all findings summary
    Shows: Progress report, timeline summary, bounty estimate

Template variable substitution (Rust-side, served via API):
  POST /api/findings/:id/report?template=h1
  → Rust reads finding from DB
  → Substitutes {{title}}, {{host}}, {{request}}, etc.
  → Returns populated markdown string
  → Frontend renders in AssistantPanel output area

CVSS Calculator:
  Interactive widget (no API needed, pure frontend)
  Attack Vector | Complexity | Privileges | User Interaction
  Scope | Confidentiality | Integrity | Availability
  Live score updates as user clicks
  [Apply to Finding] button writes score back to DB

============================================================
## CLI COMMANDS (FINAL)
============================================================

# Authentication
bountyos login                         # URL + user + pass + TOTP → stores token
bountyos logout

# Projects
bountyos project list
bountyos project add --name "Q1 Programs" --start 2025-01-01
bountyos project notes list --id <uuid>
bountyos project delete --id <uuid>

# Programs
bountyos program list
bountyos program list --project <slug>
bountyos program add --project <slug> --name "Uber" --platform h1 --url https://hackerone.com/uber
bountyos program delete --slug uber

# Scope
bountyos scope list --program uber
bountyos scope add --program uber --target "*.uber.com" --type wildcard
bountyos scope add --program uber --target "internal.corp" --out-of-scope
bountyos scope import --program uber --file targets.txt
bountyos scope approve --program uber

# Scanning
bountyos scan --program uber --stage 1
bountyos scan --program uber --stage 2
bountyos scan --program uber --stage 3         # requires approval
bountyos scan --program uber --stage 4
bountyos scan --program uber --full
bountyos scan --program uber --full --skip-active

# Jobs
bountyos jobs list
bountyos jobs list --program uber --status running
bountyos jobs logs --id <uuid>                 # live stream to terminal
bountyos jobs cancel --id <uuid>

# Findings
bountyos findings list
bountyos findings list --program uber --severity high --status new
bountyos findings list --unassigned
bountyos findings claim --id <uuid>
bountyos findings validate --id <uuid>
bountyos findings fp --id <uuid>
bountyos findings report --id <uuid> --platform h1

# Continuous monitoring
bountyos monitor status
bountyos monitor start
bountyos monitor stop
bountyos monitor set-interval --program uber --hours 6

============================================================
## BUILD ORDER (8 WEEKS)
============================================================

WEEK 1 — Rust Backend Foundation
  [ ] Cargo workspace (api + cli + common crates)
  [ ] SQLx + PostgreSQL pool + all migrations
  [ ] Axum router skeleton (all routes → 501 stub)
  [ ] argon2 password hashing
  [ ] JWT (access 15min + refresh 7day httpOnly cookie)
  [ ] TOTP 2FA (totp-rs, QR code generation)
  [ ] API token generation + SHA256 storage
  [ ] Redis session blacklist + rate limiting
  [ ] First-run setup detection + admin creation endpoint
  [ ] Docker Compose running (postgres + redis + api)

WEEK 2 — Bash Scripts + Rust Parsers
  [ ] scripts/lib/common.sh
  [ ] All Stage 1 scripts (subfinder, amass, gau, crtsh, waybackurls)
  [ ] All Stage 2 scripts (httpx, naabu, gowitness, katana passive)
  [ ] All Stage 3 scripts (ffuf, katana active, arjun, nmap)
  [ ] All Stage 4 scripts (nuclei, wpscan, testssl, subjack)
  [ ] Rust pipeline runner (spawn bash, stream stderr via WS)
  [ ] Rust parsers for each tool (JSONL → DB structs)
  [ ] Scope check enforcement in runner
  [ ] Test each script standalone on known target

WEEK 3 — Next.js Shell
  [ ] Project setup: Next.js 14 + Tailwind + shadcn
  [ ] Full design token set in globals.css
  [ ] Three-panel layout (Sidebar + Main + AssistantPanel)
  [ ] Sidebar: project list + program list + nav links
  [ ] TopBar: search modal (⌘K) + notifications + user menu
  [ ] Login page + 2FA page + first-run wizard
  [ ] Route protection middleware
  [ ] Dark/light theme toggle

WEEK 4 — Project + Program UI
  [ ] Projects list + create modal
  [ ] Project detail: all 5 tabs wired to API
  [ ] Project Notes: Monaco editor + auto-save + version history
  [ ] Project Timeline component
  [ ] Programs list + create form
  [ ] Program detail: all 5 tabs
  [ ] Scope editor: inline add/edit/delete + bulk import
  [ ] Approval gate banner + button

WEEK 5 — Pipeline UI + Recon
  [ ] Jobs page with live status badges
  [ ] LiveLog.tsx: xterm.js + WebSocket /ws/jobs/:id
  [ ] Log drawer (slide-over from jobs table row)
  [ ] Scan trigger from program detail header
  [ ] Subdomain table: all columns, filters, sort
  [ ] Port map component
  [ ] Screenshot gallery (evidence/ served as static by nginx)
  [ ] URL table with param count

WEEK 6 — Findings UI + Assistant Panel
  [ ] Global findings table (sort, filter, search, bulk actions)
  [ ] Finding detail: all 4 tabs
  [ ] Evidence viewer (Monaco read-only, request/response)
  [ ] Status + assignment actions
  [ ] AssistantPanel: all template buttons wired to API
  [ ] CVSS calculator widget (pure frontend)
  [ ] Report preview (markdown rendered)

WEEK 7 — Alerts + Reports + CLI
  [ ] Alert engine in Rust (Discord + Slack + email)
  [ ] Alert rules in settings UI + API
  [ ] Immediate critical/high alert on finding insert
  [ ] Report generator (template var substitution in Rust)
  [ ] H1 + Bugcrowd + Intigriti + Synack + Generic templates
  [ ] Report download endpoint
  [ ] bountyos-cli: all commands working
  [ ] CLI live log streaming (SSE or WS to terminal)

WEEK 8 — Monitoring + Polish + Harden
  [ ] Tokio interval scheduler (APScheduler equivalent in Rust)
  [ ] Subdomain diff engine (new asset detection)
  [ ] Monitor alert routing
  [ ] Per-program rescan interval configuration
  [ ] Settings: tools health check button
  [ ] Settings: wordlist file picker
  [ ] Keyboard shortcuts (⌘K search, N new, etc.)
  [ ] Mobile responsive pass
  [ ] Security: CSP headers, CSRF, audit all endpoints
  [ ] E2E pipeline test on sandboxed test target
  [ ] README + setup documentation + tool install guide

============================================================
## FIRST RUN SEQUENCE
============================================================

1. docker-compose up -d
2. Visit https://localhost → setup wizard (first run detected)
3. Create admin account: username + password + 2FA QR setup
4. Configure tool paths (auto-detected, override if needed)
5. Set wordlist paths
6. Optional: Discord/Slack webhook URLs
7. Done → Dashboard

CLI first use:
  bountyos login --server https://localhost
  → enter username + password + TOTP code
  → API token saved to ~/.bountyos/config.toml (chmod 600)
  bountyos program list   # verify connection

============================================================
## SECURITY IMPLEMENTATION
============================================================

Passwords:  argon2id, memory=65536, iterations=3, parallelism=1
JWT:        HS256, access=15min, refresh=7days httpOnly Secure SameSite=Strict
2FA:        TOTP, 30s window, ±1 step tolerance, backup codes (argon2 stored)
Rate limit: Login 5/15min per IP | API 200 req/min per token
API token:  bountyos_{32 random bytes hex}, stored as SHA256 in DB, shown once
Headers:    HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
CSRF:       Double-submit cookie (token in cookie + header on mutations)
Sessions:   JTI-based blacklist in Redis, invalidated on logout/pw change
OOS block:  Hard block in scope_check.rs before any active scan stage

============================================================
END OF FINAL SPEC v3.0
============================================================
