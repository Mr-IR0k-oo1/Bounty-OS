import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerAttackSurfaceTools(server: McpServer, client: BountyOSClient) {
  // 1. attack_surface.summary
  server.tool(
    "attack_surface.summary",
    "Get high-level tier counts and summary metrics of the investigation attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const summary = await client.getAttackSurfaceSummary(investigation_id);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.summary",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(summary);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface summary: ${e.message}`
        );
      }
    }
  );

  // 2. attack_surface.assets
  server.tool(
    "attack_surface.assets",
    "List discovered assets (subdomains and root targets) in the attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const graph = await client.getAttackSurfaceGraph(investigation_id);
        const assets = (graph.nodes || []).filter(
          (n: any) => n.node_type === "asset" || n.node_type === "target"
        );

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.assets",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          total: assets.length,
          assets,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface assets: ${e.message}`
        );
      }
    }
  );

  // 3. attack_surface.services
  server.tool(
    "attack_surface.services",
    "List active network and HTTP services in the attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const graph = await client.getAttackSurfaceGraph(investigation_id);
        const services = (graph.nodes || []).filter(
          (n: any) => n.node_type === "service" || n.node_type === "http_service"
        );

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.services",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          total: services.length,
          services,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface services: ${e.message}`
        );
      }
    }
  );

  // 4. attack_surface.endpoints
  server.tool(
    "attack_surface.endpoints",
    "List discovered HTTP and API endpoints in the attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const graph = await client.getAttackSurfaceGraph(investigation_id);
        const endpoints = (graph.nodes || []).filter((n: any) => n.node_type === "endpoint");

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.endpoints",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          total: endpoints.length,
          endpoints,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface endpoints: ${e.message}`
        );
      }
    }
  );

  // 5. attack_surface.parameters
  server.tool(
    "attack_surface.parameters",
    "List input parameters and query variables discovered in the attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const graph = await client.getAttackSurfaceGraph(investigation_id);
        const parameters = (graph.nodes || []).filter((n: any) => n.node_type === "parameter");

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.parameters",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          total: parameters.length,
          parameters,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface parameters: ${e.message}`
        );
      }
    }
  );

  // 6. attack_surface.relationships
  server.tool(
    "attack_surface.relationships",
    "Query provenance relationship edges in the attack surface graph.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const relationships = await client.getAttackSurfaceRelationships(investigation_id);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.relationships",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          total: relationships.length,
          relationships,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve attack surface relationships: ${e.message}`
        );
      }
    }
  );

  // 7. attack_surface.unexplored
  server.tool(
    "attack_surface.unexplored",
    "Query currently unexplored attack surface nodes to drive next action prioritization in the adaptive planner.",
    {
      investigation_id: z.string().describe("The UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const unexplored = await client.getAttackSurfaceUnexplored(investigation_id);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "attack_surface.unexplored",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          investigation_id,
          unexplored_count: unexplored.length,
          unexplored,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to query unexplored attack surface: ${e.message}`
        );
      }
    }
  );
}
