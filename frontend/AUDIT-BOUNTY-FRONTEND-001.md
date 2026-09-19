# Task: BOUNTY-FRONTEND-001 — Frontend Audit Report

## 1. Executive Summary & Objective

An exhaustive audit of the BountyOS Next.js 14 frontend was conducted in accordance with **Task: BOUNTY-FRONTEND-001**.
The audit verified the real repository state against specification documents, validated all 29 routes, tested all required commands (`bun install`, `bun run lint`, `bun run typecheck`, `bun run build`), inventoried components, identified auth/routing/dependency discrepancies, catalogued mock data usage, and established a prioritized remediation roadmap.

---

## 2. Source of Truth File Verification

Per the task requirements, the specified source files were verified directly on the filesystem:

| File | Path | Status | Notes |
| :--- | :--- | :--- | :--- |
| `FRONTEND-PAGES.md` | `frontend/FRONTEND-PAGES.md` | **FOUND** (314 lines, 16.2 KB) | Complete frontend page guide & UI shell specification. |
| `PROJECT-DETAILS.md` | `PROJECT-DETAILS.md` | **FOUND** (469 lines, 42.1 KB) | Full architectural spec covering Rust backend, SQL schema, tools, and endpoints. |
| `context/project-context.md` | `context/project-context.md` | **MISSING** | Recorded as missing. Contents not invented. |
| `context/current-state.md` | `context/current-state.md` | **MISSING** | Recorded as missing. Contents not invented. |
| `context/integration-matrix.md` | `context/integration-matrix.md` | **MISSING** | Recorded as missing. Contents not invented. |
| `context/known-issues.md` | `context/known-issues.md` | **MISSING** | Recorded as missing. Contents not invented. |

---

## 3. Route Enumeration (Actual Repository)

The frontend uses Next.js 14 App Router organized into two route groups: `(auth)` for unauthenticated auth forms and `(app)` for the authenticated workspace shell, plus the root redirect.

There are **29 route entrypoints (`page.tsx`)**:

### Root & Authentication Routes (4)
1. `/` (`frontend/app/page.tsx`) — Client-side redirect to `/projects`.
2. `/login` (`frontend/app/(auth)/login/page.tsx`) — Username/password form with instant demo login and 2FA redirection.
3. `/2fa` (`frontend/app/(auth)/2fa/page.tsx`) — 6-digit TOTP verification code input.
4. `/setup` (`frontend/app/(auth)/setup/page.tsx`) — 3-step first-run wizard (Account -> 2FA setup with QR code -> Complete).

### Main Workspace Routes (7)
5. `/dashboard` (`frontend/app/(app)/dashboard/page.tsx`) — High-level metric cards, stacked area chart, donut pie chart, active scans, and activity feed.
6. `/projects` (`frontend/app/(app)/projects/page.tsx`) — Engagements registry with status filtering (All, Active, Archived) and New Project modal.
7. `/programs` (`frontend/app/(app)/programs/page.tsx`) — Bug bounty program directory with platform filters and New Program modal.
8. `/findings` (`frontend/app/(app)/findings/page.tsx`) — Global vulnerability findings table with severity/status filters, Log Finding modal, and CSV export.
9. `/gallery` (`frontend/app/(app)/gallery/page.tsx`) — Recon screenshot gallery with simulated browser chrome and full lightbox preview.
10. `/hunters` (`frontend/app/(app)/hunters/page.tsx`) — Team and hunters roster with Add/Edit Hunter modals and 2FA toggles.
11. `/jobs` (`frontend/app/(app)/jobs/page.tsx`) — Scan jobs hub with status filters, Dispatch Scan modal, and expandable live terminal logs.

