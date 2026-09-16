# BountyOS — Full Project Details

Comprehensive documentation of the **BountyOS v3.0** repository. Generated from a full source read of the working tree on `main` (last commits: `83bc722 "3"`, `dbc853e "'17/05'"`).

---

## 1. Overview

**BountyOS** is a self-hosted, fully local **bug bounty program management platform** that orchestrates open-source recon/vulnerability-scanning tools (subfinder, amass, gau, waybackurls, httpx, naabu, katana, ffuf, nuclei, nmap, wpscan, testssl, subjack, gowitness, etc.) against in-scope targets, then ingests raw tool output into PostgreSQL for tracking **projects → programs → scope → subdomains/ports/urls → findings → reports**.

- **Backend:** Rust (Axum 0.7), SQLx + PostgreSQL 15, Redis 7
- **Tool orchestration:** Bash scripts spawned by Rust (`tokio::process::Command`); NDJSON on stdout → Rust parsers → DB; logs on stderr → WebSocket → UI terminal
- **Frontend:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, TypeScript strict
- **Auth:** local accounts, argon2id passwords, JWT + refresh rotation, TOTP 2FA, API tokens for the CLI
- **LLM triage (optional):** local VulnLLM-R-7B via Ollama for append-only finding triage (disabled by default)
- **Interfaces:** Web UI + `bountyos` CLI (same Cargo workspace)
- **Infrastructure:** Docker Compose, nginx reverse proxy (HTTPS + evidence static serving)

The design spec is captured in `bounty-os.md` (1270 lines, "FINAL LOCKED ARCHITECTURE v3.0"). Implementation is **partial**: many server handlers and nearly all frontend pages return stubs or render mock data (see §10 "Implementation Status" and §11 "Known Inconsistencies").

---

## 2. Repository Layout

```
Bounty-OS/
├── Cargo.toml                      Workspace root (server, cli, common crates)
├── Cargo.lock
├── bounty-os.md                    Locked design spec (v3.0)
├── README.md                       Quick start + structure table
├── Makefile                        Build/run/migrate/check targets
├── docker-compose.yml              Prod stack (postgres, redis, server, frontend, nginx)
├── docker-compose.dev.yml          Dev stack (file: extends, cargo watch, npm run dev)
├── .env.example                    DB/Redis/JWT/frontend env template
├── config/
│   ├── config.toml                 TOML config (database, redis, auth, server, rate_limiting, evidence)
│   └── config.yaml                 YAML config — same keys + [llm] section
├── crates/
│   ├── bountyos-server/            Axum web server (api + pipeline)
│   ├── bountyos-cli/               CLI binary ("bountyos")
│   └── bountyos-common/            Shared enums/DTOS (Severity, Platform, JobStatus, ...)
├── frontend/                       Next.js 14 app
├── scripts/                        Bash tool orchestrators (per tool, 4 scan stages + monitor)
│   ├── lib/                        common.sh, output.sh, scope_check.sh, llm_check.sh
│   ├── stage1_passive/             subfinder, amass, assetfinder, crtsh, gau, waybackurls, trufflehog
│   ├── stage2_validate/            httpx, naabu, gowitness, katana_passive
│   ├── stage3_active/              ffuf, katana_active, arjun, nmap, kiterunner
│   ├── stage4_vuln/                nuclei, nuclei_tech, wpscan, testssl, subjack
│   └── monitor/                    run_monitor.sh (host change detection)
├── evidence/                       Bind-mounted raw tool output (starts empty)
├── nginx/
│   ├── nginx.conf                  HTTPS reverse proxy, /api, /ws, /evidence static
│   └── ssl/                        Self-signed certs (nginx.crt, nginx.key, bounty.os.key)
└── tools/                          Vendored security tools (git clones)
    ├── dalfox/  dnsx/  ffuf/  gau/  httpx/  katana/  naabu/  nuclei/
    ├── nuclei-templates/           (~thousands of .yaml templates + profiles)
    ├── subfinder/                  (incl. its own .git — 100+ passive source adapters)
    └── waybackurls/
```

---

## 3. Workspace & Crates

### 3.1 `Cargo.toml` (workspace)
- Members: `crates/bountyos-server`, `crates/bountyos-cli`, `crates/bountyos-common`
- `resolver = "2"`
- Release profile: `strip`, `lto`, `codegen-units = 1`
- Dev profile: `opt-level = 1`

### 3.2 `bountyos-common` (shared types: `src/lib.rs`, `src/types.rs`)
Enums with `Display` + `FromStr` impls:
- **Severity:** `Critical | High | Medium | Low | Info`
- **Platform:** `H1 | Bugcrowd | Intigriti | Synack | Other`
- **JobStatus:** `Queued | Running | Done | Failed | Cancelled`
- **FindingStatus:** `New | Triaged | Validated | Submitted | Fp | Dup | Na | BountyAwarded`
- **ProjectStatus:** `Active | Archived`
- **ScopeType:** `Domain | Ip | Cidr | Wildcard | Apk | Url`
- **ScanStage:** `Passive("1") | Validate("2") | Active("3") | Vuln("4")`

Deps: serde, serde_json, uuid, chrono.

### 3.3 `bountyos-server` (deps)
axum 0.7 (ws), tokio (full), serde/serde_json, jsonwebtoken 9.2, argon2 0.5, totp-rs 5.0 (gen_secret, otpauth), redis 0.24 (tokio-comp), sqlx 0.7 (postgres, runtime-tokio, uuid, json, chrono, migrate), reqwest 0.11 (json), tower 0.4, tower-http 0.5 (cors, trace, fs), tower_governor 0.2, tracing/tracing-subscriber (env-filter), config 0.13, uuid 1.6, chrono 0.4, thiserror, anyhow, futures-util, base32, sha2, hex, governor 0.6.

### 3.4 `bountyos-cli` (deps)
clap 4 (derive), serde/serde_json, reqwest (json, native-tls), tokio, colored, tabled 0.15, toml 0.8, chrono, uuid, anyhow.

