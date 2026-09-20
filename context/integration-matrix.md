# Integration Matrix

Current status: the frontend is intentionally NOT connected to the Rust backend (scope of BOUNTY-FRONTEND-002). This matrix maps UI surfaces to their eventual API endpoints and the current wiring state. Verified from repo source reads; no endpoint callbacks were fabricated.

| UI surface | Mock data (current) | Backend endpoint (per PROJECT-DETAILS.md §4.2) | Backend implement state |
|---|---|---|---|
| Auth pages (`/login`, `/2fa`, `/setup`) | Inline form state | `POST /api/auth/login`, `/api/auth/2fa` (+ refresh) | Handlers exist; frontend contract mismatch |
| `/dashboard` stats/charts/active scans | `heroStats`, `areaData`, `recentActivity`, etc. | `GET /api/projects/:id/stats`, `GET /api/jobs` | Stats handler route declared; jobs are 501 stubs |
| `/projects` (+ New Project) | `initialProjects` local state | `GET/POST /api/projects` | Projects handlers work (created_by placeholder UUID) |
| `/projects/[projectId]` overview | Local project/program/notes/team/timeline state | `GET /api/projects/:id`, `/notes`, `/team`, `/milestones`, `/kanban` | Project CRUD works; milestone/team/notes/kanban handlers missing |
| `/projects/[projectId]/(programs,notes,team,timeline)` | Local state + markdown editor | Same project sub-endpoints | Same as above |
| `/programs` (+ New Program) | `initialPrograms` local state | `GET/POST /api/programs` | Programs handlers work |
| `/programs/[id]` (+ scope/recon/findings/reports subroutes) | Hardcoded mock program/targets/recon data | `GET /api/programs/:id`, `/scope`, `/subdomains`, `/urls`, `/findings`, scan/approve | Programs CRUD + approve work; scope/subdomains/ports/urls/findings are 501 stubs; scan is a 202 stub |
| `/findings` + `/findings/[id]` | `initialFindings`, mock req/res/evidence | `GET/PUT /api/findings`, `/findings/:id` (+claim/validate/report) | findings handlers are 501 stubs (only triage works, gated on LLM) |
| `/gallery` | Static screenshot cards | `GET /api/evidence/*` | Static evidence serving is a 404 stub |
| `/hunters` | `initialHunters` local state | `GET/POST/PUT/DELETE /api/hunters` | 501 stubs |
| `/jobs` | `initialJobs`, expandable table, cancel | `GET/DELETE /api/jobs`, `/api/jobs/:id`, WS `/ws/jobs/:id` | 501 stubs; WS broadcasts unfiltered |
| `/monitor` | KPI + change feed + watchlist + telemetry + terminal (100% mock) | No dedicated endpoint; would use `GET /api/jobs` + WS broadcast | Not wired (by design for this task) |
| `/settings` hub + subpages | Local form/token state, client-side `bos_` token gen | `GET/PUT /api/settings`, `/api/tokens` | 501 stubs |

## Auth integration gap (documented in AUDIT-BOUNTY-FRONTEND-001)

Two parallel flows coexist:
1. Legacy (used by auth pages): `localStorage.token`, posts to `/api/auth/*`.
2. Modern (declared, unused): `lib/api.ts` + `lib/auth.ts` read `access_token`/`refresh_token`; interceptors never wired.
Backend refresh handler expects a raw-body refresh token while the frontend interceptor sends a JSON body — must be reconciled before wiring (recommendation, not done here).

## Hooks status

`useAuth` (used), `useToast` (used), `useWebSocket` (used in LiveLog). `useFindings`, `usePrograms`, `useProjects` exist with 0 imports — reserved for backend wiring.

## Rule for this matrix

Anything marked "not wired" here is intentionally mock. Update this file when a UI surface is hooked to a real endpoint.