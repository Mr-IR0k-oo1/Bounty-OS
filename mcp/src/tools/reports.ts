import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerReportTools(server: McpServer, client: BountyOSClient) {
  // 1. report.generate
  server.tool(
    "report.generate",
    "Generate a structured security assessment and bug bounty vulnerability report for an investigation.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
      format: z.enum(["markdown", "json"]).default("markdown").describe("Report output format"),
    },
    async ({ investigation_id, format }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const reportData = await client.generateReport(investigation_id);
        const findings = await client.listFindings({ program_id: investigation_id });

        // Categorize into required validation distinctions
        const categorized = {
          confirmed: findings.filter((f) => f.status === "validated" || f.status === "confirmed"),
          likely: findings.filter((f) => f.status === "triaged" || f.status === "likely"),
          unverified: findings.filter((f) => f.status === "new" || f.status === "candidate" || f.status === "unverified"),
          false_positive: findings.filter((f) => f.status === "resolved" || f.status === "false_positive"),
          informational: findings.filter((f) => f.severity === "info"),
        };

        if (format === "json") {
          const jsonReport = {
            investigation_id,
            program_name: reportData.program_name,
            generated_at: reportData.generated_at,
            total_findings: reportData.total_findings,
            classification: {
              confirmed_count: categorized.confirmed.length,
              likely_count: categorized.likely.length,
              unverified_count: categorized.unverified.length,
              false_positive_count: categorized.false_positive.length,
              informational_count: categorized.informational.length,
            },
            severity_breakdown: reportData.severity_breakdown,
            findings: {
              CONFIRMED: categorized.confirmed,
              LIKELY: categorized.likely,
              UNVERIFIED: categorized.unverified,
              FALSE_POSITIVE: categorized.false_positive,
              INFORMATIONAL: categorized.informational,
            },
          };

          McpLogger.logOperation({
            request_id: requestId,
            actor: "agent",
            tool: "report.generate",
            arguments: { investigation_id, format },
            duration_ms: Date.now() - startTime,
            result: "SUCCESS",
          });

          return mcpSuccessResponse(jsonReport);
        }

        // Markdown format
        let md = reportData.markdown;
        md += "\n---\n\n## Verification Status Classification\n\n";
        md += `| Classification | Count |\n|---|---:|\n`;
        md += `| **CONFIRMED** | ${categorized.confirmed.length} |\n`;
        md += `| **LIKELY** | ${categorized.likely.length} |\n`;
        md += `| **UNVERIFIED** | ${categorized.unverified.length} |\n`;
        md += `| **FALSE POSITIVE** | ${categorized.false_positive.length} |\n`;
        md += `| **INFORMATIONAL** | ${categorized.informational.length} |\n`;

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "report.generate",
          arguments: { investigation_id, format },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(md);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to generate report for investigation '${investigation_id}': ${e.message}`
        );
      }
    }
  );

  // 2. report.get
  server.tool(
    "report.get",
    "Retrieve the latest generated security assessment report for an investigation.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      try {
        const reportData = await client.generateReport(investigation_id);
        return mcpSuccessResponse({
          investigation_id,
          program_name: reportData.program_name,
          generated_at: reportData.generated_at,
          report: reportData.markdown,
        });
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INVESTIGATION_NOT_FOUND,
          `Report not found for investigation '${investigation_id}': ${e.message}`
        );
      }
    }
  );
}
