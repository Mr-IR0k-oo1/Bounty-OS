# Known Issues

Maintained. Facts verified from repository reads and BOUNTY-FRONTEND-002 validation (2026-09-20). Full task report: `development/sessions/20260920T100516Z-frontend-002.md`.

## Frontend

1. **All pages are mock-driven.** No page calls the real backend except the (now unmounted) AssistantPanel AI Triage tab. Known and intentional until backend wiring ticket.
2. **Auth contract mismatch.** Pages write `localStorage.token`; `lib/api.ts`/`lib/auth.ts` expect `access_token`/`refresh_token`. `POST /api/auth/refresh` body expectations differ between interceptor (JSON) and backend handler (raw). Two flows coexist; route guards are not enforced.
3. **AssistantPanel unmounted (BOUNTY-FRONTEND-002).** Removed from `app/(app)/layout.tsx` on request; `components/layout/AssistantPanel.tsx` still exists (dead). Its AI Triage tab was the only real-API surface — now disabled.
4. **`ProjectCard.tsx` is dead code.** Zero imports; nav href fixed from `/projects/{slug}/kanban` to `/projects/{slug}`.
5. **6 ESLint warnings (pre-existing).** `jsx-a11y/alt-text` (recon page), `@next/next/no-img-element` (`setup`, `ScreenshotGrid`).
6. **Severity utility classes don't map.** Pages use `bg-critical`, `text-critical`, `border-critical/30` etc., but `tailwind.config.ts` only defines `severity.{critical,high,medium,low,info}` — these classes are silently not generated, so some severity badge colors may not render. Pre-existing; needs a config naming fix or class migration.
7. **`bun install` blocks one postinstall** (bun sandbox "Blocked 1 postinstall"). Didn't affect install/lint/typecheck/build. Run `bun pm untrusted` to review.
8. **Uncommitted working-tree changes not from task work:** `app/globals.css` and `public/bg.png`.
9. **components.json `tailwind.css` path is stale** (`styles/globals.css` vs actual `app/globals.css`). Cosmetic for shadcn tooling only.
10. **`next.config.js` uses `env:`** to inline `NEXT_PUBLIC_*` — works, but redundant with Next's automatic `NEXT_PUBLIC_` exposure.

## Backend / cross-stack (from PROJECT-DETAILS.md §11, not re-verified here)

- Three-way schema drift between model DTOs, migrations, and pipeline code.
- Dead module references (`auth/middleware.rs` -> missing `Session`; `scheduler.rs`/`queue.rs` -> missing `ScanJob`/`ScanStage`, outdated `AppState` fields) — **the crate likely does not compile as committed**.
- Auth/audit/rate-limit middleware defined but not wired; auth extension type mismatch (String vs Uuid).
- Migration 012 (LLM triage) omitted from the migrations runner list.
- Many handlers are 501 stubs (jobs, hunters, scope, subdomains, ports, urls, reports, settings, tokens, findings).
- Evidence static serving always 404; WS relays all messages unfiltered; config duplication (YAML vs TOML).

## Resolution rule

Only resolve items that are actionable in current scope; anything requiring backend changes is deferred to backend wiring tasks.