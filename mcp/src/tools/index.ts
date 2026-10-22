import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BountyOSClient } from "../client.js";

import { registerScopeTools } from "./scope.js";
import { registerInvestigationTools } from "./investigation.js";
import { registerAssetTools } from "./assets.js";
import { registerServiceTools } from "./services.js";
import { registerEndpointTools } from "./endpoints.js";
import { registerScanTools } from "./scans.js";
import { registerFindingTools } from "./findings.js";
import { registerEvidenceTools } from "./evidence.js";
import { registerReportTools } from "./reports.js";
import { registerSystemTools } from "./system.js";
import { registerIntelligenceTools } from "./intelligence.js";
import { registerAliases } from "./aliases.js";

export function registerTools(server: McpServer, client: BountyOSClient) {
  // Primary High-Level Control Plane Tools
  registerSystemTools(server, client);
  registerScopeTools(server, client);
  registerInvestigationTools(server, client);
  registerIntelligenceTools(server, client);
  registerAssetTools(server, client);
  registerServiceTools(server, client);
  registerEndpointTools(server, client);
  registerScanTools(server, client);
  registerFindingTools(server, client);
  registerEvidenceTools(server, client);
  registerReportTools(server, client);

  // Backward Compatible Aliases
  registerAliases(server, client);
}