### Dynamic Detail & Sub-Routes (10)
12. `/projects/[projectId]` (`frontend/app/(app)/projects/[projectId]/page.tsx`) — Project workspace with Overview, Programs, Kanban, Notes, Timeline, and Team tabs.
13. `/projects/[projectId]/programs` (`frontend/app/(app)/projects/[projectId]/programs/page.tsx`) — Dedicated program grid for a specific project.
14. `/projects/[projectId]/notes` (`frontend/app/(app)/projects/[projectId]/notes/page.tsx`) — Dedicated Markdown notes editor with tag filtering.
15. `/projects/[projectId]/team` (`frontend/app/(app)/projects/[projectId]/team/page.tsx`) — Dedicated project team roster with hunter assignment.
16. `/projects/[projectId]/timeline` (`frontend/app/(app)/projects/[projectId]/timeline/page.tsx`) — Dedicated chronological event audit log with type/severity filters.
17. `/programs/[id]` (`frontend/app/(app)/programs/[id]/page.tsx`) — Program detail hub with approval gate, pipeline stages, scan dispatch, scope editor, recon tabs, and findings table.
18. `/programs/[id]/scope` (`frontend/app/(app)/programs/[id]/scope/page.tsx`) — In-scope/out-of-scope targets management.
19. `/programs/[id]/recon` (`frontend/app/(app)/programs/[id]/recon/page.tsx`) — Multi-tab recon workstation (Subdomains, Ports, URLs, Screenshots).
20. `/programs/[id]/findings` (`frontend/app/(app)/programs/[id]/findings/page.tsx`) — Program-specific vulnerability list.
21. `/programs/[id]/reports` (`frontend/app/(app)/programs/[id]/reports/page.tsx`) — Report generator and export list.
22. `/findings/[id]` (`frontend/app/(app)/findings/[id]/page.tsx`) — Finding detail with interactive CVSS calculator, HTTP Request/Response evidence viewer, and editable triage notes.

### Settings Routes (7)
23. `/settings` (`frontend/app/(app)/settings/page.tsx`) — Configuration hub navigating to all settings sections.
24. `/settings/tools` (`frontend/app/(app)/settings/tools/page.tsx`) — Security scanner binary path configuration with individual tool tests.
25. `/settings/wordlists` (`frontend/app/(app)/settings/wordlists/page.tsx`) — Wordlist mount paths and sample line preview.
26. `/settings/alerts` (`frontend/app/(app)/settings/alerts/page.tsx`) — Discord/Slack webhook and SMTP email configuration with test ping buttons.
27. `/settings/schedule` (`frontend/app/(app)/settings/schedule/page.tsx`) — Global rescan slider (1-72h), quiet hours, and per-program overrides.
28. `/settings/tokens` (`frontend/app/(app)/settings/tokens/page.tsx`) — API token generation and revocation.
29. `/settings/security` (`frontend/app/(app)/settings/security/page.tsx`) — Password updates, 2FA setup, and active session revocation.

---

## 4. Shared Layout & UI Components Inventory

### Layout Components (`components/layout/`)
- `Sidebar.tsx`: Collapsible navigation rail (`w-[220px]` -> `w-[56px]`) with no vertical scroll, persistent collapse state, system status footer, and logo header.
- `TopBar.tsx`: Fixed header with Command Palette search (`Ctrl+K`), quick actions, dismissible notifications dropdown, and user menu.
- `AssistantPanel.tsx`: Collapsible right-hand drawer (280px–480px draggable resize) with Report Builder and AI Triage tabs.
- `ChatPanel.tsx`: Auxiliary conversation panel.
- `NewThemeProvider.tsx`: Dark theme wrapper wrapping `next-themes`.

### UI Primitives (`components/ui/`)
- `badge.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `checkbox.tsx`, `code-block.tsx`, `form.tsx`, `input.tsx`, `label.tsx`, `markdown-editor.tsx`, `popover.tsx`, `progress.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `terminal.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`.

### Domain-Specific Components
- **Dashboard (`components/dashboard/`)**: `ActiveJobs.tsx`, `ActivityFeed.tsx`, `SeverityChart.tsx`, `StatsRow.tsx`.
- **Findings (`components/findings/`)**: `CvssCalculator.tsx`, `EvidenceViewer.tsx`, `FindingDetail.tsx`, `FindingsTable.tsx`, `SeverityBadge.tsx`, `StatusBadge.tsx`, `TriageBadge.tsx`.
- **Programs (`components/programs/`)**: `ApprovalGateBanner.tsx`, `PipelineStatus.tsx`, `ProgramCard.tsx`, `ProgramForm.tsx`, `ScopeEditor.tsx`.
- **Projects (`components/projects/`)**: `KanbanBoard.tsx`, `KanbanCard.tsx`, `KanbanColumn.tsx`, `ProjectCard.tsx`, `ProjectForm.tsx`, `ProjectNotes.tsx`, `ProjectOverview.tsx`, `ProjectTimeline.tsx`.
- **Recon (`components/recon/`)**: `LiveLog.tsx`, `PortMap.tsx`, `ScreenshotGrid.tsx`, `SubdomainTable.tsx`, `UrlTable.tsx`.
- **Reports (`components/reports/`)**: `ReportBuilder.tsx`, `ReportPreview.tsx`.

