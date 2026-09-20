# Project Context

Status: maintained. Facts verified from the repository working tree and command output on 2026-09-20. See `development/sessions/` for per-task session reports.

## What BountyOS is

BountyOS is a self-hosted bug bounty program management platform. Rust (Axum) backend orchestrates open-source recon/vuln tools against in-scope targets; a Next.js 14 frontend provides the operator UI. See `PROJECT-DETAILS.md` and `bounty-os.md` for the full spec.

## Repo layout (top level)

- `crates/` — `bountyos-server`, `bountyos-cli`, `bountyos-common` (Rust workspace, Cargo.toml at root).
- `frontend/` — Next.js 14 App Router app (this project's UI surface).
- `scripts/` — bash tool orchestrators (stage1..4, monitor) emitting NDJSON on stdout, logs on stderr.
- `config/` — `config.toml` and `config.yaml` (only YAML is actually read by `config.rs`).
- `evidence/` — bind-mounted raw tool output (currently empty `./.gitkeep`).
- `nginx/` — reverse proxy config + self-signed certs.
- `tools/` — vendored security tool binaries/templates.
- `development/sessions/` — per-task session reports (started with BOUNTY-FRONTEND-002).

## Frontend at a glance

- Next.js 14.1.0, React 18, TypeScript strict, Tailwind 3.3, Bun package manager.
- App Router with two route groups: `(auth)` (login/2fa/setup) and `(app)` (authenticated shell: Sidebar + TopBar + content). ~30 page routes.
- Design tokens in `app/globals.css`; themes map colors in `tailwind.config.ts` (violet primary `#7c6af7`, teal accent `#00c9a7`, severity colors critical `#f85149` / high `#e8912d` / medium `#58a6ff` / low `#3fb950` / info `#8b949e`).
- **All pages are mock-driven** — local `useState` + static arrays; no backend data except the AssistantPanel AI Triage tab (now unmounted, see `known-issues.md`).
- The right-hand AssistantPanel was removed from `app/(app)/layout.tsx` during BOUNTY-FRONTEND-002 at engineer request; component file remains unused.

## Historical commits (HEAD)

- `9be9346` "ui update" — added `.eslintrc.json` and the `/monitor` page among other UI work.
- `013e221` "feat: scaffold frontend application ..."
- `9948ca1` "feat: integrate LLM vulnerability triage ..."
- `83bc722`, `dbc853e` — earlier.

Facts that changed during BOUNTY-FRONTEND-002: `eslint`/`eslint-config-next` devDeps added, `typecheck` script added, phantom `module` field removed, monitor page enhanced (loading/error states), AssistantPanel unmounted. See `current-state.md`.