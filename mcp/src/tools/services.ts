import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerServiceTools(server: McpServer, client: BountyOSClient) {
  // 1. services.list
  server.tool(
    "services.list",
    "List open ports and running network/web services discovered across in-scope assets.",
    {
      investigation_id: z.string().optional().describe("The UUID of the investigation"),
      asset_id: z.string().optional().describe("Filter by specific asset UUID"),
      port: z.number().optional().describe("Filter by specific port number (e.g. 443, 8080)"),
    },
    async ({ investigation_id, asset_id, port }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        let assetsToQuery: any[] = [];
        if (asset_id) {
          try {
            const asset = await client.getSubdomain(asset_id);
            assetsToQuery.push(asset);
          } catch {}
        } else if (investigation_id) {
          const subs = await client.listSubdomains(investigation_id);
          assetsToQuery = subs;
        } else {
          const progs = await client.listPrograms();
          for (const p of progs) {
            try {
              const subs = await client.listSubdomains(p.id);
              assetsToQuery = assetsToQuery.concat(subs);
            } catch {}
          }
        }

        const services: any[] = [];
        for (const asset of assetsToQuery) {
          try {
            const ports = await client.listPorts(asset.id);
            for (const p of ports) {
              if (port && p.port !== port) continue;
              services.push({
                id: p.id,
                investigation_id: asset.program_id,
                asset_id: asset.id,
                hostname: asset.subdomain,
                ip: p.ip || asset.ip_address || "N/A",
                port: p.port,
                protocol: p.protocol,
                service_name: p.service || (p.port === 443 ? "https" : p.port === 80 ? "http" : "unknown"),
                state: p.state,
                banner: p.banner,
                http_status: asset.status_code,
                title: asset.title,
                technology: asset.tech || [],
                source: asset.source || "port_scan",
                discovery_timestamp: p.created_at,
              });
            }
          } catch {}
        }

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "services.list",
          arguments: { investigation_id, asset_id, port },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(services);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to list services: ${e.message}`);
      }
    }
  );

  // 2. service.get
  server.tool(
    "service.get",
    "Get detailed technical attributes and banner for a specific open service.",
    {
      service_id: z.string().describe("The UUID of the service / port record"),
    },
    async ({ service_id }) => {
      try {
        // Query across programs or ports
        const progs = await client.listPrograms();
        for (const p of progs) {
          const subs = await client.listSubdomains(p.id);
          for (const s of subs) {
            const ports = await client.listPorts(s.id);
            const matched = ports.find((pt) => pt.id === service_id);
            if (matched) {
              return mcpSuccessResponse({
                id: matched.id,
                hostname: s.subdomain,
                ip: matched.ip,
                port: matched.port,
                protocol: matched.protocol,
                service: matched.service,
                state: matched.state,
                banner: matched.banner,
                http_status: s.status_code,
                title: s.title,
                created_at: matched.created_at,
              });
            }
          }
        }

        return mcpErrorResponse(McpErrorCode.INVALID_ARGUMENT, `Service '${service_id}' not found.`);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Error retrieving service: ${e.message}`);
      }
    }
  );
}
