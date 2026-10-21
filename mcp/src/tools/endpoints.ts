import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerEndpointTools(server: McpServer, client: BountyOSClient) {
  // 1. endpoints.list
  server.tool(
    "endpoints.list",
    "List HTTP/web endpoints, API paths, and URLs discovered by web crawlers (katana, gau, waybackurls).",
    {
      investigation_id: z.string().optional().describe("Filter by investigation UUID"),
      asset_id: z.string().optional().describe("Filter by specific asset UUID"),
      host: z.string().optional().describe("Filter by hostname substring"),
      method: z.string().optional().describe("Filter by HTTP method (GET, POST, etc.)"),
      limit: z.number().optional().default(100).describe("Maximum endpoints to return"),
    },
    async ({ investigation_id, asset_id, host, method, limit }) => {
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

        let endpoints: any[] = [];
        for (const pid of programsToQuery) {
          try {
            const urls = await client.listUrls(pid, asset_id);
            endpoints = endpoints.concat(urls);
          } catch {}
        }

        if (host) {
          const hLower = host.toLowerCase();
          endpoints = endpoints.filter((e) => e.url.toLowerCase().includes(hLower));
        }

        const normalized = endpoints.slice(0, limit).map((e) => {
          let parsedUrl: URL | null = null;
          try {
            parsedUrl = new URL(e.url);
          } catch {}

          const params: string[] = [];
          if (parsedUrl) {
            parsedUrl.searchParams.forEach((_, key) => params.push(key));
          }

          return {
            id: e.id,
            investigation_id: e.program_id,
            associated_asset_id: e.subdomain_id,
            url: e.url,
            method: method || "GET",
            status_code: e.status_code,
            parameters: params,
            content_type: e.content_type,
            content_length: e.content_length,
            source: e.source || "crawler",
            discovery_method: e.source === "gau" ? "passive_archive" : "active_crawl",
            created_at: e.created_at,
          };
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "endpoints.list",
          arguments: { investigation_id, asset_id, host, method, limit },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(normalized);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to list endpoints: ${e.message}`);
      }
    }
  );

  // 2. endpoint.get
  server.tool(
    "endpoint.get",
    "Get detailed schema, headers, and parameter definitions for a specific discovered web endpoint.",
    {
      endpoint_id: z.string().describe("The UUID of the endpoint / URL"),
    },
    async ({ endpoint_id }) => {
      try {
        const progs = await client.listPrograms();
        for (const p of progs) {
          const urls = await client.listUrls(p.id);
          const match = urls.find((u) => u.id === endpoint_id);
          if (match) {
            let parsedUrl: URL | null = null;
            try {
              parsedUrl = new URL(match.url);
            } catch {}

            const params: Record<string, string> = {};
            if (parsedUrl) {
              parsedUrl.searchParams.forEach((val, key) => {
                params[key] = val;
              });
            }

            return mcpSuccessResponse({
              id: match.id,
              investigation_id: match.program_id,
              associated_asset_id: match.subdomain_id,
              url: match.url,
              hostname: parsedUrl?.hostname,
              pathname: parsedUrl?.pathname,
              parameters: params,
              status_code: match.status_code,
              content_type: match.content_type,
              content_length: match.content_length,
              source: match.source,
              created_at: match.created_at,
            });
          }
        }

        return mcpErrorResponse(McpErrorCode.INVALID_ARGUMENT, `Endpoint '${endpoint_id}' not found.`);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Error retrieving endpoint: ${e.message}`);
      }
    }
  );
}
