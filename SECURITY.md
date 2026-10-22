# Security Policy

Bounty OS is an autonomous security intelligence and bug bounty platform designed to perform automated security research, reconnaissance, and vulnerability verification within strictly authorized scopes.

---

## 1. Scope & Authorization Architecture

Bounty OS incorporates hard cryptographic and programmatic boundaries to prevent out-of-scope security scanning:

- **Strict Target Validation**: All domain names, IP addresses, subdomains, and URI paths are verified against target program scopes prior to tool dispatch.
- **Pre-Execution Guardrails**: The tool runner and MCP server will reject any action whose target fails scope verification, returning an authorization error rather than executing.
- **Isolated Target States**: Cross-investigation learning retains abstract tool-effectiveness priors ($V(a \mid \text{archetype})$); individual target hostnames, credentials, and findings are strictly isolated to their own program database records.

---

## 2. Responsible Vulnerability Disclosure

If you discover a security vulnerability in Bounty OS itself, please follow our responsible disclosure process:

1. **Do not open a public issue.**
2. Send a report detailing the vulnerability, reproduction steps, and potential impact to `security@bountyos.dev` (or via private security advisory on GitHub).
3. Please allow up to 48 hours for an initial response from the core team.
4. We coordinate patch development and release advisories in accordance with responsible disclosure standards.

---

## 3. Supported Versions

Only the latest release of Bounty OS receives active security updates:

| Version | Supported |
|:---|:---:|
| **0.6.x** | **Yes** |
| 0.5.x | No |
| 0.4.x | No |
| 0.3.x | No |
| 0.2.x | No |
| 0.1.x | No |