---

## 5. Validation Commands Execution & Exact Output

All required validation commands were executed on the system.

### Command 1: `bun install`
- **Exit Code**: `0`
- **Exact Output**:
```text
bun install v1.3.14 (0d9b296a)

1 package installed [35.00ms]
```

---

### Command 2: `bun run lint`
- **Exit Code**: Non-zero / Prompt Halted (Killed)
- **Status**: **FAILED due to missing ESLint configuration**
- **Exact Output**:
```text
$ next lint
? How would you like to configure ESLint? https://nextjs.org/docs/basic-features/eslint
❯  Strict (recommended)
   Base
   Cancel ⚠ If you set up ESLint yourself, we recommend adding the Next.js ESLint plugin. See https://nextjs.org/docs/basic-features/eslint#migrating-existing-config
```
- **Finding**: No `.eslintrc.json` exists in `frontend/`. Running `next lint` invokes an interactive setup wizard that blocks automated CI/CD and non-interactive scripts.

---

### Command 3: `bun run typecheck`
- **Exit Code**: `1` (via package.json script)
- **Status**: **Script not defined in package.json**
- **Exact Output**:
```text
error: Script not found "typecheck"
```

- **Direct TypeScript Compilation via `bun x tsc --noEmit`**:
  - **Exit Code**: `0`
  - **Exact Output**:
  ```text
  (clean exit, no errors reported)
  ```
  - **Finding**: TypeScript typing passes strictly with 0 errors, but `package.json` needs `"typecheck": "tsc --noEmit"` added to its scripts.

---

### Command 4: `bun run build`
- **Exit Code**: `0`
- **Status**: **PASSED**
- **Exact Output**:
```text
$ next build
   ▲ Next.js 14.1.0

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/21) ...
   Generating static pages (5/21) 
   Generating static pages (10/21) 
   Generating static pages (15/21) 
 ✓ Generating static pages (21/21) 
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    335 B          84.8 kB
├ ○ /_not-found                          891 B          85.4 kB
├ ○ /2fa                                 3.84 kB        97.9 kB
├ ○ /dashboard                           113 kB          198 kB
├ ○ /findings                            8.07 kB         102 kB
├ λ /findings/[id]                       10.8 kB         139 kB
├ ○ /gallery                             5 kB             99 kB
├ ○ /hunters                             6.23 kB         100 kB
├ ○ /jobs                                8.47 kB         102 kB
├ ○ /login                               5.17 kB        99.2 kB
├ ○ /programs                            3.83 kB         136 kB
├ λ /programs/[id]                       20.4 kB         146 kB
├ λ /programs/[id]/findings              3.15 kB         103 kB
├ λ /programs/[id]/recon                 2.83 kB        96.9 kB
├ λ /programs/[id]/reports               3.12 kB        97.1 kB
├ λ /programs/[id]/scope                 3.48 kB        97.5 kB
├ ○ /projects                            5.75 kB         107 kB
├ λ /projects/[projectId]                48.1 kB         180 kB
├ λ /projects/[projectId]/notes          3.63 kB        97.6 kB
├ λ /projects/[projectId]/programs       2.56 kB         134 kB
├ λ /projects/[projectId]/team           3.37 kB        97.4 kB
├ λ /projects/[projectId]/timeline       4.5 kB          126 kB
├ ○ /settings                            2.17 kB        96.2 kB
├ ○ /settings/alerts                     3.83 kB        97.8 kB
├ ○ /settings/schedule                   4.01 kB          98 kB
├ ○ /settings/security                   4.75 kB        98.8 kB
├ ○ /settings/tokens                     4.22 kB        98.2 kB
├ ○ /settings/tools                      3.96 kB          98 kB
├ ○ /settings/wordlists                  4.33 kB        98.3 kB
└ ○ /setup                               4.54 kB        98.6 kB
+ First Load JS shared by all            84.5 kB
  ├ chunks/8069-8a0d81b0a442b06e.js      29.1 kB
  ├ chunks/fd9d1056-9f28797bf8f9c9be.js  53.4 kB
  └ other shared chunks (total)          2.04 kB


○  (Static)   prerendered as static content
λ  (Dynamic)  server-rendered on demand using Node.js
```

