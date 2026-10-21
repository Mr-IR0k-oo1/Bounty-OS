import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerScanTools(server: McpServer, client: BountyOSClient) {
  // 1. scan.recon
  server.tool(
    "scan.recon",
    "Initiate an asynchronous reconnaissance scan (subfinder, dnsx) to discover subdomains and IP addresses for an authorized target.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
      target: z.string().optional().describe("Specific domain to enumerate. Defaults to investigation primary target."),
      profile: z.enum(["passive", "standard", "deep"]).default("standard").describe("Reconnaissance intensity"),
    },
    async ({ investigation_id, target, profile }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("scan.recon");
      if (permErr) return mcpErrorResponse(permErr.error.code, permErr.error.message);

      try {
        const program = await client.getProgram(investigation_id);
        const scope = await client.listScope(investigation_id);

        const targetToScan = target || scope.find((s) => !s.out_of_scope)?.target || program.program_url || "target.local";
        const cleanTarget = globalPolicyEngine.normalizeTarget(targetToScan);

        const inputErr = globalPolicyEngine.validateInput(cleanTarget, "target");
        if (inputErr) return mcpErrorResponse(inputErr.error.code, inputErr.error.message);

        const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
        if (!scopeCheck.allowed) {
          return mcpErrorResponse(McpErrorCode.SCOPE_DENIED, `Cannot launch scan: ${scopeCheck.reason}`);
        }

        const tool = "subfinder";
        const job = await client.createJob({
          program_id: investigation_id,
          tool,
          target: cleanTarget,
          stage: 1,
          flags: { profile },
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scan.recon",
          arguments: { investigation_id, target: cleanTarget, profile },
          investigation_id,
          job_id: job.id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          job_id: job.id,
          investigation_id,
          tool,
          target: cleanTarget,
          status: "queued",
          profile,
          message: "Reconnaissance job queued successfully. Monitor status via investigation.status or get_scan_jobs.",
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to launch recon scan: ${e.message}`);
      }
    }
  );

  // 2. scan.web
  server.tool(
    "scan.web",
    "Initiate an asynchronous HTTP probing and web technology discovery scan (httpx, katana, gau).",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
      target: z.string().optional().describe("Specific host or URL to probe"),
      profile: z.enum(["passive", "standard", "deep"]).default("standard").describe("Web discovery profile"),
    },
    async ({ investigation_id, target, profile }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("scan.web");
      if (permErr) return mcpErrorResponse(permErr.error.code, permErr.error.message);

      try {
        const program = await client.getProgram(investigation_id);
        const scope = await client.listScope(investigation_id);

        const targetToScan = target || scope.find((s) => !s.out_of_scope)?.target || program.program_url || "target.local";
        const cleanTarget = globalPolicyEngine.normalizeTarget(targetToScan);

        const inputErr = globalPolicyEngine.validateInput(cleanTarget, "target");
        if (inputErr) return mcpErrorResponse(inputErr.error.code, inputErr.error.message);

        const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
        if (!scopeCheck.allowed) {
          return mcpErrorResponse(McpErrorCode.SCOPE_DENIED, `Cannot launch web scan: ${scopeCheck.reason}`);
        }

        const tool = profile === "deep" ? "katana" : "httpx";
        const job = await client.createJob({
          program_id: investigation_id,
          tool,
          target: cleanTarget,
          stage: 2,
          flags: { profile },
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scan.web",
          arguments: { investigation_id, target: cleanTarget, profile },
          investigation_id,
          job_id: job.id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          job_id: job.id,
          investigation_id,
          tool,
          target: cleanTarget,
          status: "queued",
          profile,
          message: "Web discovery job queued successfully.",
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to launch web scan: ${e.message}`);
      }
    }
  );

  // 3. scan.vulnerabilities
  server.tool(
    "scan.vulnerabilities",
    "Initiate an asynchronous vulnerability scan job (Nuclei) against an authorized in-scope target.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
      target: z.string().optional().describe("Specific host or URL to scan"),
      profile: z.enum(["passive", "standard", "deep"]).default("standard").describe("Scanning profile"),
      templates: z.array(z.string()).optional().describe("Optional list of specific vulnerability template tags (e.g. ['cve', 'misconfig', 'cors'])"),
    },
    async ({ investigation_id, target, profile, templates }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("scan.vulnerabilities");
      if (permErr) return mcpErrorResponse(permErr.error.code, permErr.error.message);

      try {
        const program = await client.getProgram(investigation_id);

        // Active scanning requires explicit program approval safeguard
        if (!program.active_approved) {
          return mcpErrorResponse(
            McpErrorCode.POLICY_DENIED,
            "Active vulnerability scanning requires explicit authorization approval for this investigation."
          );
        }

        const scope = await client.listScope(investigation_id);
        const targetToScan = target || scope.find((s) => !s.out_of_scope)?.target || program.program_url || "target.local";
        const cleanTarget = globalPolicyEngine.normalizeTarget(targetToScan);

        const inputErr = globalPolicyEngine.validateInput(cleanTarget, "target");
        if (inputErr) return mcpErrorResponse(inputErr.error.code, inputErr.error.message);

        const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
        if (!scopeCheck.allowed) {
          return mcpErrorResponse(McpErrorCode.SCOPE_DENIED, `Cannot launch vulnerability scan: ${scopeCheck.reason}`);
        }

        const tool = "nuclei";
        const job = await client.createJob({
          program_id: investigation_id,
          tool,
          target: cleanTarget,
          stage: 4,
          flags: {
            profile,
            tags: templates || ["cve", "misconfiguration", "exposure"],
          },
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scan.vulnerabilities",
          arguments: { investigation_id, target: cleanTarget, profile, templates },
          investigation_id,
          job_id: job.id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          job_id: job.id,
          investigation_id,
          tool,
          target: cleanTarget,
          status: "queued",
          profile,
          message: "Vulnerability scan dispatched to worker queue.",
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to launch vulnerability scan: ${e.message}`);
      }
    }
  );
}
