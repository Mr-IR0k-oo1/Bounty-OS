import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerAssetTools(server: McpServer, client: BountyOSClient) {
  // 1. assets.list
  server.tool(
    "assets.list",
    "Retrieve normalized network and web assets (hosts, domains, subdomains) discovered by Bounty OS for an investigation.",
    {
      investigation_id: z.string().optional().describe("The UUID of the investigation / program"),
      host: z.string().optional().describe("Filter by hostname substring"),
      limit: z.number().optional().default(100).describe("Maximum number of assets to return"),
    },
    async ({ investigation_id, host, limit }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        let programsToQuery: string[] = [];
        if (investigation_id) {
          programsToQuery.push(investigation_id);
        } else {
          const progs = await client.listPrograms();
          programsToQuery = progs.map((p) => p.id);
        }

        let allAssets: any[] = [];
        for (const pid of programsToQuery) {
          try {
            const subs = await client.listSubdomains(pid);
            allAssets = allAssets.concat(subs);
          } catch {}
        }

        if (host) {
          const filter = host.toLowerCase();
          allAssets = allAssets.filter((a) => a.subdomain.toLowerCase().includes(filter));
        }

        const normalized = allAssets.slice(0, limit).map((a) => ({
          id: a.id,
          investigation_id: a.program_id,
          hostname: a.subdomain,
          ip_addresses: a.ip_address ? [a.ip_address] : [],
          ports: a.ports || [],
          technologies: a.tech || [],
          http_services: a.status_code
            ? [
                {
                  status_code: a.status_code,
                  web_server: a.web_server,
                  title: a.title,
                },
              ]
            : [],
          sources: [a.source || "recon"],
          created_at: a.created_at,
        }));

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "assets.list",
          arguments: { investigation_id, host, limit },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(normalized);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to list assets: ${e.message}`);
      }
    }
  );

  // 2. asset.get
  server.tool(
    "asset.get",
    "Retrieve comprehensive asset intelligence for a single host by its ID, including DNS, ports, services, and web metadata.",
    {
      asset_id: z.string().describe("The UUID of the asset (subdomain)"),
    },
    async ({ asset_id }) => {
      try {
        const subdomain = await client.getSubdomain(asset_id);
        let ports: any[] = [];
        try {
          ports = await client.listPorts(asset_id);
        } catch {}

        const result = {
          id: subdomain.id,
          investigation_id: subdomain.program_id,
          hostname: subdomain.subdomain,
          ip_addresses: subdomain.ip_address ? [subdomain.ip_address] : [],
          cname: subdomain.cname,
          ports: ports.map((p) => ({
            port: p.port,
            protocol: p.protocol,
            service: p.service,
            state: p.state,
            banner: p.banner,
          })),
          technologies: subdomain.tech || [],
          http_service: subdomain.status_code
            ? {
                status_code: subdomain.status_code,
                web_server: subdomain.web_server,
                title: subdomain.title,
              }
            : null,
          source: subdomain.source,
          created_at: subdomain.created_at,
        };

        return mcpSuccessResponse(result);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INVALID_ARGUMENT,
          `Asset '${asset_id}' not found: ${e.message}`
        );
      }
    }
  );
}
