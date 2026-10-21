import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerAliases(server: McpServer, client: BountyOSClient) {
  // 1. list_programs
  server.tool(
    "list_programs",
    "List all enrolled bug bounty programs in BountyOS.",
    {},
    async () => {
      try {
        const programs = await client.listPrograms();
        return mcpSuccessResponse(
          programs.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            platform: p.platform,
            program_url: p.program_url,
            active: p.active,
            notes: p.notes,
          }))
        );
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 2. get_program_details
  server.tool(
    "get_program_details",
    "Get detailed information for a specific bug bounty program by its ID.",
    { program_id: z.string().describe("The UUID of the program") },
    async ({ program_id }) => {
      try {
        const program = await client.getProgram(program_id);
        return mcpSuccessResponse(program);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INVESTIGATION_NOT_FOUND, e.message);
      }
    }
  );

  // 3. get_program_scope
  server.tool(
    "get_program_scope",
    "Retrieve in-scope and out-of-scope targets for a bug bounty program.",
    { program_id: z.string().describe("The UUID of the program") },
    async ({ program_id }) => {
      try {
        const rules = await client.listScope(program_id);
        const inScope = rules.filter((r) => !r.out_of_scope);
        const outOfScope = rules.filter((r) => r.out_of_scope);
        return mcpSuccessResponse({
          program_id,
          total_targets: rules.length,
          in_scope: inScope,
          out_of_scope: outOfScope,
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INVESTIGATION_NOT_FOUND, e.message);
      }
    }
  );

  // 4. check_scope
  server.tool(
    "check_scope",
    "CRITICAL SAFETY CHECK: Verifies whether a target is IN-SCOPE or OUT-OF-SCOPE.",
    {
      program_id: z.string().describe("The UUID of the program"),
      target: z.string().describe("The hostname or URL to check"),
    },
    async ({ program_id, target }) => {
      try {
        const rules = await client.listScope(program_id);
        const evaluation = globalPolicyEngine.validateScope(target, rules);
        return mcpSuccessResponse({
          target,
          status: evaluation.allowed ? "IN_SCOPE" : "OUT_OF_SCOPE",
          allowed: evaluation.allowed,
          reason: evaluation.reason,
          ...(evaluation.matched_rule ? { matched_rule: evaluation.matched_rule } : {}),
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 5. add_scope_target
  server.tool(
    "add_scope_target",
    "Add a target into a program's scope definition.",
    {
      program_id: z.string().describe("The UUID of the program"),
      target: z.string().describe("Target domain, URL, or CIDR"),
      target_type: z.enum(["domain", "url", "cidr", "mobile"]).default("domain"),
      out_of_scope: z.boolean().default(false),
      notes: z.string().optional(),
    },
    async ({ program_id, target, target_type, out_of_scope, notes }) => {
      try {
        const res = await client.addScopeTarget(program_id, { target, target_type, out_of_scope, notes });
        return mcpSuccessResponse({
          id: res.id,
          target,
          out_of_scope,
          message: `Target '${target}' successfully added to program scope.`,
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 6. list_subdomains
  server.tool(
    "list_subdomains",
    "List enumerated subdomains and live hosts for a bug bounty program.",
    { program_id: z.string().describe("The UUID of the program") },
    async ({ program_id }) => {
      try {
        const subdomains = await client.listSubdomains(program_id);
        return mcpSuccessResponse(subdomains);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 7. add_subdomain
  server.tool(
    "add_subdomain",
    "Ingest a newly discovered subdomain into BountyOS asset inventory.",
    {
      program_id: z.string(),
      subdomain: z.string(),
      ip_address: z.string().optional(),
      status_code: z.number().optional().default(200),
      web_server: z.string().optional(),
      tech: z.array(z.string()).optional(),
      cname: z.string().optional(),
      ports: z.array(z.number()).optional(),
    },
    async ({ program_id, subdomain, ip_address, status_code, web_server, tech, cname, ports }) => {
      try {
        return mcpSuccessResponse({
          program_id,
          subdomain,
          ip_address,
          status_code,
          web_server,
          tech,
          cname,
          ports,
          message: `Subdomain '${subdomain}' recorded.`,
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 8. list_findings
  server.tool(
    "list_findings",
    "Query security findings and vulnerabilities discovered across programs.",
    {
      program_id: z.string().optional(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
      status: z.string().optional(),
    },
    async ({ program_id, severity, status }) => {
      try {
        const findings = await client.listFindings({ program_id, severity, status });
        return mcpSuccessResponse(findings);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 9. get_finding
  server.tool(
    "get_finding",
    "Retrieve complete technical details for a specific vulnerability finding.",
    { finding_id: z.string().describe("The UUID of the finding") },
    async ({ finding_id }) => {
      try {
        const finding = await client.getFinding(finding_id);
        return mcpSuccessResponse(finding);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.FINDING_NOT_FOUND, e.message);
      }
    }
  );

  // 10. create_finding
  server.tool(
    "create_finding",
    "Record a newly discovered security vulnerability into BountyOS.",
    {
      program_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).default("medium"),
      status: z.string().default("new"),
      matched_at: z.string().optional(),
      finding_type: z.string().optional(),
      tags: z.array(z.string()).optional(),
      cvss_score: z.number().optional(),
    },
    async (payload) => {
      try {
        const finding = await client.createFinding(payload);
        return mcpSuccessResponse(finding);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 11. update_finding
  server.tool(
    "update_finding",
    "Update workflow status or severity rating of an existing finding.",
    {
      finding_id: z.string(),
      status: z.string().optional(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
      notes: z.string().optional(),
      cvss_score: z.number().optional(),
    },
    async ({ finding_id, status, severity, notes, cvss_score }) => {
      try {
        const updated = await client.updateFinding(finding_id, {
          status,
          severity,
          description: notes,
          cvss_score,
        });
        return mcpSuccessResponse(updated);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 12. triage_finding
  server.tool(
    "triage_finding",
    "Trigger automated LLM triage on a finding.",
    { finding_id: z.string() },
    async ({ finding_id }) => {
      try {
        const res = await client.triageFinding(finding_id);
        return mcpSuccessResponse(res);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 13. trigger_scan
  server.tool(
    "trigger_scan",
    "Initiate an automated reconnaissance and vulnerability scan job against a target.",
    {
      program_id: z.string(),
      tool: z.enum(["subfinder", "httpx", "naabu", "katana", "nuclei", "gau", "waybackurls"]),
      target: z.string(),
      stage: z.number().optional().default(1),
    },
    async ({ program_id, tool, target, stage }) => {
      try {
        const job = await client.createJob({ program_id, tool, target, stage });
        return mcpSuccessResponse(job);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 14. get_scan_jobs
  server.tool(
    "get_scan_jobs",
    "List recent scan jobs, their status, started/completed timestamps, and error logs.",
    {
      program_id: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ program_id, status }) => {
      try {
        const jobs = await client.listJobs({ program_id, status });
        return mcpSuccessResponse(jobs);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );

  // 15. generate_bug_bounty_report
  server.tool(
    "generate_bug_bounty_report",
    "Generate a complete, professionally formatted bug bounty report ready for submission.",
    { program_id: z.string() },
    async ({ program_id }) => {
      try {
        const report = await client.generateReport(program_id);
        return mcpSuccessResponse(report.markdown);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, e.message);
      }
    }
  );
}