---

## 6. Build, Dependency, Routing & Responsive Issues

1. **Missing Route `/monitor`**:
   - `Sidebar.tsx` links to `/monitor` (`{ href: "/monitor", label: "Monitor", icon: Radio }`), but no page exists at `app/(app)/monitor/page.tsx`. Navigating to this route displays a 404 page.
2. **Phantom `"module": "src/index.ts"` in `package.json`**:
   - `frontend/package.json` defines `"module": "src/index.ts"`, but no `src` folder exists in the project (uses root `app/`, `components/`, etc.).
3. **Missing `typecheck` Script**:
   - Running `bun run typecheck` fails because the script is not in `package.json`.
4. **Missing `.eslintrc.json`**:
   - `bun run lint` halts on an interactive configuration prompt.
5. **Sidebar Scroll & Collapse Persistence**:
   - Resolved: Removed nav scrollbar by setting `overflow-hidden` and spacing tokens. Added `localStorage` persistence (`bountyos_sidebar_open`) so the sidebar stays collapsed across route changes and reloads until the user explicitly toggles it.
6. **Responsive Layout Constraints**:
   - Fixed table layouts across findings, subdomains, and ports require horizontal scrolling on viewports `< 640px`. Mobile overlay drawer handles navigation on mobile screens, but data tables need wrapping cards or responsive table primitives.

---

## 7. Local Mock State Inventory (100% of Pages)

Every interactive view in the frontend currently relies on in-memory mock state or static arrays:

| Page / Route | Local Mock State Implemented | Backend API Equivalent |
| :--- | :--- | :--- |
| `/dashboard` | `heroStats`, `compactStats`, `areaData`, `pieData`, `activeScans`, `recentActivity` | `GET /api/projects/:id/stats`, `GET /api/jobs` |
| `/projects` | `initialProjects` state array (5 items) | `GET /api/projects`, `POST /api/projects` |
| `/projects/[projectId]` | `projectData`, `programsList`, `notesList`, `timelineEvents`, `teamMembers` | `GET /api/projects/:id`, `GET /api/projects/:id/*` |
| `/projects/[projectId]/programs` | `initialPrograms` state array | `GET /api/projects/:id/programs` |
| `/projects/[projectId]/notes` | `initialNotes` state array, local Markdown editor | `GET /api/projects/:id/notes` |
| `/projects/[projectId]/team` | `initialTeam` state array | `GET /api/projects/:id/team` |
| `/projects/[projectId]/timeline` | `events` static array with local filter state | `GET /api/projects/:id/milestones` |
| `/programs` | `initialPrograms` state array (5 items) | `GET /api/programs` |
| `/programs/[id]` | Hardcoded mock program, approval state, pipeline stages | `GET /api/programs/:id`, `POST /api/programs/:id/approve` |
| `/programs/[id]/scope` | In-scope/out-of-scope targets in local state | `GET /api/programs/:id/scope` |
| `/programs/[id]/recon` | Mock subdomains, open ports, URLs, screenshots | `GET /api/programs/:id/subdomains`, `urls` |
| `/programs/[id]/findings` | Program-scoped mock findings list | `GET /api/programs/:id/findings` |
| `/programs/[id]/reports` | Mock report list and template selector | `GET /api/reports` |
| `/findings` | `initialFindings` state array (6 items) | `GET /api/findings` |
| `/findings/[id]` | Mock finding, HTTP req/res, audit history | `GET /api/findings/:id` |
| `/gallery` | Mock screenshots array | `GET /api/evidence/*` |
| `/hunters` | `initialHunters` state array (4 members) | `GET /api/hunters` |
| `/jobs` | `initialJobs` state array (6 jobs) | `GET /api/jobs` |
| `/settings/tools` | `initialTools` binary paths and test states | `GET /api/settings`, `POST /api/settings/tools/check` |
| `/settings/wordlists` | `initialWordlists` paths and sample lines | `GET /api/settings` |
| `/settings/alerts` | Local webhook and SMTP forms | `GET /api/settings` |
| `/settings/schedule` | Global interval and quiet hours state | `GET /api/settings` |
| `/settings/tokens` | `initialTokens` state array | `GET /api/tokens` |
| `/settings/security` | Local password, 2FA toggle, active sessions | `POST /api/auth/2fa/setup` |

