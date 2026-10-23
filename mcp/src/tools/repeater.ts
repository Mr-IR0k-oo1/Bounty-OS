import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerRepeaterTools(server: McpServer, client: BountyOSClient) {
  // 1. repeater.replay
  server.tool(
    "repeater.replay",
    "Controlled HTTP Request Flow Repeater: apply header/path/method/body mutations and execute dry-run simulation or live scoped replay.",
    {
      investigation_id: z.string().describe("UUID of the investigation"),
      flow: z.object({
        id: z.string().default("00000000-0000-0000-0000-000000000000"),
        name: z.string().describe("Name of the request flow"),
        target_url: z.string().describe("Base target URL"),
        method: z.string().default("GET"),
        headers: z.record(z.string()).default({}),
        body: z.string().optional(),
        mutations: z.array(z.any()).default([]),
      }),
      dry_run: z.boolean().default(false).describe("If true, returns mutated request structure without executing live network request"),
    },
    async ({ investigation_id, flow, dry_run }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        if (!dry_run) {
          const cleanTarget = globalPolicyEngine.normalizeTarget(flow.target_url);
          const scope = await client.listScope(investigation_id);
          const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
          if (!scopeCheck.allowed) {
            return mcpErrorResponse(
              McpErrorCode.SCOPE_DENIED,
              `Target ${flow.target_url} is out of scope: ${scopeCheck.reason}`
            );
          }
        }

        const res = await client.replayInvestigationFlow(investigation_id, flow, dry_run);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "repeater.replay",
          arguments: { investigation_id, target_url: flow.target_url, dry_run },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(res);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to execute request flow: ${e.message}`
        );
      }
    }
  );
}
