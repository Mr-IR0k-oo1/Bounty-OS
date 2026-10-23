import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerBehaviorTools(server: McpServer, client: BountyOSClient) {
  // 1. behavior.analyze
  server.tool(
    "behavior.analyze",
    "Probe target HTTP behavior: inspect response headers for WAF signatures (Cloudflare, Akamai, AWS WAF, Imperva), detect rate-limiting (429), and analyze active blocking differences.",
    {
      investigation_id: z.string().describe("UUID of the investigation"),
      target_url: z.string().describe("Target URL to evaluate"),
    },
    async ({ investigation_id, target_url }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const cleanTarget = globalPolicyEngine.normalizeTarget(target_url);
        const scope = await client.listScope(investigation_id);
        const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
        if (!scopeCheck.allowed) {
          return mcpErrorResponse(
            McpErrorCode.SCOPE_DENIED,
            `Target ${target_url} is out of scope: ${scopeCheck.reason}`
          );
        }

        const report = await client.analyzeInvestigationBehavior(investigation_id, target_url);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "behavior.analyze",
          arguments: { investigation_id, target_url },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(report);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to analyze behavior: ${e.message}`
        );
      }
    }
  );
}
