import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  // 1. full-investigation
  server.prompt(
    "full-investigation",
    "Complete end-to-end investigation workflow: scope validation -> intake -> recon -> scanning -> triage -> reporting.",
    {
      target: z.string().describe("Authorized target root domain (e.g. target.local)"),
      investigation_id: z.string().optional().describe("Existing investigation UUID if already started"),
    },
    ({ target, investigation_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are an authorized Senior Security Engineer conducting a full-scope assessment of ${target}.

Follow the strict, non-destructive Bounty OS execution sequence:
1. **Scope Verification**:
   - Call \`scope.validate\` with target: "${target}".
   - If denied, halt immediately. Never test out-of-scope assets.
2. **Investigation Setup**:
   ${investigation_id ? `- Use existing investigation: ${investigation_id}` : `- Call \`investigation.start\` with target "${target}" and profile "standard".`}
3. **Reconnaissance & Asset Discovery**:
   - Call \`scan.recon\` to discover live subdomains and IP addresses.
   - Call \`assets.list\` to inspect resolved assets.
4. **Service & Web Discovery**:
   - Call \`scan.web\` to detect HTTP headers, servers, and technologies.
   - Call \`services.list\` and \`endpoints.list\` to map the attack surface.
5. **Vulnerability Scanning**:
   - Call \`scan.vulnerabilities\` with profile "standard" against identified live services.
6. **Findings Pipeline & Triage**:
   - Call \`findings.list\` to view discovered candidates.
   - Call \`finding.analyze\` for each finding to obtain VulnLLM assessment and CVSS metrics.
   - Call \`finding.verify\` to evaluate technical proof before marking verified.
7. **Executive Reporting**:
   - Call \`report.generate\` with format "markdown" to produce the finalized security report.`,
          },
        },
      ],
    })
  );

  // 2. web-application-investigation
  server.prompt(
    "web-application-investigation",
    "Specialized web application attack surface discovery, header security, and vulnerability assessment workflow.",
    {
      target_url: z.string().describe("Web application target URL (e.g. https://app.target.local)"),
    },
    ({ target_url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute a focused web application security assessment against ${target_url}:
1. Call \`scope.validate\` with target: "${target_url}".
2. Call \`endpoints.list\` to discover exposed paths, query parameters, and endpoints.
3. Call \`scan.web\` with profile "standard" to spider routes and crawl JavaScript assets.
4. Inspect headers (CORS, CSP, X-Frame-Options) and authentication endpoints.
5. Call \`scan.vulnerabilities\` with templates: ["cve", "misconfiguration", "exposure"].
6. Call \`findings.list\` and analyze any candidates with \`finding.analyze\`.`,
          },
        },
      ],
    })
  );

  // 3. api-investigation
  server.prompt(
    "api-investigation",
    "Specialized API assessment workflow: endpoints, authorization, CORS, and parameter validation.",
    {
      api_host: z.string().describe("Target API hostname (e.g. api.target.local)"),
    },
    ({ api_host }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute an API security investigation against ${api_host}:
1. Call \`scope.validate\` with target: "${api_host}".
2. Call \`endpoints.list\` filtering by host: "${api_host}".
3. Look for swagger.json, openapi.json, /graphql, and versioned endpoints (/v1, /v2).
4. Call \`services.list\` to inspect open ports and TLS configurations.
5. Check for IDOR, unauthenticated endpoints, and rate-limiting bypasses.
6. Record or triage any findings via \`finding.analyze\` and \`finding.verify\`.`,
          },
        },
      ],
    })
  );

  // 4. finding-triage
  server.prompt(
    "finding-triage",
    "Triage and evaluate real-world impact, CVSS v3.1 score, and false-positive likelihood for a security finding.",
    {
      finding_id: z.string().describe("The UUID of the finding to triage"),
    },
    ({ finding_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are the lead security triager assessing finding ${finding_id}:
1. Call \`finding.get\` with finding_id: "${finding_id}".
2. Call \`evidence.list\` for finding_id: "${finding_id}" to inspect request/response transcripts.
3. Call \`finding.analyze\` to run the VulnLLM assessment.
4. Verify:
   - Is the PoC strictly reproducible without side effects?
   - Is the endpoint confirmed in scope?
   - What is the realistic business impact?
5. Call \`finding.verify\` to set status to 'likely' or 'confirmed' with detailed technical reasoning.`,
          },
        },
      ],
    })
  );

  // 5. finding-verification
  server.prompt(
    "finding-verification",
    "Strict technical verification workflow. The AI cannot mark confirmed without reproducible evidence.",
    {
      finding_id: z.string().describe("The UUID of the finding to verify"),
    },
    ({ finding_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform rigorous technical verification for finding ${finding_id}:
1. Fetch finding details via \`finding.get\`.
2. Inspect the curl_command and response artifacts using \`evidence.get\`.
3. Check status code, payload reflections, and response headers.
4. Confirmation requirement: Only set status to 'confirmed' if explicit technical proof exists. Otherwise mark 'unverified' or 'insufficient_evidence'.
5. Execute \`finding.verify\` with status and technical verification notes.`,
          },
        },
      ],
    })
  );

  // 6. report-investigation
  server.prompt(
    "report-investigation",
    "Synthesize an executive-ready bug bounty and security assessment report.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    ({ investigation_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate the final security assessment report for investigation ${investigation_id}:
1. Call \`investigation.status\` to verify all scans and analysis tasks have concluded.
2. Call \`findings.list\` to review all categorized vulnerabilities.
3. Call \`report.generate\` with format: "markdown".
4. Review the report to ensure all findings have:
   - Clear executive summary
   - Severity and CVSS v3.1 score
   - Step-by-step reproduction instructions
   - Developer remediation guidance
   - Distinction between CONFIRMED, LIKELY, UNVERIFIED, and INFORMATIONAL.`,
          },
        },
      ],
    })
  );

  // Backward compatible legacy prompts
  server.prompt(
    "recon-workflow",
    "Legacy reconnaissance guide.",
    {
      program_id: z.string(),
      primary_domain: z.string(),
    },
    ({ program_id, primary_domain }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform reconnaissance on ${primary_domain} for program ${program_id}. Call check_scope and list_subdomains.`,
          },
        },
      ],
    })
  );
}
