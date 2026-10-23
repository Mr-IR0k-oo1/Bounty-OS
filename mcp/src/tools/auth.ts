import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerAuthTools(server: McpServer, client: BountyOSClient) {
  // 1. auth.test_bola
  server.tool(
    "auth.test_bola",
    "Evidence-driven comparative authorization testing: tests if Identity B can access Resource A owned by Identity A without proper 401/403 authorization gating.",
    {
      investigation_id: z.string().describe("UUID of the investigation"),
      endpoint_template: z.string().describe("Target endpoint template containing {id} (e.g. https://api.example.com/users/{id}/orders)"),
      resource_id_a: z.string().describe("Identifier of resource owned by Identity A"),
      identity_b: z.object({
        label: z.string().describe("Identity B label (e.g. User B, Attacker)"),
        role: z.string().default("user").describe("Assigned role of Identity B"),
        token: z.string().default("").describe("Bearer token of Identity B"),
        custom_headers: z.record(z.string()).default({}),
      }).describe("Identity B credentials attempting access"),
    },
    async ({ investigation_id, endpoint_template, resource_id_a, identity_b }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const testUrl = endpoint_template.replace("{id}", resource_id_a);
        const cleanTarget = globalPolicyEngine.normalizeTarget(testUrl);
        const scope = await client.listScope(investigation_id);
        const scopeCheck = globalPolicyEngine.validateScope(cleanTarget, scope);
        if (!scopeCheck.allowed) {
          return mcpErrorResponse(
            McpErrorCode.SCOPE_DENIED,
            `Target ${testUrl} is out of scope: ${scopeCheck.reason}`
          );
        }

        const res = await client.testInvestigationAuthz(
          investigation_id,
          endpoint_template,
          resource_id_a,
          identity_b
        );

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "auth.test_bola",
          arguments: { investigation_id, endpoint_template, resource_id_a, identity_label: identity_b.label },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(res);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to execute BOLA authorization test: ${e.message}`
        );
      }
    }
  );
}
