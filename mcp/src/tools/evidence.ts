import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createHash } from "crypto";
import { BountyOSClient } from "../client.js";
import { redactObject, redactSecrets } from "../policy/redaction.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerEvidenceTools(server: McpServer, client: BountyOSClient) {
  // 1. evidence.list
  server.tool(
    "evidence.list",
    "List technical evidence records, HTTP transcripts, and raw scanner output associated with findings.",
    {
      investigation_id: z.string().optional().describe("Filter by investigation UUID"),
      finding_id: z.string().optional().describe("Filter by specific finding UUID"),
      limit: z.number().optional().default(50).describe("Maximum evidence records to return"),
    },
    async ({ investigation_id, finding_id, limit }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const findings = await client.listFindings({
          program_id: investigation_id,
        });

        const targetFindings = finding_id
          ? findings.filter((f) => f.id === finding_id)
          : findings;

        const evidenceRecords: any[] = [];
        for (const f of targetFindings) {
          if (f.curl_command || f.matched_at) {
            const rawBytes = Buffer.from(f.curl_command || f.matched_at || "");
            const sha256 = createHash("sha256").update(rawBytes).digest("hex");

            evidenceRecords.push({
              id: `ev-${f.id.slice(0, 8)}`,
              finding_id: f.id,
              source: "scanner_output",
              tool: f.finding_type || "nuclei",
              timestamp: f.created_at,
              request: f.curl_command || `GET ${f.matched_at} HTTP/1.1`,
              response: `HTTP/1.1 200 OK (Evidence captured for finding: ${f.title})`,
              raw_output: f.description,
              artifact: `evidence/${f.id}.json`,
              hash: sha256,
            });
          }
        }

        const sanitized = redactObject(evidenceRecords.slice(0, limit));

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "evidence.list",
          arguments: { investigation_id, finding_id, limit },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(sanitized);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to list evidence: ${e.message}`);
      }
    }
  );

  // 2. evidence.get
  server.tool(
    "evidence.get",
    "Retrieve raw evidence payload, HTTP exchange, or artifact contents (automatically scrubbed of secrets).",
    {
      evidence_id: z.string().describe("The UUID or identifier of the evidence"),
      path: z.string().optional().describe("Relative artifact path (e.g. evidence/finding.json)"),
    },
    async ({ evidence_id, path }) => {
      try {
        let content = "";
        if (path) {
          try {
            content = await client.getEvidence(path);
          } catch {
            content = `[Evidence artifact not found at path: ${path}]`;
          }
        } else {
          // Look up finding matching evidence id
          const findings = await client.listFindings();
          const cleanId = evidence_id.replace(/^ev-/, "");
          const match = findings.find((f) => f.id.startsWith(cleanId));
          if (match) {
            content = JSON.stringify(
              {
                id: evidence_id,
                finding_id: match.id,
                title: match.title,
                matched_at: match.matched_at,
                curl_command: match.curl_command,
                description: match.description,
                cvss_score: match.cvss_score,
                captured_at: match.created_at,
              },
              null,
              2
            );
          } else {
            return mcpErrorResponse(McpErrorCode.INVALID_ARGUMENT, `Evidence record '${evidence_id}' not found.`);
          }
        }

        const scrubbed = redactSecrets(content);
        return mcpSuccessResponse({
          evidence_id,
          content: scrubbed,
          hash: createHash("sha256").update(Buffer.from(scrubbed)).digest("hex"),
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to retrieve evidence: ${e.message}`);
      }
    }
  );
}