---

## 4. Server — `crates/bountyos-server/`

### 4.1 Entry (`main.rs`)
- Sets up tracing (`RUST_LOG`, default `bountyos_server=debug,tower_http=debug`).
- Loads config → `db::init_db_pool` (PgPool max 10 conns, 3s acquire timeout) → `redis::init_redis_pool` (`Arc<redis::Client>`).
- Runs embedded migrations only when `config.first_run`.
- Opens `broadcast::Sender<String>` WS channel (cap **256**).
- Routes: `GET /` → "Welcome to BountyOS API", `GET /health` → "OK", `nest /api` via `app::create_router` + `TraceLayer`.
- Binds `0.0.0.0:8000`.

### 4.2 Router (`app.rs`)
`create_router(db_pool, redis_pool, config, ws_tx) -> Router`. Builds `AppState` (db_pool, redis_pool, llm_client, evidence_base, config, ws_tx), `.with_state(...)` + `TraceLayer` + `CorsLayer::permissive()`.

**Full route table** (all under `/api`):

| Method | Path | Handler |
|---|---|---|
| GET | /health | health_check |
| POST | /auth/login, /auth/logout, /auth/refresh, /auth/2fa/setup, /auth/2fa/verify | auth::* |
| GET | /auth/me | auth::me |
| GET/POST | /projects | projects::list/create_project |
| GET/PUT/DELETE | /projects/:id | projects::get/update/delete_project |
| GET | /projects/:id/stats | projects::get_project_stats |
| GET/POST | /projects/:id/milestones; PUT /projects/:id/milestones/:mid | projects::* |
| GET/POST | /projects/:id/team; DELETE /projects/:id/team/:hunter_id | projects::* |
| GET/PUT | /projects/:id/notes | projects::get/update_project_notes |
| GET | /projects/:id/kanban; PUT /projects/:id/kanban/columns | projects::* |
| PUT | /findings/:id/kanban | findings::move_finding_kanban |
| GET/POST | /projects/:id/programs | programs::list/create_program |
| GET/PUT/DELETE | /programs/:id | programs::get/update/delete_program |
| POST | /programs/:id/approve | programs::approve_program |
| POST | /programs/:id/scan | programs::scan_program |
| GET/POST | /programs/:id/scope | scope::list/add_scope |
| PUT/DELETE | /scope/:id | scope::update/delete_scope |
| POST | /programs/:id/scope/import | scope::import_scope |
| GET | /programs/:id/subdomains; /subdomains/:id; /subdomains/:id/ports; /programs/:id/urls | subdomains/ports/urls |
| GET | /findings; /projects/:id/findings; /programs/:id/findings | findings::list_* |
| GET/PUT | /findings/:id | findings::get/update_finding |
| POST | /findings/:id/claim, /validate, /report | findings::* |
| POST/GET | /findings/:id/triage | findings::triage_finding / get_finding_triage |
| GET | /jobs; /programs/:id/jobs; /jobs/:id; DELETE /jobs/:id | jobs::* |
| GET/POST | /hunters; PUT/DELETE /hunters/:id | hunters::* |
| GET/POST | /tokens; DELETE /tokens/:id | tokens::* |
| GET/PUT | /settings; POST /settings/tools/check | settings::* |
| GET | /ws/jobs/:id | ws::ws_handler |
| GET | /evidence/*path | static_files::serve_evidence |

(Routes referencing `handlers::auth`, milestone/team/notes/kanban handlers, and `health_check` are declared but the modules don't all exist yet.)

### 4.3 Config (`config.rs` + `config/config.yaml`)
- Reads `config/config.yaml` + env with prefix `BOUNTYOS_` (`__`→nesting), then overrides from `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FIRST_RUN`, `RUST_LOG`, and optional `LLM_ENABLED`, `LLM_OLLAMA_URL`, `LLM_MODEL`.
- **AppConfig:** `database_url`, `redis_url`, `jwt_secret`, `first_run`, `rust_log`, `evidence_base_path`, `llm: LlmConfig`.
- **LlmConfig:** `enabled` (default **false**), `ollama_url` (default `http://localhost:11434`), `model` (default `vulnllm-r-7b`), `timeout_secs` (default 120).

### 4.4 State (`state.rs`)
```rust
pub struct AppState {
    db_pool: PgPool,
    redis_pool: Arc<redis::Client>,
    config: AppConfig,
    ws_tx: broadcast::Sender<String>,
    llm_client: Option<Arc<OllamaClient>>,  // None when llm.enabled=false
    evidence_base: PathBuf,                  // from config.evidence_base_path
}
```
`build_llm_client(config)` constructs an `OllamaClient` if enabled.

### 4.5 Auth module (`auth/`)
- **password.rs** — `hash_password`/`verify_password` using `Argon2::default()` (argon2id, PHC string) with `OsRng` salt.
- **tokens.rs** — `generate_tokens(user_id, jwt_secret) -> (access, refresh)` HS256; **access TTL 1h, refresh TTL 7d**. `verify_token` decodes with default HS256 validation.
- **middleware.rs** — `auth_middleware`: reads `Authorization: Bearer` → decodes JWT → checks Redis `session:{sub}` blacklist via `EXISTS` → injects the subject into request extensions. (Not wired in `app.rs`; the inserted extension type is a `String` while handlers read a `Uuid`.)
- **handlers.rs**:
  - `login` — SELECT hunter by username, argon2 verify, if `totp_enabled` return `{requires_2fa:true}` with no tokens; else issue tokens and store refresh in Redis `refresh_token:{id}` with 7-day EXPIRE.
  - `logout` — Redis `SET session:{user_id} 1 EX 604800` (session blacklist), 204.
  - `refresh` — raw-body refresh token → verify + must match stored Redis value → rotates both tokens.
  - `setup_2fa` — verifies password, `totp::generate_totp_secret(username, "BountyOS")`, stores `totp_secret`, returns secret + otpauth URL.
  - `verify_2fa` — checks TOTP code, sets `totp_enabled=true`, then issues tokens + Redis refresh (completes login).
  - `me` — returns current `Hunter`.
- **totp.rs** — `Secret::generate()`, RFC4648 base32, `TOTP::new(SHA1, 6 digits, 1 sk, 30s)`, otpauth URL builder; `verify_totp_code` decodes base32 → checks code.

### 4.6 Middleware (`middleware/`)
- **rate_limit.rs** — `rate_limit_layer`: governor **200 req/min** (burst 200). `login_rate_limit_layer`: **5 attempts / 15 min** (burst 5). **Not wired into the router.**
- **audit.rs** — `audit_middleware`: after each request, `INSERT INTO audit_log (hunter_id, action, resource, resource_id, ip_address)` where action=`{METHOD} {path}`, resource=path segment 2, resource_id=segment 3 parsed as UUID. **Column names mismatch migration 011** (`resource`/`resource_id` vs `resource_type`/`resource_id`). **Not wired into the router.**

### 4.7 Errors (`errors.rs`)
`AppError` (thiserror): `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest(String)`, `Internal(String)`, `Database(sqlx::Error)`, `Redis(redis::RedisError)`. `IntoResponse` maps 404/401/403/400/500 with body `{"error": "..."}`.

### 4.8 Models (`models/`)
Plain `#[derive(FromRow)]` DTOs matching the **design spec** shape (which differs from the migration SQL — see §11):
- **Project:** id, slug, name, description, status, start_date, end_date, created_by, timestamps
- **Program:** id, project_id, slug, name, platform, program_url, status, bounty_range_low/high, currency, active_approved, notes, rescan_interval_hrs, last_scanned_at, ...
- **ScopeTarget:** target_type, target_value, in_scope, notes, added_by
- **Subdomain:** root_domain, subdomain, ip_address, status_code, title, web_server, tech_stack(JSON), cdn, cdn_provider, is_new, is_alive, screenshot_path, first_seen/last_seen
- **Port:** subdomain_id, port, protocol, service, version, banner
- **Url:** subdomain_id, url, method, status_code, content_length, source, params(JSON), found_at/last_seen
- **Finding:** program_id, subdomain_id, url_id, title, description, template_id/name, tool, severity, cvss_score(f64), cve_id, request, response, curl_command, evidence_paths(JSON), screenshot_path, status, assigned_to, found/triaged/validated/submitted_at, bounty_amount, notes, report_path, dedup_hash
- **Hunter:** username, display_name, role, password_hash, totp_secret, totp_enabled, discord_webhook, slack_webhook, email, active, last_login ...
- **ScanJob:** program_id, stage, status, started/finished_at, triggered_by, triggered_by_scheduler, tool, script_path, output_path, findings_count, error_message
- **AuditLog:** hunter_id, action, resource, resource_id, detail(JSON), ip_address

### 4.9 Handlers — implemented vs stubs

**Working:**
- `programs.rs`: list/create/get/update/delete/approve. `create_program` uses `created_by = Uuid::new_v4()` placeholder. `update_program` uses `COALESCE` partial update. `approve_program` sets `active_approved=true`. `scan_program` is a **202 stub** (no queueing).
- `projects.rs`: full CRUD + partial updates. Same `created_by` placeholder.
- `findings.rs`: `triage_finding` (202 async, 501 if LLM disabled, 404 if missing) and `get_finding_triage` implemented; **all other finding endpoints are 501 stubs**.

**501 stubs:** findings list/get/update/claim/validate/report/kanban; jobs; hunters; scope; subdomains; ports; urls; reports; settings; tokens.

**Other:**
- `ws.rs`: `ws_handler` upgrades to WS, subscribes to `ws_tx` broadcast, relays every message as text; **no per-job filtering**.
- `static_files.rs`: `serve_evidence` always returns 404 (stub).

### 4.10 Alerts (`alerts/`)
- **discord.rs** — embedding with severity color: critical `0xf85149` red, high `0xd29922`, medium `0x58a6ff`, default `0x8b949e`. Payload: `{embeds:[{title:"BountyOS Alert", description, color, timestamp}]}`.
- **slack.rs** — severity→emoji (:red_circle:/:orange_circle:/:large_blue_circle:/:white_circle:), block payload (header + section + context w/ severity+timestamp).
- **email.rs** — stub, logs at info.

### 4.11 LLM triage (`llm/`)
- **schemas.rs** — `TriageInput` (run_id, finding_id, asset, endpoint, observations, evidence, generated_at), `TriageOutput` (finding_type, confidence, severity, evidence_used, reasoning_summary, missing_evidence, recommended_manual_verification, escalate). `finding_type` enum: IDOR | XSS | SQLi | SSRF | RCE | LFI | XXE | CSRF | OpenRedirect | InfoDisclosure | Misconfiguration | SubdomainTakeover | AuthBypass | BusinessLogic | Other. Helpers `is_high_confidence` (≥0.70) and `sanitized_confidence` (clamp 0–1).
- **client.rs** — `OllamaClient` (reqwest, base_url, model). `health_check` GET `/api/tags`. `chat` → `POST {base}/api/chat` with `messages`, `stream:false`, `options:{temperature:0.1, top_p:0.9, num_predict:1024}`. Parses JSON from model content via `strip_code_fence` (handles ```json fences).
- **prompts.rs** — `SYSTEM_PROMPT`: must return **valid JSON only**; **no exploit steps, no out-of-evidence scanning**, safe manual verification only; confidence < 0.3 when evidence insufficient; `escalate` iff confidence ≥ 0.8 AND severity ∈ {critical, high}. `MAX_SNIPPET_BYTES = 2048`.
- **triage.rs** — orchestrator: loads finding + joined subdomain/program/project, gathers evidence (`stage4_vuln/nuclei.jsonl`, inline `curl_command`, `stage2_validate/httpx.jsonl`), builds `TriageInput`, persists `llm/finding_{id}_input.json`, calls model, persists `llm/finding_{id}_output.json`, then `UPDATE findings SET llm_triage_json, llm_confidence, llm_triaged_at`. **Never changes finding status** (append-only).

### 4.12 Pipeline (`pipeline/`)
- **runner.rs** — `ScriptRunner { script, args, job_id, ws_tx }`. Spawns `bash <script> <args>` with piped stdio; stdout lines parsed as JSON → `Vec<serde_json::Value>`; stderr lines forwarded as `"[job:{id}] {line}"` over the WS broadcast; non-zero exit → `RunnerError::NonZeroExit`.
- **queue.rs** — Redis list `scan_queue`: `enqueue_job` (RPUSH JSON), `dequeue_job` (LPOP), `update_job_status` (`SET job:{id}:status`), `get_queue_length` (LLEN).
- **scheduler.rs** — `start_scheduler`: tokio loop every **60s** → `check_and_enqueue_rescans`: selects `active` programs, rescans when never scanned or `elapsed_hours >= rescan_interval_hrs`, enqueues a Stage-1 job + inserts a `scan_jobs` row. (References `app_state.db`/`app_state.redis` — fields that don't exist; see §11.)
- **scope_check.rs** — `is_target_in_scope`: counts in-scope scope targets (uses `target`/`out_of_scope` columns); returns `OutOfScope` error. `validate_scan_stage`: **stages ≥ 3 require `active_approved`** else `StageNotApproved`.
- **parsers/** (JSONL → DTOs; IDs are `Uuid::new_v4()`, `program_id = nil()`):
  - `subfinder.rs` — `host` (req), `ip`, `source` → Subdomain.
  - `gau.rs` — plain text lines → each as `Url{url, source:"gau"}`.
  - `httpx.rs` — `url` (req), status_code, title, web_server, content_type, content_length, tech[], cdn_name → Subdomain; `host` falls back to `url`.
  - `naabu.rs` — `ip`+`port` (req), `protocol` (udp→Udp) → Port `{ip, port, protocol, state:"open"}`.
  - `nmap.rs` — parses XML (`roxmltree`) → Port list (portid, protocol, state, service).
  - `nuclei.rs` — `template-id`+`host` (req), severity, `matched-at` (fallback host), `template-name`, description, tags CSV, `curl-command`, `type` → Finding (`title = "{name} - {host}"`, status New).

### 4.13 Redis (`redis.rs`)
`pub type RedisPool = Arc<redis::Client>`; `init_redis_pool(url)`. (Duplicate alias also in `state.rs`.)

### 4.14 Server Dockerfile
Multi-stage: `rust:1.77-slim-bookworm` builder (pkg-config, libssl-dev, `cargo build --release --bin bountyos-server`), then `debian:bookworm-slim` + ca-certificates, `EXPOSE 8000`, `CMD ["bountyos-server"]`.

---

## 5. Database Schema (migrations 001–012)

Files in `crates/bountyos-server/src/db/migrations/`. Run by `db/migrations.rs::run_migrations` — **note `MIGRATIONS` list only includes 001–011** (012 LLM triage is excluded from the runner).

| Migration | Table / Change |
|---|---|
| 001 | `hunters` — id, username UNIQUE, display_name, role, password_hash, totp_secret, totp_enabled, discord_webhook, slack_webhook, email, active, last_login, created_by(FK), created_at |
| 002 | `projects` — id, name UNIQUE, description, start_date/end_date DATE, active, created_by, created_at, updated_at |
| 003 | `programs` — id, project_id FK CASCADE, name, slug UNIQUE, platform, program_url, active, active_approved, rescan_interval_hrs(24), notes, created_by, timestamps, UNIQUE(project_id,name) |
| 004 | `scope_targets` — program_id FK CASCADE, target, target_type('domain'), out_of_scope, source, added_by, timestamps, UNIQUE(program_id,target) |
| 005 | `subdomains` — program_id FK CASCADE, subdomain, ip_address, status_code, title, web_server, content_type, content_length BIGINT, tech TEXT[], cdn_name, source, timestamps, UNIQUE(program_id,subdomain) |
| 006 | `ports` (program_id FK CASCADE, subdomain_id FK SET NULL, ip, port, protocol, service, state('open'), banner, UNIQUE(program_id,ip,port,protocol)) + `urls` (program_id FK CASCADE, subdomain_id FK SET NULL, url, status_code, content_type, content_length BIGINT, source, UNIQUE(program_id,url)) |
| 007 | `findings` — program_id FK CASCADE, subdomain_id FK SET NULL, title, description, severity, status('new'), finding_type, matched_at, curl_command, tags TEXT[], assigned_to FK, cvss_score REAL, kanban_column('backlog'), duplicate_of FK, timestamps + indexes |
| 008 | `scan_jobs` — id (no default), program_id FK CASCADE, subdomain_id FK SET NULL, stage, status('queued'), target, flags JSONB, error_log, started_at, completed_at, timestamps + indexes |
| 009 | `alert_configs` — program_id FK CASCADE, alert_type, webhook_url, channel, min_severity('medium'), enabled, timestamps + index |
| 010 | `api_tokens` — hunter_id FK CASCADE, token_hash, name, scopes TEXT[], last_used_at, expires_at, active, created_at + index |
| 011 | `audit_log` (hunter_id FK, action, resource_type, resource_id TEXT, details JSONB, ip_address, created_at + indexes) + `session_blacklist` (token_hash, expires_at, created_at) |
| 012 | `ALTER TABLE findings ADD llm_triage_json JSONB, llm_confidence NUMERIC(3,2), llm_triaged_at TIMESTAMPTZ` + indexes (**not in runner**) |

---

## 6. CLI — `crates/bountyos-cli/`

Clap 4 binary `bountyos`. Config stored in `~/.bountyos/config.toml` (`server_url`, `api_token`; server_url default `http://localhost:8000`). `ApiClient` (reqwest) sends `Authorization: Bearer <token>`, JSON body, bails with `HTTP <status>: <body>` on failure. Output via `print_json` / `print_table` (tabled) / colored messages.

Command tree:
- `login` (prompts user/pass/TOTP, stores token) · `logout`
- `project list|add --name --start|notes --id|delete --id`
- `program list [--project]|add --project --name --platform --url|delete --slug`
- `scope list [--program]|add --program --target --type --out-of-scope|import --program --file|approve --program`
- `scan --program --stage --full [--skip-active]`
- `jobs list|logs <id>|cancel <id>`
- `findings list [--program --severity --status --unassigned]|claim --id|validate --id|fp --id|report --id --platform`
- `monitor status|start|stop|set-interval --program --hours`

Note: CLI hits several endpoints (`/api/scan`, `/api/jobs/{id}/logs`, `/api/monitor/*`, `/api/programs/approve`) that don't match the current server router.

---

## 7. Bash Tool Scripts — `scripts/`

**Contract:** positional args from Rust runner; **stdout = NDJSON** (valid JSON only, parsed by Rust); **stderr = human-readable `[INFO]/[WARN]/[ERROR]` logs** forwarded to the WebSocket; exit 0 = ok, 1 = tool error, 2 = tool missing.

**`lib/common.sh`:** `log_info/log_warn/log_error`, `check_tool` (exit 2 if missing), `emit_json`, `validate_json` (python3 `json.load` check).

**`lib/output.sh`:** `emit_result` (`{"tool","status","data"}`) and `emit_finding` (nuclei-style, malformed — missing closing brace).

**`lib/scope_check.sh`:** **placeholder only** (logs "Scope check passed …"). No real membership test; not sourced by any stage script. Real OOS enforcement lives in Rust `pipeline/scope_check.rs`.

**`lib/llm_check.sh`:** health probe for Ollama. Args `MODEL_NAME` (default `vulnllm-r-7b`), `OLLAMA_URL` (default `http://localhost:11434`); checks `GET /api/tags`; emits `{"status":"ok","model","url"}` or `{"status":"error"|"missing_model",...}`.

| Script | Tool | Args | Stdout | Notable flags |
|---|---|---|---|---|
| stage1_passive/run_subfinder.sh | subfinder | DOMAIN, OUTPUT_DIR, THREADS=10 | pass-through `-json` | `-d -silent -json -t` |
| stage1_passive/run_amass.sh | amass | DOMAIN, OUTPUT_DIR | records re-read from `$OUTPUT_DIR/amass.json` | `enum -d -json -o` |
| stage1_passive/run_assetfinder.sh | assetfinder | DOMAIN | `{host, source:"assetfinder"}` | `--subs-only` |
| stage1_passive/run_crtsh.sh | curl+python | DOMAIN | `{host, source:"crtsh"}` deduped/sorted | `curl crt.sh/?q=%25.DOMAIN&output=json` |
| stage1_passive/run_gau.sh | gau | DOMAIN | `{url, source:"gau"}` | plain |
| stage1_passive/run_waybackurls.sh | waybackurls | DOMAIN | `{url, source:"wayback"}` | plain |
| stage1_passive/run_trufflehog.sh | trufflehog | DOMAIN, OUTPUT_DIR | pass-through `--json` | `filesystem <dir> --json` |
| stage2_validate/run_httpx.sh | httpx | SUBDOMAIN_FILE | pass-through `-json` | `-l -silent -json` |
| stage2_validate/run_naabu.sh | naabu | HOSTS_FILE | pass-through `-json` | `-list -silent -json` |
| stage2_validate/run_katana_passive.sh | katana | URL_LIST | pass-through `-jsonl` | `-list -silent -jsonl` (no `-crawl` = passive) |
| stage2_validate/run_gowitness.sh | gowitness | URL_LIST, OUTPUT_DIR | (usually empty) | `file -f <list> --destination <dir>/screenshots` |
| stage3_active/run_ffuf.sh | ffuf | URL, WORDLIST, OUTPUT_DIR(unused) | pass-through `-json` | `-u -w -json` |
| stage3_active/run_nmap.sh | nmap | HOSTS_FILE, OUTPUT_DIR | python transform of `nmap.xml`: `{host,hostname,ports:[{port,protocol,state,service}]}` | `-iL -oX <dir>/nmap.xml -v` |
| stage3_active/run_arjun.sh | arjun | URL | pass-through | `-u -oJ` |
| stage3_active/run_katana_active.sh | katana | URL_LIST | pass-through `-jsonl` | `-list -silent -jsonl -crawl` (active crawling) |
| stage3_active/run_kiterunner.sh | kiterunner/kr | URL, WORDLIST | pass-through | `scan <url> -w <wordlist> -json` |
| stage4_vuln/run_nuclei.sh | nuclei | URL_LIST, OUTPUT_DIR, TEMPLATES_DIR=`$HOME/nuclei-templates`, SEVERITY=`critical,high,medium,low,info` | pass-through `-jsonl` filtered to lines w/ `template-id` | `-l -t -severity -tags cve,rce,sqli,xss,lfi,ssrf,xxe,idor,exposure,misconfig,default-login,takeover -jsonl -silent` |
| stage4_vuln/run_nuclei_tech.sh | nuclei | URL_LIST, OUTPUT_DIR, TEMPLATES_DIR | same | `-l -t -tags tech -jsonl -silent` |
| stage4_vuln/run_wpscan.sh | wpscan | URL, OUTPUT_DIR(unused) | pass-through | `--url --format json` |
| stage4_vuln/run_testssl.sh | testssl | HOST, OUTPUT_DIR | lines from `$OUTPUT_DIR/testssl.json` | `--jsonfile <dir>/testssl.json <host>` |
| stage4_vuln/run_subjack.sh | subjack | SUBDOMAIN_LIST | pass-through | `-w -t 100 -timeout 30 -o /dev/stdout -ssl` |
| monitor/run_monitor.sh | comm/diff | TARGET, PREVIOUS_SCAN, CURRENT_SCAN | `{"change":"new"|"gone","host","target"}` | POSIX only; diffs sorted host lists |

---

## 8. Frontend — Next.js 14

### 8.1 Config
- **package.json** — Next 14.1.0, React 18, TypeScript 5, Tailwind 3.3. Key deps: `@tanstack/react-table` 8.11, `recharts` 2.12.7, `react-hook-form` 7.76 + zod 3.22, `@radix-ui/*` (dialog, dropdown-menu, select, tabs, toast, tooltip…), `@hello-pangea/dnd` 18, `vaul` 0.9, `lucide-react`, class-variance-authority, clsx, tailwind-merge, tailwindcss-animate. Scripts: `dev`/`build`/`start`/`lint`.
- **tsconfig** — strict, `moduleResolution: bundler`, path alias `@/* → ./*`.
- **tailwind.config.ts** — design tokens as CSS vars (`bg.base/surface/elevated/overlay/subtle`, `border/subtle/strong`, `text.primary/secondary/muted/subtle`, `primary/hover/muted/border`, `accent/hover/muted`, `severity.critical/high/medium/low/info`). Requires `@tailwindcss/typography` (**missing from package.json**).
- **next.config.js** — `reactStrictMode`, image domains `localhost` + `evidence.bountyos.local`.
- **components.json** — shadcn new-york, `rsc:false`, lucide icons, baseColor neutral. CSS path points to `styles/globals.css` (**stale; actual is `app/globals.css`**).

### 8.2 Design system (`app/globals.css`)
Dark-only palette on `:root`: base `#0a0c14`, surface `#0f1117`, elevated `#161b27`, overlay `#1e2335`, subtle `#252a3d`; primary violet `#7c6af7`, accent teal `#00c9a7`; severity critical `#f85149`, high `#e8912d`, medium `#58a6ff`, low `#3fb950`, info `#8b949e`. Component classes layer: `.card-base`, `.card-hover`, `.badge`, `.input-base`, `.nav-item`, `.tab-bar/.tab-item`, `.severity-dot-*`, `.pulse-dot`, `.skeleton`, `.glass`, `.table-header/.row`, `.progress-bar`, `.finding-stat-card`, `.modal-overlay`, `.custom-scrollbar`, markdown `.prose` overrides. Base font 13px; Geist/Inter via `next/font`.

### 8.3 Layout & components
- `app/(app)/layout.tsx` — 3-pane shell: collapsible `Sidebar` (desktop) / drawer (mobile), sticky 48px `TopBar`, right **resizable AssistantPanel** (280–480px, drag handle, `Ctrl/Cmd+B` toggles sidebar, mobile FAB). Content `p-6 max-w-[1600px] mx-auto`.
- **Sidebar** — logo, nav groups *Workspace* (Dashboard, Projects, Programs, Findings, Gallery) + *Pipeline* (Jobs, Monitor), pinned Settings + Hunters; `usePathname()` active states; collapse to 56px.
- **TopBar** — `Ctrl/Cmd+K` command palette (mock data), "All systems nominal" pill, mock notifications dropdown, user menu (mock "Admin / admin@bountyos").
- **AssistantPanel** — two tabs:
  1. **Report Builder** (mostly cosmetic): platform selector (HackerOne/Bugcrowd/Intigriti/Synack/Generic) + 7 actions (Draft Full Report, Impact Statement, Reproduction Steps, CVSS Calculator, Remediation, Similar in DB, Export for Platform) → placeholder mono "Generating…" output.
  2. **AI Triage** (real API): `GET /api/findings/:id/triage` (404 = untriaged), `POST` triggers local inference, polls GET every 5s up to 30× (150s). Renders `TriageData` via `TriageBadge`, escalate callout, reasoning card, evidence chips, checkable verification checklist, evidence-gap warnings, re-triage. Uses relative `/api/...` (Next proxy) not `NEXT_PUBLIC_API_URL`.
- **NewThemeProvider** — passthrough to `next-themes` ThemeProvider (`attribute="class"`, `defaultTheme="system"`); palette is dark-only so switching is cosmetic.
- **ChatPanel** — unused floating stub referencing stale shadcn classes.

### 8.4 API wrapper & hooks
- **`lib/api.ts`** — single `request<T>()`: base = `NEXT_PUBLIC_API_URL || '/api'`, `Authorization: Bearer <access_token>` from localStorage, throws on `!res.ok`. Exposes typed endpoints: `login/logout/me/2fa-setup/2fa-verify`, projects CRUD + stats, programs list/detail/create/approve/scan, findings list/get/claim/validate, jobs list/cancel, hunters list, tokens list/create/delete.
- **`lib/auth.ts`** — `getToken/getRefreshToken/setTokens/clearTokens`, `isAuthenticated()` (decodes JWT `exp`), `getUser()`, `setupInterceptors()` (refreshes within 60s of expiry; **never wired**).
- **`lib/types.ts`** — TS models: Hunter, Project(+stats), Program(+stats), ScopeTarget, Subdomain, Port, DiscoveredUrl, Finding, ScanJob, ProjectNote, Alert, PaginatedResponse.
- **Hooks:** `useAuth` (AuthProvider context: user/loading/login/logout/isAdmin), `useWebSocket` (jobId → `ws://host/ws/jobs/{id}`, log collection), `useFindings/usePrograms/useProjects` (API CRUD wrappers), `useToast` (Radix toast store). **None of the data hooks are mounted by current pages** → pages render mock local state.

### 8.5 Pages (route inventory)

Auth:
- `/` → client redirect to `/projects`
- `/login` — user/pass form → stores `"token"` (legacy key), redirect `/dashboard`
- `/2fa` — 6-box OTP auto-advance → `POST /api/auth/2fa` → stores `"token"`
- `/setup` — 3-step wizard (Account → 2FA → Done), fake verify, writes `"setup-token"`

App (all mock-driven except triage):
- `/dashboard` — 5 stat cards, severity donut + findings AreaChart (recharts), Active Scans w/ progress, Recent Activity feed, quick actions. No API.
- `/projects` — card grid (All/Active/Archived), severity breakdown, funnel counts.
- `/projects/[projectId]` — overview: stats, Finding Funnel, top unsubmitted, activity, quick actions.
- `/projects/[projectId]/programs|notes|team|timeline` — mock CRUD lists; notes use `crypto.randomUUID()`; timeline filterable (program_added/scan_started/scan_complete/finding_discovered/submitted/bounty_received).
- `/programs` — program card grid + New Program.
- `/programs/[id]` — header + Scan Now dropdown, approval-gate banner concept, 5 tabs (Overview live-ish; Scope/Recon/Findings/Reports render placeholder in this page — real subroutes below).
- `/programs/[id]/scope` — ScopeEditor in/out-of-scope tables, type icons, add form, bulk Upload, delete/export.
- `/programs/[id]/recon` — Subdomains/Ports/URLs/Screenshots sub-tabs (Servable tables + grid).
- `/programs/[id]/findings` — program-scoped table, severity/status counters, bulk actions.
- `/programs/[id]/reports` — report list + builder modal (template defs: h1/bugcrowd/intigriti/synack/generic).
- `/findings` — global table + filter sidebar (search, severity/status checkboxes, chips), bulk actions (mock).
- `/findings/[id]` — breadcrumb, severity/status badges, action buttons, 4 tabs (Details/Evidence `<pre>` blocks/Notes/History), right rail Report Builder + Finding Context.
- `/gallery` — screenshot grid + lightbox (prev/next/counter), program filter.
- `/jobs` — jobs table, status filter tabs, expandable rows w/ static terminal lines.
- `/hunters` — hunter table (role badges, 2FA, active toggle) + Add Hunter modal.
- `/settings` hub → `/settings/tools` (tool inventory health), `/settings/wordlists`, `/settings/alerts` (Discord/Slack/SMTP), `/settings/schedule` (rescan slider, quiet hours), `/settings/tokens` (fake `bos_` token generation client-side), `/settings/security` (password/2FA/sessions) — **all mock**, no API.

### 8.6 Key components
- **findings**: `FindingsTable`, `FindingDetail`, `EvidenceViewer` (request/response/curl), `CvssCalculator`, `SeverityBadge`, `StatusBadge`, `TriageBadge` (real, used by AssistantPanel).
- **projects**: `ProjectCard`, `ProjectForm`, `ProjectOverview`, `ProjectNotes` (markdown read/edit/delete), `ProjectTimeline`, kanban (`KanbanBoard/Column/Card` via @hello-pangea/dnd).
- **programs**: `ProgramCard`, `ProgramForm`, `ScopeEditor`, `PipelineStatus`, `ApprovalGateBanner`.
- **recon**: `SubdomainTable`, `PortMap`, `UrlTable`, `ScreenshotGrid`, `LiveLog` (WebSocket terminal w/ ANSI strip + auto-scroll).
- **reports**: `ReportBuilder` (template markdown generator), `ReportPreview`.
- **ui**: shadcn new-york set + custom `code-block`, `markdown-editor`, `terminal`, toast/toaster.

### 8.7 Current auth reality (two inconsistent flows)
1. **Modern** (`api.ts`+`auth.ts`+`AuthProvider`): access+refresh in localStorage, JWT exp check, refresh path via `setupInterceptors` — **declared but never mounted/wired**.
2. **Legacy** (actually used by auth pages): `fetch("/api/auth/*")` returning `data.token` stored under key `"token"` — **mismatches** `api.ts` which reads `access_token`. No route guards exist; protected routes render regardless.

---

## 9. Infrastructure

### 9.1 docker-compose.yml (prod)
Services: **postgres** (postgres:15-alpine, `bountyos/bountyos` db-user, `DB_PASSWORD` via env, healthcheck pg_isready, named volume `postgres_data`), **redis** (redis:7-alpine, `--requirepass ${REDIS_PASSWORD}`, volume `redis_data`), **server** (Dockerfile `crates/bountyos-server/Dockerfile`, `DATABASE_URL`/`REDIS_URL`/`JWT_SECRET`/`FIRST_RUN` env, mounts `./evidence:/app/evidence`, `./scripts:/app/scripts:ro`, `./config:/app/config:ro`, `./logs:/app/logs`, port 8000), **frontend** (build `./frontend`, `NEXT_PUBLIC_API_URL=/api`, `NEXT_PUBLIC_WS_URL=/ws`, port 3000), **nginx** (nginx:alpine, 443+80, mounts nginx.conf + ssl + `./evidence:/var/www/evidence:ro`).

### 9.2 docker-compose.dev.yml
`extends:` prod services; server runs `cargo watch -x run` w/ `RUST_LOG=debug` and source mounted; frontend `npm run dev` with absolute URLs (`http://localhost:8000/api`, `ws://localhost:8000/ws`) and `./frontend:/app` + anonymous `node_modules` volume.

### 9.3 nginx/nginx.conf
- HTTP 80 → 301 HTTPS; HTTPS 443 (`TLSv1.2/1.3`, pinned GCM suite), HSTS/CSP/X-Frame-Options/X-Content-Type-Options.
- `server_name bounty.os`, self-signed `nginx.crt`/`nginx.key`.
- Proxies: `/` → frontend:3000, `/api` → server:8000, `/ws` → server:8000 (WebSocket upgrade headers), `/evidence` → `/var/www/evidence` (alias, 30d cache).

### 9.4 Makefile
`build` (cargo release), `run`/`stop`/`logs` (docker-compose), `migrate`/`seed` (`cargo run --bin bountyos-server`), `clean`, `fmt`, `check`, `clippy -D warnings`, `generate-certs`/`install-tools` (reference `scripts/utils/*` which **do not exist**), `setup` (cp .env.example).

### 9.5 .env.example
`DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `FIRST_RUN=true`, `RUST_LOG=info`, `NEXT_PUBLIC_API_URL=/api`, `NEXT_PUBLIC_WS_URL=/ws`.

### 9.6 Config files
- `config/config.toml` — `[database] url` (env-substring `${DB_PASSWORD}`), `[redis] url`, `[auth] jwt_secret, access_token_expiry_minutes=15, refresh_token_expiry_days=7, argon2_memory=65536, iterations=3, parallelism=1`, `[server] host 0.0.0.0, port 8000, first_run`, `[rate_limiting] 200/min, login 5/15min`, `[evidence] base_path ./evidence`.
- `config/config.yaml` — same values + `[llm] enabled=false, ollama_url, model=vulnllm-r-7b, timeout_secs=120` (actually read by `config.rs`).

### 9.7 Evidence layout (design)
`evidence/{project_slug}/{program_slug}/{subdomain}/{stage1_passive|stage2_validate|stage3_active|stage4_vuln|screenshots|reports}/…`. Currently empty (`.gitkeep`).

---

## 10. Implementation Status

| Area | Status |
|---|---|
| Cargo workspace + common types | ✅ |
| DB pool, Redis pool, config loading | ✅ |
| Migrations 001–011 | ✅ (012 not in runner) |
| Auth (argon2, JWT, TOTP, refresh rotation, Redis blacklist) | ✅ handlers exist; middleware not wired |
| Router + full route table | ✅ declared (some handlers missing) |
| Programs/Projects CRUD handlers | ✅ (created_by placeholder) |
| Findings handlers | ⚠️ only triage + read-triage; rest 501 |
| Jobs, hunters, scope, subdomains, ports, urls, reports, settings, tokens handlers | ❌ 501 stubs |
| Static evidence serving | ❌ 404 stub |
| Alert senders (Discord/Slack/Email) | ✅ (email stub) |
| LLM triage pipeline (Ollama/VulnLLM-R-7B) | ✅ implemented, disabled by default |
| Pipeline runner + parsers (subfinder/gau/httpx/naabu/nmap/nuclei) | ✅ |
| Redis job queue + scheduler + scope check | ✅ logic; references outdated AppState fields |
| Bash scripts (all 21) | ✅ consistent NDJSON contract; scope_check.sh is a placeholder |
| CLI | ✅ all command trees; several endpoints not present in server router |
| Next.js shell + design system + all pages/components | ✅ UI built; **data is mock** |
| Frontend↔API integration | ❌ auth flow mismatched, hooks not mounted, mock pages |
| WebSocket live job logs | ✅ hook + LiveLog terminal + ws handler (unfiltered) |
| Docker stack / nginx | ✅ compose files + nginx conf (crate compiles note: server depends on Cargo workspace) |

---

## 11. Known Inconsistencies & Gotchas

1. **Three-way schema drift** — model DTOs (design-spec shape), migration SQL, and pipeline code disagree on columns for subdomains (tech→tech_stack, cdn_name→cdn/cdn_provider), urls (no program_id/params in migration), ports (no program_id/ip/state in DTO), scan_jobs (missing subdomain_id/target/flags/error_log/started_at), scope (`target`+`out_of_scope` vs `target_value`+`in_scope`).
2. **Dead module references** — `auth/middleware.rs` → `models::session::Session` (missing); `scheduler.rs`/`queue.rs` → `models::scan_job::ScanJob`/`ScanStage` (missing), and use `app_state.db`/`app_state.redis` (state has `db_pool`/`redis_pool`). **The crate as committed likely does not compile.**
3. **Middleware not wired** — auth/audit/rate-limit layers are defined but never applied in `app.rs`; `CorsLayer::permissive()` is applied.
4. **Auth extension type mismatch** — middleware inserts a `String`; handlers/extractors read `Uuid`.
5. **Migration 012 omitted** from `MIGRATIONS` array.
6. **Frontend auth contract mismatch** — pages write `localStorage.token`, `api.ts` reads `access_token`; `AuthProvider`/`setupInterceptors`/route guards unused; two `POST /api/auth/*` conventions.
7. **`@tailwindcss/typography`** required by tailwind.config but absent from package.json → build failure; `components.json` CSS path stale.
8. **Program/project create** use `Uuid::new_v4()` as `created_by`.
9. **`scripts/utils/` referenced by Makefile targets but doesn't exist** (install-tools, generate-certs).
10. **CLI endpoint mismatches** — CLI calls `/api/scan`, `/api/jobs/{id}/logs`, `/api/monitor/*`, `/api/programs/approve`, `/api/programs?project_id=` etc. which the server router does not expose.
11. **WS handler** relays all broadcast messages regardless of `/ws/jobs/:id` job filter.
12. **`config.yaml` and `config.toml` duplicate** config; `load_config` reads only the YAML.
13. Duplicate `RedisPool` type alias in `redis.rs` and `state.rs`; `static_files` evidence endpoint always 404; audit middleware column-name mismatch (`resource`/`detail` vs `resource_type`/`details`).

---

## 12. Vendored Tools (`tools/`)

Git worktrees/clones of third-party security tools bundled for offline operation and reproducibility:

- **httpx** — subdomain/URL probing (title, status, tech, CDN)
- **subfinder** — passive subdomain discovery (own .git; 100+ source adapters)
- **waybackurls** — archived URL fetching (own .git)
- **gau** — URL scraping from archive sources
- **nuclei** + **nuclei-templates** — vuln template engine + the full template/network/ssl/workflow/profile libraries
- **naabu, dnsx, ffuf, katana, dalfox** — port scan, DNS resolve, content fuzzing, crawler, XSS checker

These are the binaries the `scripts/stage*` wrappers invoke; the bundled clone of `nuclei-templates` under `$HOME/nuclei-templates` is the default for `run_nuclei.sh`.

---

*Generated by reading the full working tree. See `bounty-os.md` for the locked v3.0 design spec and `README.md` for quick start.*