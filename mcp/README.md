# Bounty OS — High-Level MCP Control Plane

> Model Context Protocol (MCP) server providing a secure, semantic control plane for AI agents to operate Bounty OS investigations, reconnaissance, vulnerability scanning, triage, and reporting without arbitrary shell execution.

---

## 1. Architecture Overview

```text
                 ┌────────────────────────────────┐
                 │            AI Agent            │
                 │   (Antigravity, Claude, etc.)  │
                 └───────────────┬────────────────┘
                                 │ Model Context Protocol (stdio / SSE)
                                 ▼
                 ┌────────────────────────────────┐
                 │      Bounty OS MCP Server      │
                 │                                │
                 │  ├── Policy & Scope Engine     │
                 │  ├── Capability Levels         │
                 │  ├── Secret Redaction Filter   │
                 │  └── Structured Audit Logger   │
                 └───────────────┬────────────────┘
                                 │ REST API (JWT Bearer Auth)
                                 ▼
                 ┌────────────────────────────────┐
                 │       Bounty OS Backend        │
                 │        (Axum / Tokio)          │
                 ├────────────────────────────────┤
                 │ • Database (PostgreSQL 15)     │
                 │ • Job Queue & Cache (Redis 7)  │
                 │ • Tool Orchestration Runner    │
                 │ • VulnLLM Triage & Correlator  │
                 │ • Evidence Store & Markdown    │
                 └────────────────────────────────┘
```

The MCP layer is a **thin, capability-based control plane**. Heavy execution belongs strictly in the backend workers.

---

## 2. Security & Policy Principles

- **Zero Arbitrary Execution**: Tools like `shell`, `exec`, or `run_command` are strictly forbidden. The MCP client can only invoke high-level semantic tools.
- **Strict Scope Boundaries**: Every scan and investigation pre-validates target domains against authorized in-scope rules (`scope.validate`). Explicit exclusions take absolute precedence.
- **Capability Levels**:
  - `PASSIVE` (1): Read-only asset, endpoint, and finding inspection.
  - `LOW_IMPACT` (2): Web probing, non-invasive spidering, investigation state management.
  - `ACTIVE` (3): Vulnerability scanning (Nuclei), payload execution, verification.
  - `RESTRICTED` (4): High-consequence or explicit approval required.
- **Evidence-Based Verification**: The LLM cannot independently mark a finding as `CONFIRMED` without reproducible technical evidence (cURL, payload, or execution trace).
- **Automated Secret Scrubbing**: All passwords, API keys, JWTs, and auth cookies are automatically redacted (`[REDACTED_SECRET]`) from tool output and logs.

---

## 3. Tool Catalog

### 3.1 Investigation Lifecycle Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `investigation.start` | `target`, `scope?`, `profile?` | Validates scope, enrolls project/program, and dispatches initial recon job. |
| `investigation.status` | `investigation_id` | Returns lifecycle state, current stage, progress %, active/completed jobs, and finding counts. |
| `investigation.pause` | `investigation_id` | Pauses running scan jobs for the investigation. |
| `investigation.resume` | `investigation_id` | Resumes paused discovery workflow. |
| `investigation.cancel` | `investigation_id` | Terminates all running scan jobs and deactivates the program. |

### 3.2 Scope Boundary Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `scope.get` | `investigation_id` | Retrieves complete list of in-scope and out-of-scope rules. |
| `scope.validate` | `target`, `investigation_id?` | **Safety Check:** Strictly evaluates whether a target is authorized before any scan. |

### 3.3 Asset & Surface Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `assets.list` | `investigation_id?`, `host?`, `limit?` | Lists normalized hostnames, IPs, web servers, and detected technologies. |
| `asset.get` | `asset_id` | Enriched intelligence for a single asset with open ports and services. |
| `services.list` | `investigation_id?`, `asset_id?`, `port?` | Lists open ports, banners, protocols, and HTTP services. |
| `service.get` | `service_id` | Detailed port, banner, and service metadata. |
| `endpoints.list` | `investigation_id?`, `host?`, `method?` | Lists crawled web endpoints, URL parameters, and content types. |
| `endpoint.get` | `endpoint_id` | Detailed parameter schemas and HTTP metadata for a URL. |

### 3.4 Scan Dispatch Tools (Asynchronous)
| Tool Name | Parameters | Description |
|---|---|---|
| `scan.recon` | `investigation_id`, `target?`, `profile?` | Dispatches subdomain and DNS discovery (`subfinder`, `dnsx`). |
| `scan.web` | `investigation_id`, `target?`, `profile?` | Dispatches HTTP probing and web spidering (`httpx`, `katana`, `gau`). |
| `scan.vulnerabilities` | `investigation_id`, `target?`, `profile?`, `templates?` | Dispatches vulnerability scan (`nuclei`) with scope validation safeguard. |