---

## 8. Authentication Inconsistencies

1. **Dual Storage Keys**:
   - `lib/auth.ts` supports `access_token`, `refresh_token`, and legacy `token`. Pages historically wrote `localStorage.token`.
2. **Offline Mock Fallback**:
   - `hooks/useAuth.tsx` falls back to `DEFAULT_ADMIN` when offline or when the backend returns network errors. While beneficial for offline prototyping, it masks unauthenticated access.
3. **Missing Next.js Middleware Route Guards**:
   - There is no `middleware.ts` in `frontend/`. Direct navigation to `/(app)/*` routes does not require an active JWT or redirect unauthenticated visitors to `/login`.
4. **Backend Refresh Format Mismatch**:
   - `setupInterceptors()` sends `POST /api/auth/refresh` with `{ refresh_token: string }` JSON body. The backend handler in `bountyos-server/src/auth/handlers.rs` expects a raw body string.

---

## 9. API Hooks Status (Unused Data Hooks)

All API custom data hooks in `frontend/hooks/` were analyzed for usage:

| Hook | File | Current Usage | Status |
| :--- | :--- | :--- | :--- |
| `useAuth` | `frontend/hooks/useAuth.tsx` | Used by `TopBar.tsx`, `login/page.tsx`, `layout.tsx` | **Actively Used** |
| `useToast` | `frontend/hooks/useToast.ts` | Used by forms and action handlers across 12+ pages | **Actively Used** |
| `useWebSocket` | `frontend/hooks/useWebSocket.ts` | Used in `components/recon/LiveLog.tsx` | **Actively Used** |
| `useFindings` | `frontend/hooks/useFindings.ts` | **0 imports across entire codebase** | **UNUSED** |
| `usePrograms` | `frontend/hooks/usePrograms.ts` | **0 imports across entire codebase** | **UNUSED** |
| `useProjects` | `frontend/hooks/useProjects.ts` | **0 imports across entire codebase** | **UNUSED** |

---

## 10. Prioritized Remediation Plan

### Priority 1: Configuration & Command Fixes (Immediate)
1. **Create `.eslintrc.json`**:
   Add Next.js core Web Vitals ESLint config so `bun run lint` completes non-interactively without prompt halt.
2. **Add `typecheck` Script**:
   Add `"typecheck": "tsc --noEmit"` to `frontend/package.json`.
3. **Clean `package.json`**:
   Remove phantom `"module": "src/index.ts"` entry.

### Priority 2: Routing Consistency
1. **Implement `/monitor` Route**:
   Create `frontend/app/(app)/monitor/page.tsx` with live event streaming and terminal monitor view so sidebar navigation does not 404.
2. **Consolidate Dynamic Project Tabs**:
   Harmonize in-page tab switching in `projects/[projectId]/page.tsx` with dedicated file routes (`programs`, `notes`, `team`, `timeline`) or establish uniform deep-linking.

### Priority 3: Auth & Security Hardening
1. **Implement Next.js Route Guard Middleware**:
   Add `frontend/middleware.ts` to intercept `/(app)/:path*` and redirect to `/login` if `access_token` is missing or expired.
2. **Standardize Token Contract**:
   Standardize token key usage to `access_token` and `refresh_token` across all auth handlers.
3. **Harmonize Refresh Token Contract**:
   Align `setupInterceptors()` in `lib/auth.ts` with the exact backend JSON/raw payload expectation.

### Priority 4: Data Layer Hook Mounting (Backend Integration Prep)
1. **Wire `useProjects`**:
   Mount `useProjects` in `frontend/app/(app)/projects/page.tsx` with fallback to `initialProjects` when offline.
2. **Wire `usePrograms`**:
   Mount `usePrograms` in `frontend/app/(app)/programs/page.tsx`.
3. **Wire `useFindings`**:
   Mount `useFindings` in `frontend/app/(app)/findings/page.tsx`.
