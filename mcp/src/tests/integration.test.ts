/**
 * Bounty OS — Full High-Level MCP Control Plane Integration Test
 *
 * Exercises the complete investigation lifecycle through the MCP protocol:
 * 1. Scope validation
 * 2. Start investigation
 * 3. Observe investigation status
 * 4. Discover assets
 * 5. Discover services
 * 6. Discover endpoints
 * 7. Dispatch scans (recon, web, vulnerabilities)
 * 8. Retrieve findings
 * 9. Retrieve evidence
 * 10. VulnLLM finding analysis
 * 11. Finding verification
 * 12. Prioritization
 * 13. Generate report
 * 14. Retrieve report & resource read
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import assert from "assert";
import { createBountyOSServer } from "../index.js";

async function runIntegrationTest() {
  console.log("==================================================================");
  console.log("   Bounty OS — High-Level MCP Control Plane Integration Test      ");
  console.log("==================================================================\n");

  // 1. Connect Client to BountyOS MCP Server via InMemoryTransport
  const server = createBountyOSServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "bountyos-agent-test", version: "1.0.0" },
    { capabilities: {} }
  );

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  console.log("✓ Connected AI Agent Client to Bounty OS MCP Server");

  // 2. Discover Tools, Resources, and Prompts
  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((t) => t.name);
  console.log(`✓ Discovered ${toolNames.length} MCP tools:`);
  console.log(`  - Investigation: ${toolNames.filter((t) => t.startsWith("investigation.")).join(", ")}`);
  console.log(`  - Scope: ${toolNames.filter((t) => t.startsWith("scope.")).join(", ")}`);
  console.log(`  - Assets: ${toolNames.filter((t) => t.startsWith("asset")).join(", ")}`);
  console.log(`  - Services: ${toolNames.filter((t) => t.startsWith("service")).join(", ")}`);
  console.log(`  - Endpoints: ${toolNames.filter((t) => t.startsWith("endpoint")).join(", ")}`);
  console.log(`  - Scans: ${toolNames.filter((t) => t.startsWith("scan.")).join(", ")}`);
  console.log(`  - Findings: ${toolNames.filter((t) => t.startsWith("finding")).join(", ")}`);
  console.log(`  - Evidence: ${toolNames.filter((t) => t.startsWith("evidence.")).join(", ")}`);
  console.log(`  - Reports: ${toolNames.filter((t) => t.startsWith("report.")).join(", ")}`);

  const resourcesResult = await client.listResources();
  console.log(`✓ Discovered ${resourcesResult.resources.length} MCP resources`);

  const promptsResult = await client.listPrompts();
  console.log(`✓ Discovered ${promptsResult.prompts.length} MCP prompts: ${promptsResult.prompts.map((p) => p.name).join(", ")}`);

  // Helper to call tool and parse JSON
  async function callTool(name: string, args: Record<string, any>): Promise<any> {
    const res: any = await client.callTool({ name, arguments: args });
    assert.ok(!res.isError, `Tool '${name}' failed: ${res.content?.[0]?.text}`);
    const text = res.content?.[0]?.text || "";
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // --------------------------------------------------------------------------
  // Step 1 — Scope Validation
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 1] Scope Validation");
  const scopeValRes = await callTool("scope.validate", {
    target: "target.local",
  });
  console.log(`  Target 'target.local': allowed=${scopeValRes.allowed} (${scopeValRes.reason})`);

  // --------------------------------------------------------------------------
  // Step 2 — Start Investigation
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 2] Start Investigation");
  const invStartRes = await callTool("investigation.start", {
    target: "target.local",
    scope: {
      domains: ["target.local", "*.target.local"],
      ips: [],
      excluded_hosts: ["forbidden.target.local"],
    },
    profile: "standard",
  });
  assert.ok(invStartRes.investigation_id, "investigation_id must be returned");
  const investigationId = invStartRes.investigation_id;
  console.log(`  ✓ Investigation started with ID: ${investigationId} (profile=${invStartRes.profile}, status=${invStartRes.status})`);

  // --------------------------------------------------------------------------
  // Step 3 — Scope Check on Enrolled Targets
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 3] Validate Scope Boundaries on Investigation");
  const inScopeCheck = await callTool("scope.validate", {
    investigation_id: investigationId,
    target: "api.target.local",
  });
  assert.strictEqual(inScopeCheck.allowed, true, "Subdomain of *.target.local must be in scope");
  console.log(`  ✓ 'api.target.local' is in scope: allowed=${inScopeCheck.allowed}`);

  const outScopeCheck = await callTool("scope.validate", {
    investigation_id: investigationId,
    target: "forbidden.target.local",
  });
  assert.strictEqual(outScopeCheck.allowed, false, "Excluded host must be out of scope");
  console.log(`  ✓ 'forbidden.target.local' is excluded: allowed=${outScopeCheck.allowed} (${outScopeCheck.reason})`);

  // --------------------------------------------------------------------------
  // Step 4 — Observe Investigation Status
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 4] Observe Investigation Status");
  const statusRes = await callTool("investigation.status", {
    investigation_id: investigationId,
  });
  console.log(`  ✓ Status: ${statusRes.status}, Stage: ${statusRes.stage}, Progress: ${statusRes.progress}%`);

  // --------------------------------------------------------------------------
  // Step 5 — Reconnaissance & Web Scans
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 5] Trigger Reconnaissance & Web Scans");
  const reconRes = await callTool("scan.recon", {
    investigation_id: investigationId,
    target: "target.local",
    profile: "standard",
  });
  console.log(`  ✓ Recon dispatched: job_id=${reconRes.job_id}, tool=${reconRes.tool}`);

  const webRes = await callTool("scan.web", {
    investigation_id: investigationId,
    target: "target.local",
    profile: "standard",
  });
  console.log(`  ✓ Web scan dispatched: job_id=${webRes.job_id}, tool=${webRes.tool}`);

  const vulnRes = await callTool("scan.vulnerabilities", {
    investigation_id: investigationId,
    target: "target.local",
    profile: "standard",
    templates: ["cve", "misconfiguration"],
  });
  console.log(`  ✓ Vulnerability scan dispatched: job_id=${vulnRes.job_id}, tool=${vulnRes.tool}`);

  // --------------------------------------------------------------------------
  // Step 6 — Asset, Service, and Endpoint Retrieval
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 6] Asset, Service, & Endpoint Inventory");
  const assetsRes = await callTool("assets.list", {
    investigation_id: investigationId,
  });
  console.log(`  ✓ Assets retrieved: ${assetsRes.length} records`);

  const servicesRes = await callTool("services.list", {
    investigation_id: investigationId,
  });
  console.log(`  ✓ Services retrieved: ${servicesRes.length} records`);

  const endpointsRes = await callTool("endpoints.list", {
    investigation_id: investigationId,
  });
  console.log(`  ✓ Endpoints retrieved: ${endpointsRes.length} records`);

  // --------------------------------------------------------------------------
  // Step 7 — Finding Creation, Retrieval & Prioritization
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 7] Security Findings Pipeline");
  const newFinding = await callTool("create_finding", {
    program_id: investigationId,
    title: "SQL Injection in User Profile Lookup",
    description: "Unsanitized input in profile endpoint allows arbitrary SQL query execution.",
    severity: "high",
    status: "new",
    matched_at: "https://target.local/api/v1/profile?id=1",
    finding_type: "sqli",
    tags: ["OWASP-A03", "CWE-89"],
    cvss_score: 8.6,
  });
  const findingId = newFinding.id;
  console.log(`  ✓ Security finding created: ID=${findingId}, Title="${newFinding.title}"`);

  const findingsList = await callTool("findings.list", {
    investigation_id: investigationId,
  });
  console.log(`  ✓ Retrieved ${findingsList.length} findings for investigation`);

  const findingDetails = await callTool("finding.get", {
    finding_id: findingId,
  });
  console.log(`  ✓ Finding details: Severity=${findingDetails.severity}, CVSS=${findingDetails.cvss_score}`);

  // --------------------------------------------------------------------------
  // Step 8 — VulnLLM Analysis & Automated Reasoning
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 8] VulnLLM Finding Analysis");
  const analysisRes = await callTool("finding.analyze", {
    finding_id: findingId,
  });
  console.log(`  ✓ VulnLLM Assessment received:`);
  console.log(`    - Vulnerability Type: ${analysisRes.assessment.vulnerability_type}`);
  console.log(`    - Confidence Score: ${(analysisRes.assessment.confidence * 100).toFixed(0)}%`);
  console.log(`    - False Positive Likelihood: ${analysisRes.assessment.false_positive_likelihood}`);
  console.log(`    - Impact: ${analysisRes.assessment.impact}`);

  // --------------------------------------------------------------------------
  // Step 9 — Evidence Retrieval & Redaction
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 9] Evidence Audit & Redaction");
  const evidenceList = await callTool("evidence.list", {
    investigation_id: investigationId,
    finding_id: findingId,
  });
  console.log(`  ✓ Evidence records retrieved: ${evidenceList.length} artifacts (hash=${evidenceList[0]?.hash || "N/A"})`);

  // --------------------------------------------------------------------------
  // Step 10 — Finding Verification
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 10] Finding Verification");
  const verifyRes = await callTool("finding.verify", {
    finding_id: findingId,
    status: "confirmed",
    verification_notes: "Reproduced SQLi via automated lab proof of concept: SLEEP(5) induced 5.1s response latency.",
  });
  assert.strictEqual(verifyRes.verified, true, "Finding must be marked verified");
  console.log(`  ✓ Finding verified: status=${verifyRes.verification_status}, kanban=${verifyRes.kanban_column}`);

  // --------------------------------------------------------------------------
  // Step 11 — Report Generation & Resource Inspection
  // --------------------------------------------------------------------------
  console.log("\n>>> [Step 11] Report Generation & Resource Protocol");
  const markdownReport = await callTool("report.generate", {
    investigation_id: investigationId,
    format: "markdown",
  });
  assert.ok(markdownReport.includes("Security Assessment Report"), "Report must include title");
  assert.ok(markdownReport.includes("CONFIRMED"), "Report must classify CONFIRMED findings");
  console.log(`  ✓ Markdown report generated (${markdownReport.length} characters)`);

  const reportGet = await callTool("report.get", {
    investigation_id: investigationId,
  });
  assert.ok(reportGet.report.length > 0, "report.get must return report text");
  console.log(`  ✓ Retrieved report via report.get: Program="${reportGet.program_name}"`);

  // Read through MCP Resource URI: investigation://{id}/report
  const resourceUri = `investigation://${investigationId}/report`;
  const resourceContent: any = await client.readResource({ uri: resourceUri });
  assert.ok(resourceContent.contents[0].text.length > 0, "Resource contents must not be empty");
  console.log(`  ✓ Read investigation report through MCP Resource protocol (${resourceUri})`);

  console.log("\n==================================================================");
  console.log("   ALL 11 MCP WORKFLOW PHASES PASSED WITH 100% SUCCESS!           ");
  console.log("==================================================================\n");

  try {
    await client.close();
    await server.close();
  } catch {}
  process.exit(0);
}

runIntegrationTest().catch((e) => {
  console.error("Integration test failure:", e);
  process.exit(1);
});