### 3.5 Finding & Triage Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `findings.list` | `investigation_id?`, `severity?`, `status?`, `confidence?` | Lists security findings filtered by severity, CVSS, and status. |
| `finding.get` | `finding_id` | Full technical details, matched endpoints, description, and cURL commands. |
| `finding.analyze` | `finding_id` | Dispatches finding and evidence to VulnLLM for automated triage, impact reasoning, and remediation. |
| `finding.verify` | `finding_id`, `status`, `verification_notes?` | Updates status (`confirmed`, `likely`, `unverified`, `false_positive`) with technical proof. |

### 3.6 Evidence & Audit Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `evidence.list` | `investigation_id?`, `finding_id?` | Lists technical evidence records with SHA256 hashes and redacted payloads. |
| `evidence.get` | `evidence_id`, `path?` | Retrieves raw HTTP request/response transcript scrubbed of secrets. |

### 3.7 Report Tools
| Tool Name | Parameters | Description |
|---|---|---|
| `report.generate` | `investigation_id`, `format?` | Generates full markdown/JSON report distinguishing CONFIRMED, LIKELY, UNVERIFIED, FALSE POSITIVE, and INFORMATIONAL findings. |
| `report.get` | `investigation_id` | Fetches the latest generated executive assessment report. |

---

## 4. MCP Resources

Agents can stream and inspect investigation state via uniform URIs:

- `investigation://{id}`: Overview metadata and scope rules.
- `investigation://{id}/assets`: All discovered subdomains, IPs, and web servers.
- `investigation://{id}/services`: Open ports and service banners.
- `investigation://{id}/endpoints`: Crawled HTTP endpoints and parameters.
- `investigation://{id}/findings`: Discovered vulnerability findings.
- `investigation://{id}/evidence`: Request/response transcripts and hashes.
- `investigation://{id}/timeline`: Chronological audit log of scan jobs and findings.
- `investigation://{id}/report`: Full Markdown assessment report.
- `bountyos://programs`: All enrolled bug bounty programs.
- `bountyos://findings/active`: Live active findings.

---

## 5. MCP Prompts

Ready-to-use workflows for autonomous agents:

- `full-investigation`: Complete path from intake through recon, scanning, triage, and reporting.
- `web-application-investigation`: Specialized web app surface discovery and header analysis.
- `api-investigation`: Specialized API surface discovery and parameter validation.
- `finding-triage`: CVSS v3.1 scoring, business impact analysis, and PoC evaluation.
- `finding-verification`: Technical evidence verification instructions.
- `report-investigation`: Executive report synthesis guide.

---

## 6. Structured Error Codes

All errors adhere to the standard schema:

```json
{
  "error": {
    "code": "SCOPE_DENIED",
    "message": "Target 'app.external.com' is outside authorized scope.",
    "retryable": false
  }
}
```

Standard codes: `INVALID_TARGET`, `SCOPE_DENIED`, `UNAUTHORIZED`, `FORBIDDEN`, `INVESTIGATION_NOT_FOUND`, `FINDING_NOT_FOUND`, `JOB_NOT_FOUND`, `TOOL_UNAVAILABLE`, `TOOL_FAILED`, `TIMEOUT`, `INVALID_ARGUMENT`, `POLICY_DENIED`, `INTERNAL_ERROR`.

---

## 7. Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BOUNTYOS_API_URL` | `http://127.0.0.1:8000` | Backend Axum server base URL |
| `BOUNTYOS_USERNAME` | `admin` | Authentication username |
| `BOUNTYOS_PASSWORD` | `admin` | Authentication password |
| `PORT` | `3005` | HTTP port for SSE transport |
| `MCP_TRANSPORT` | `stdio` | Transport mode (`stdio` or `sse`) |
| `MCP_ALLOWED_CAPABILITIES` | `ACTIVE` | Maximum permission level (`PASSIVE`, `LOW_IMPACT`, `ACTIVE`) |
| `MCP_MAX_CONCURRENT_JOBS` | `5` | Maximum simultaneous active background scan jobs |

---

## 8. Docker Deployment

Bounty OS includes the MCP server as a first-class compose service:

```yaml
  mcp:
    build:
      context: ./mcp
      dockerfile: Dockerfile
    container_name: bountyos-mcp
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
    environment:
      PORT: 3005
      MCP_TRANSPORT: sse
      BOUNTYOS_API_URL: http://server:8000
    ports:
      - "127.0.0.1:3005:3005"
```

To run:
```bash
docker compose up -d mcp
```

Check health:
```bash
curl http://127.0.0.1:3005/health
# {"status":"ok","server":"bountyos-mcp","version":"2.0.0"}
```

---

## 9. Automated Testing

### Unit Tests
Tests scope validation, argument sanitization, permission levels, and secret scrubbing:
```bash
npm run build; node dist/tests/unit.test.js
```

### End-to-End Integration Test
Executes all 11 phases against live backend APIs and Docker containers:
```bash
npm run build; node dist/tests/integration.test.js
```
