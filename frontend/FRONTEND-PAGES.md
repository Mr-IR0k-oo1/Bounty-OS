# BountyOS Frontend — Page Guide & App Reference

A complete reference to everything in the **BountyOS Next.js 14 frontend**: every route, what each page does, what it contains, which components it uses, and what is wired vs. mock.

> **Heads-up:** This is a **fully built UI shell (product mock)**. All pages render hard-coded client state or static arrays — none call the real Rust `bountyos-server` API. Details are captured in "Implementation status" and "Known gotchas" at the end.

---

## Table of Contents

1. [Stack & Setup](#1-stack--setup)
2. [App Shell & Navigation](#2-app-shell--navigation)
3. [Layout & Design System](#3-layout--design-system)
4. [Auth Pages](#4-auth-pages)
5. [Dashboard](#5-dashboard)
6. [Projects](#6-projects)
7. [Programs / Programs Tabs](#7-programs)
8. [Findings](#8-findings)
9. [Gallery](#9-gallery)
10. [Hunters](#10-hunters)
11. [Jobs & Monitor](#11-jobs--monitor)
12. [Settings](#12-settings)
13. [Shared & UI Components](#13-shared--ui-components)
14. [Data Layer, Hooks & Types](#14-data-layer-hooks--types)
15. [Implementation Status](#15-implementation-status)
16. [Known Issues & Gotchas](#16-known-issues--gotchas)

---

## 1. Stack & Setup

- **Framework:** Next.js 14.1.0 (App Router), React 18, TypeScript 5 (strict), Tailwind CSS 3.3.
- **Key deps:** `@tanstack/react-table`, `recharts`, `react-hook-form` + `zod`, Radix UI (dialog, dropdown-menu, select, tabs, toast, tooltip, ...), `@hello-pangea/dnd` (kanban), `vaul` (drawer), `sonner` (toasts), `lucide-react`, `tailwind-merge`, `clsx`.
- **Package manager:** Bun — `bun dev` / `bun build` / `bun start`.
- **Env:** `NEXT_PUBLIC_API_URL=/api` (default), `NEXT_PUBLIC_WS_URL=/ws`.
- **Path alias:** `@/* → ./*` (e.g. `@/components/ui/button`).

**Quick start**
```bash
bun install
bun dev        # http://localhost:3000
bun build      # production build
bun start      # run production build
```

---

## 2. App Shell & Navigation

Two route groups:
- **`(app)`** — the authenticated 3-pane product shell (everything below).
- **`(auth)`** — standalone centered-card pages (login / 2FA / setup), no shell.

### Root layout — `app/layout.tsx`
- Loads **Inter** via `next/font/google`, wraps every page in a dark-only `ThemeProvider` (`defaultTheme="dark"`, `forcedTheme="dark"`) and mounts `<Toaster />` (sonner). `suppressHydrationWarning` on `<html>`.

### App layout — `app/(app)/layout.tsx` (the 3-pane shell)
A client component that composes four regions:

1. **Sidebar** — desktop collapsible rail / mobile drawer overlay.
   - `Ctrl/Cmd+B` toggles it; collapses to a 56px icon rail with tooltip flyouts; mobile slides in as an overlay.
2. **TopBar** — fixed 48px header: sidebar toggle, breadcrumb/context, global search, system-status pill, notifications, user menu (see §13).
3. **Main content** — `p-6 max-w-[1600px] mx-auto`, scrollable.
4. **AssistantPanel** — right resizable panel (280–480px width, drag handle, `Ctrl/Cmd+B` toggles sidebar only on desktop; mobile FAB). Two tabs: **Report Builder** (cosmetic) + **AI Triage** (real-ish API). See §13.

---

## 3. Layout & Design System

### Components shell
- **Sidebar** (`components/layout/`) — BountyOS logo block, nav sections **Workspace** (Dashboard, Projects, Programs, Findings, Gallery) + **Pipeline** (Jobs, Monitor), bottom-pinned Settings + Hunters. Active states from `usePathname`. Collapse toggle + "system status" footer (live-pulse dot, ops dashboard, active count).
- **TopBar** — search button (`Ctrl/Cmd+K` command palette), system-status live pill, notifications dropdown (mock), user menu (mock "Admin / admin@bountyos").
- **AssistantPanel** — collapsible right panel; see §13.1.

### Design tokens (`app/globals.css`, dark-only)
Base `#0a0c14`, surface `#0f1117`, elevated `#161b27`, overlay `#1e2335`, subtle `#252a3d`; primary violet `#7c6af7`, accent teal `#00c9a7`; severity critical `#f85149`, high `#e8912d`, medium `#58a6ff`, low `#3fb950`, info `#8b949e`. Component classes (`card`, `badge`, `btn-*`, `input-base`, `severity-dot-*`, `finding-stat-card`, `modal-overlay`, markdown `.prose`, custom-scrollbar). Base font 13px.

---

## 4. Auth Pages

### `/login`
- Client form: username + password (show/hide toggle). On submit `POST /api/auth/login` → if `requires_2fa` redirect to `/2fa`, else store `data.token` in `localStorage` under `"token"` and push to `/dashboard`. Shows inline error + loading state.

### `/2fa`
- 6-box OTP entry with auto-advance, backspace-navigation and paste support. Posts `/api/auth/2fa`, stores `data.token`, redirects to `/dashboard`.

### `/setup`
- **3-step wizard: Account → 2FA → Done.**
  - *Account step:* username, display name, password, confirm (match validation) → `POST /api/auth/setup` → receives QR code URL + secret.
  - *2fa step:* renders QR placeholder image (falls back to "QR Code Placeholder") + copyable TOTP secret + copy button; "I have scanned the code" → Done.
  - *Done step:* "Setup Complete" → writes `setup-token` to localStorage → push `/dashboard`.

---

## 5. Dashboard

### `/dashboard`
- **Hero stat card:** Open findings total + stacked severity progress bars (critical/high/medium/low/info).
- **Compact stat cards (4):** Active Projects, Programs, New Findings (24h), Submitted This Week — icon, trend arrow, change badge.
- **Charts (recharts):**
  - *Findings Over Time* — stacked `AreaChart` by severity with custom tooltip + range selector.
  - *Severity Breakdown* — donut `PieChart` with hover-highlight + center total + legend.
- **Active Scans:** live job list w/ animated progress, program, stage, tool, elapsed, cancel.
- **Recent Activity:** color-coded feed + quick actions (New Project / New Program / Unassigned Triage).

---

## 6. Projects

### `/projects`
- **Status filter tabs:** All / Active / Archived.
- **Card grid** — each project: name, status badge, programs count, findings severity split bar (C/H/M/L), new/triaged/validated counts, hunters, start–end dates, hover "View" affordance. Links to `/projects/[projectId]`.

### `/projects/[projectId]` (Project overview)
- Header w/ name + status badge + Edit/Archive buttons; breadcrumb to Projects.
- **Tab bar:** Overview / Programs / Notes / Team / Timeline (visual tabs — content switches below).
- **Overview content:** stat cards (Programs, Findings by severity, Hunters), Finding Funnel (Total → Validated → Submitted → Accepted → Bounty Paid), Top Unsubmitted Findings, Program cards, Recent Activity, Quick Actions.

### `/projects/[projectId]/programs`
- Breadcrumb (Project / Programs), "New Program" button.
- **Program grid** — cards w/ name + platform badge + status badge, targets count, last scan time. Links to `/programs/[id]`.

### `/projects/[projectId]/notes`
- **Markdown notes app:**
  - Left **note list** w/ title + tag chips, tag filter, per-note delete.
  - Main **editor:** title input, tag select, Markdown textarea, auto-save indicator + Save button.
  - "New Note" adds a note with a generated id.

### `/projects/[projectId]/team`
- **Hunters/team table:** avatar initials, username, display name, role badge, 2FA status, last login, active toggle, "Add Hunter" + "Assign Hunter" modal (mock).

### `/projects/[projectId]/timeline`
- **Project event timeline:**
  - **Filters:** type (Program Added/Scan Started/Scan Complete/Finding Discovered/Submitted/Bounty Received), severity, hunter.
  - Vertical timeline of events (icon, label, severity dot, description, user, time). Empty-state card when filtered out.

---

## 7. Programs

### `/programs`
- **Program grid** with **tabs:** All / Active / Archived.
- Each card: name, platform badge (HackerOne/Bugcrowd), status badge, targets count, last scan. "Programs" header + New Program action.

### `/programs/[id]` (detail)
- **Header:** logo tile, name, platform badge, status (Active badge), program URL, Scan Now dropdown (Stage 1–4 / Full Pipeline), Edit.
- **Approval-gate banner** shown until the program is "approved" — blocks active stages 3 & 4.
- **Tabs:** Overview / Scope / Recon / Findings / Reports (inline tab bar — live pages live under the subroutes below).

### `/programs/[id]/scope`
- **Scope editor:** In-Scope and Out-of-Scope target tables — type icon (domain/ip/url/cidr), target, added-by, added date, delete. Add-Target inline forms (type select + target + notes) + Import/Export (mock local state).

### `/programs/[id]/recon`
- **Recon workstation** with 4 sub-tabs:
  - **Subdomains** — table: subdomain, IP, status, title, tech badges, alive dot.
  - **Ports** — per-host group: port, service, version, status.
  - **URLs** — method, status, source, external link.
  - **Screenshots** — grid with filter + lightbox (prev/next/counter) mock.
- Sidebar: search + {Tech, Status, Alive} filters.

### `/programs/[id]/findings`
- Program-scoped **findings** table w/ filter sidebar (severity + status checkboxes, search, status chips), severity/status tab filters, "Assign to me", bulk actions (Export). Rows: severity, title, host, status, program, hunter, date.

### `/programs/[id]/reports`
- **Reports list** + Report Generator modal:
  - Generator: select findings chips + template (Recon Summary / Vulnerability Report / Compliance).
  - Report list: title, template badge, findings count, created date, Preview/Download actions.

---

## 8. Findings

### `/findings`
- **Global findings registry:**
  - **Sidebar filters:** search, severity + status checkboxes, active filter chips + clear-all.
  - **Toolbar:** Assign to me, Mark FP, Export CSV.
  - **Table:** severity badge, title, host, status, program, hunter, date. Mock data (SSRF, SQLi, XSS...).

### `/findings/[id]`
- **Finding detail workspace:**
  - Header: severity badge, title, host, status badge.
  - **Tabs:** Details / Evidence / Notes / History.
  - **Details:** description, severity rationale, CVSS, tool/template, discovered date, severity dots.
  - **Evidence:** Request/Response `<pre>` blocks with copy.
  - **Notes:** notes textarea w/ markdown (mock).
  - **History:** finding event table (created, assigned, validated, submitted...).
  - **Right rail:** Quick Actions, Report Builder, Finding Context.

---

## 9. Gallery

### `/gallery`
- **Screenshot gallery:**
  - Program filter `Select` + "More Filters" button.
  - **Grid of screenshot cards** (label, program badge, date) — Uber/Airbnb/Twitter/Shopify/Dropbox mocks.
  - **Lightbox modal:** fullscreen w/ prev/next navigation + counter, image placeholder, program badges. Click anywhere to close.

---

## 10. Hunters

### `/hunters`
- **Hunters management:**
  - **Add Hunter** modal: username, display name, role, temp password, Add.
  - **Table:** hunter avatar, username, display name, role badge (admin/hunter/viewer), 2FA status, last login, active toggle + deactivate, edit/more actions.

---

## 11. Jobs & Monitor

### `/jobs`
- **Scan/schedule jobs table:**
  - **Filter tabs:** All / Running / Queued / Done / Failed.
  - **Columns:** status, program, stage, tool, started, duration, findings, actions.
  - Expandable rows → inline **job log / terminal preview** w/ status colors + cancel actions (mock).

*(Monitor `/monitor` route is referenced in the sidebar with a placeholder/mock live-terminal design; see PROJECT-DETAILS.md §10.)*

---

## 12. Settings

### `/settings` (hub)
- Grid of **section cards,** each linking to a sub-page: Tools, Wordlists, Alerts, Schedule, Tokens, Security.

### `/settings/tokens`
- **API token management:**
  - Tokens table (name, created, last used, expires, status, revoke).
  - **Generate modal:** name → generates a mock `bos_…` token; show/hide + copy; "you won't see it again" notice.

### `/settings/alerts`
- **Alert configuration (mock):**
  - **Discord webhooks** per severity level (with Test buttons).
  - **Slack webhooks** per severity (with Test buttons).
  - **Email (SMTP):** host, port, username, password, from address + Test.

### `/settings/schedule`
- **Scan scheduling (mock):**
  - "Global Rescan Interval" slider (1–72h) driving a per-program interval list + quiet hours (start/end time inputs) + program interval overrides table.

### `/settings/security`
- **Account security:**
  - **Change password** form.
  - **Two-factor authentication:** enable/setup flow with QR placeholder + 6-digit verify + backup codes grid with copy-to-clipboard.
  - **Active sessions** table (device, IP, last active, revoke).

---

## 13. Shared & UI Components

### `components/ui/`
Primitives: `button`, `card`, `input`, `textarea`, `label`, `checkbox`, `select`, `badge`, `dialog`, `card`, `toast`/`toaster`. (Full set is shadcn-style; see package.json deps.)

### `components/layout/`
- **Sidebar / TopBar / AssistantPanel** — the shell pieces described in §2–3.
- **NewThemeProvider** — passthrough to `next-themes` ThemeProvider (dark-only, cosmetic switching).

### `components/findings/`
- `FindingsTable`, `FindingDetail`, `EvidenceViewer`, `CvssCalculator`, `SeverityBadge`, `StatusBadge`, `TriageBadge`.

### `components/projects/`
- `ProjectCard`, `ProjectForm`, `ProjectOverview`, `ProjectNotes`, `ProjectTimeline`, (kanban: `KanbanBoard/Column/Card`).

### `components/programs/`
- `ProgramCard`, `ProgramForm`, `ScopeEditor`, `ApprovalGateBanner`, `PipelineStatus`.

### `components/recon/`
- `SubdomainTable`, `PortMap`, `UrlTable`, `ScreenshotGrid`, `LiveLog` (WebSocket log w/ ANSI color + auto-scroll).

### `components/reports/`
- `ReportBuilder`, `ReportPreview`.

---

## 14. Data Layer, Hooks & Types

- **`lib/types.ts`** — TS models: `Hunter`, `Project`, `Program`, `ScopeTarget`, `Subdomain`, `Port`, `DiscoveredUrl`, `Finding`, `ScanJob`, `ProjectNote`, `Alert`, `PaginatedResponse`, plus severity/status constants.
- **`lib/api.ts`** — `request<T>()` wrapper (Bearer token from localStorage) with typed endpoint helpers: auth, projects/programs CRUD, findings, jobs, hunters, tokens, settings.
- **`lib/auth.ts`** — token helpers + `setupInterceptors()` (payload refresh rotation) + `isAuthenticated()`.
- **Hooks** — `useAuth` (AuthProvider), `useWebSocket` (job logs via WS), `useFindings`/`usePrograms`/`useProjects` (API CRUD wrappers), `useToast`. **Note:** data hooks exist but current pages render mock local state rather than wiring them.
- **`components.json` + tailwind config** — shadcn new-york setup; `tailwind.config.ts` references `@tailwindcss/typography` (see gotchas).

---

## 15. Implementation Status

| Area | Status |
|---|---|
| Auth pages (login / 2FA / setup) | ✅ built, legacy `localStorage.token` flow |
| Dashboard, Projects, Programs, Findings, Gallery, Hunters, Jobs, Settings | ✅ built — **all mock data** |
| Data hooks (`useFindings`/`usePrograms`/`useProjects`) | ✅ defined, ❌ not mounted by pages |
| `api.ts` + `auth.ts` interceptors | ✅ defined, ❌ not wired |
| Live WebSocket logs (`LiveLog`, `useWebSocket`) | ✅ implemented (terminal view + ws handler) |
| Real backend integration | ❌ none — pages are self-contained mocks |
| Assistant AI Triage panel | ⚠️ Report Builder cosmetic; AI Triage tab hits real `/api` endpoints |
| Route guards / protected routes | ❌ declared but not enforced |

---

## 16. Known Issues & Gotchas

1. **All pages are mock-driven** — every page uses local `useState` + static arrays; no API data fetching wired into pages.
2. **Auth contract mismatch** — pages read/write `localStorage.token` (legacy), while `api.ts`/`AuthProvider` expect `access_token`. Two parallel auth flows coexist; neither is fully wired.
3. **`@tailwindcss/typography`** referenced by `tailwind.config.ts` but absent from `package.json` → build may fail; `components.json` CSS path is stale.
4. **Routes guarded but not enforced** — protected routes render regardless of auth state.
5. **Evidence/static serving** is a 404 stub on the server; screenshots are placeholders.
6. **AssistantPanel** shows "Sign in to BountyOS" context + mock report builder; only the AI Triage tab calls real endpoints (`/api/findings/:id/triage`).

---

*Generated by reading the BountyOS frontend working tree. Backend/design spec is captured in the repo-root `PROJECT-DETAILS.md` / `bounty-os.md`.*
