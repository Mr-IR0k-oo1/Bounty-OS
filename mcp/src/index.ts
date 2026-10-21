#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import http from "http";
import dotenv from "dotenv";
import { BountyOSClient } from "./client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

dotenv.config();

export function createBountyOSServer(): McpServer {
  const server = new McpServer({
    name: "bountyos-mcp",
    version: "2.0.0",
  });

  const client = new BountyOSClient();

  // Register modular tools, resources, and prompts
  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}

async function startStdio() {
  const server = createBountyOSServer();
  const transport = new StdioServerTransport();

  process.stderr.write("[BountyOS-MCP] Starting Model Context Protocol Server (stdio transport)...\n");
  await server.connect(transport);
  process.stderr.write("[BountyOS-MCP] Connected and listening for agent JSON-RPC messages on stdio.\n");
}

async function startSSE(port: number) {
  const server = createBountyOSServer();
  let sseTransport: SSEServerTransport | null = null;

  const httpServer = http.createServer(async (req, res) => {
    // Enable permissive CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || "", `http://${req.headers.host}`);

    if (url.pathname === "/sse" && req.method === "GET") {
      process.stderr.write("[BountyOS-MCP] SSE connection established.\n");
      sseTransport = new SSEServerTransport("/messages", res);
      await server.connect(sseTransport);
    } else if (url.pathname === "/messages" && req.method === "POST") {
      if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "SSE session not established yet" }));
      }
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "bountyos-mcp", version: "2.0.0" }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
  });

  httpServer.listen(port, "0.0.0.0", () => {
    process.stderr.write(`[BountyOS-MCP] SSE Server listening on http://0.0.0.0:${port}/sse\n`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isSSE = args.includes("--sse") || process.env.MCP_TRANSPORT === "sse";
  const portArgIdx = args.indexOf("--port");
  const port =
    portArgIdx !== -1 && args[portArgIdx + 1]
      ? parseInt(args[portArgIdx + 1], 10)
      : parseInt(process.env.PORT || "3005", 10);

  if (isSSE) {
    await startSSE(port);
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  process.stderr.write(`[BountyOS-MCP] Fatal error: ${err.message}\n`);
  process.exit(1);
});
