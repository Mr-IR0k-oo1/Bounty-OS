import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerScopeTools(server: McpServer, client: BountyOSClient) {
  // 1. scope.get
  server.tool(
    "scope.get",
    "Retrieve the full list of authorized in-scope assets and explicitly excluded out-of-scope targets for an investigation.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("scope.get");
      if (permErr) {
        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scope.get",
          arguments: { investigation_id },
          duration_ms: Date.now() - startTime,
          result: "DENIED",
          error: permErr.error.message,
        });
        return mcpErrorResponse(permErr.error.code, permErr.error.message);
      }

      try {
        const rules = await client.listScope(investigation_id);
        const inScope = rules.filter((r) => !r.out_of_scope);
        const outOfScope = rules.filter((r) => r.out_of_scope);

        const result = {
          investigation_id,
          total_rules: rules.length,
          in_scope: inScope.map((r) => ({
            id: r.id,
            target: r.target,
            target_type: r.target_type,
            notes: r.notes,
          })),
          out_of_scope: outOfScope.map((r) => ({
            id: r.id,
            target: r.target,
            target_type: r.target_type,
            notes: r.notes,
          })),
        };

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scope.get",
          arguments: { investigation_id },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(result);
      } catch (e: any) {
        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scope.get",
          arguments: { investigation_id },
          duration_ms: Date.now() - startTime,
          result: "FAILED",
          error: e.message,
        });
        return mcpErrorResponse(
          McpErrorCode.INVESTIGATION_NOT_FOUND,
          `Failed to retrieve scope for investigation '${investigation_id}': ${e.message}`
        );
      }
    }
  );

  // 2. scope.validate
  server.tool(
    "scope.validate",
    "CRITICAL SAFETY CHECK: Strictly evaluates whether a requested target (hostname, domain, IP, or URL) belongs to the authorized configured scope before any scanning is performed.",
    {
      investigation_id: z.string().optional().describe("The UUID of the investigation / program. If omitted, checks against active investigations."),
      target: z.string().describe("The target hostname, IP, or domain to evaluate (e.g. app.target.local)"),
    },
    async ({ investigation_id, target }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("scope.validate");
      if (permErr) {
        return mcpErrorResponse(permErr.error.code, permErr.error.message);
      }

      const inputErr = globalPolicyEngine.validateInput(target, "target");
      if (inputErr) {
        return mcpErrorResponse(inputErr.error.code, inputErr.error.message);
      }

      try {
        let programsToSearch: string[] = [];
        if (investigation_id) {
          programsToSearch.push(investigation_id);
        } else {
          const progs = await client.listPrograms();
          programsToSearch = progs.filter((p) => p.active).map((p) => p.id);
        }

        if (programsToSearch.length === 0) {
          return mcpSuccessResponse({
            target,
            allowed: false,
            reason: "Target is outside configured scope (no active investigations configured)",
          });
        }

        let combinedRules: any[] = [];
        for (const pid of programsToSearch) {
          try {
            const rules = await client.listScope(pid);
            combinedRules = combinedRules.concat(rules);
          } catch {
            // Skip unavailable program scope
          }
        }

        const evaluation = globalPolicyEngine.validateScope(target, combinedRules);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scope.validate",
          arguments: { investigation_id, target },
          duration_ms: Date.now() - startTime,
          result: evaluation.allowed ? "SUCCESS" : "DENIED",
        });

        return mcpSuccessResponse({
          target,
          allowed: evaluation.allowed,
          reason: evaluation.reason,
          ...(evaluation.matched_rule ? { matched_rule: evaluation.matched_rule } : {}),
          ...(evaluation.rule_type ? { rule_type: evaluation.rule_type } : {}),
        });
      } catch (e: any) {
        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "scope.validate",
          arguments: { investigation_id, target },
          duration_ms: Date.now() - startTime,
          result: "FAILED",
          error: e.message,
        });
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Scope evaluation error: ${e.message}`
        );
      }
    }
  );
}
