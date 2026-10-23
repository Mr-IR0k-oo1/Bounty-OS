import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerThreatTools(server: McpServer, client: BountyOSClient) {
  // 1. threat.model
  server.tool(
    "threat.model",
    "Synthesize attack surface state into formal STRIDE threat representations (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege), strictly distinguishing between Observed, Inferred, Hypothesized, and Verified threats.",
    {
      investigation_id: z.string().describe("UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const threats = await client.getInvestigationThreats(investigation_id);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "threat.model",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(threats);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to generate threat model: ${e.message}`
        );
      }
    }
  );
}
