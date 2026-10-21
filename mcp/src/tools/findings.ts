import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerFindingTools(server: McpServer, client: BountyOSClient) {
  // 1. findings.list
  server.tool(
    "findings.list",
    "Query security findings and vulnerabilities discovered across investigations with rich filtering.",
    {
      investigation_id: z.string().optional().describe("Filter by investigation / program UUID"),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("Filter by severity"),
      status: z.enum(["new", "candidate", "triaged", "validated", "reported", "resolved", "confirmed", "false_positive"]).optional().describe("Filter by status"),
      confidence: z.number().min(0).max(1).optional().describe("Minimum confidence score threshold (0.0 - 1.0)"),
      limit: z.number().optional().default(100).describe("Maximum findings to return"),
    },
    async ({ investigation_id, severity, status, confidence, limit }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const findings = await client.listFindings({
          program_id: investigation_id,
          severity,
          status,
        });

        let filtered = findings;
        if (confidence !== undefined) {
          filtered = filtered.filter((f) => (f.llm_confidence ?? 0) >= confidence);
        }

        const normalized = filtered.slice(0, limit).map((f) => {
          const confNum = f.llm_confidence ?? (f.status === "validated" ? 0.9 : 0.6);
          const confRating = confNum >= 0.8 ? "high" : confNum >= 0.5 ? "medium" : "low";
          let verStatus = "unverified";
          if (f.status === "validated" || f.status === "confirmed") verStatus = "confirmed";
          else if (f.status === "triaged" || f.status === "likely") verStatus = "likely";
          else if (f.status === "resolved" || f.status === "false_positive") verStatus = "false_positive";

          // Correlated detection sources (BBOT / BugBountyAI model)
          const sources: string[] = [];
          if (f.finding_type) sources.push(f.finding_type);
          if (f.tags) {
            for (const t of f.tags) {
              if (["nuclei", "dalfox", "ffuf", "katana", "subfinder"].includes(t.toLowerCase())) {
                sources.push(t.toLowerCase());
              }
            }
          }
          if (sources.length === 0) sources.push("nuclei");

          return {
            id: f.id,
            investigation_id: f.program_id,
            title: f.title,
            severity: f.severity, // critical, high, medium, low, info
            confidence: confRating, // high, medium, low
            confidence_score: confNum, // numeric 0.0 - 1.0
            verification_status: verStatus, // confirmed, likely, unverified, false_positive, insufficient_evidence
            finding_type: f.finding_type,
            matched_at: f.matched_at,
            cvss_score: f.cvss_score,
            sources: Array.from(new Set(sources)),
            tags: f.tags || [],
            created_at: f.created_at,
            updated_at: f.updated_at,
          };
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "findings.list",
          arguments: { investigation_id, severity, status, confidence, limit },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(normalized);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to list findings: ${e.message}`);
      }
    }
  );

  // 2. finding.get
  server.tool(
    "finding.get",
    "Retrieve complete technical details for a specific vulnerability finding, including PoC, curl commands, and triage assessment.",
    {
      finding_id: z.string().describe("The UUID of the finding"),
    },
    async ({ finding_id }) => {
      try {
        const finding = await client.getFinding(finding_id);
        return mcpSuccessResponse(finding);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.FINDING_NOT_FOUND, `Finding '${finding_id}' not found: ${e.message}`);
      }
    }
  );

  // 3. finding.analyze
  server.tool(
    "finding.analyze",
    "Send structured finding context and HTTP evidence to VulnLLM for automated triage, impact reasoning, and remediation guidance.",
    {
      finding_id: z.string().describe("The UUID of the finding"),
    },
    async ({ finding_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const finding = await client.getFinding(finding_id);

        // Trigger VulnLLM triage
        let triageResult = null;
        try {
          await client.triageFinding(finding_id);
          // Wait briefly for local rule engine evaluation
          await new Promise((r) => setTimeout(r, 600));
          triageResult = await client.getFindingTriage(finding_id);
        } catch {
          // If offline or rule analyzer output available on finding
          triageResult = finding.llm_triage_json ? { triage: finding.llm_triage_json } : null;
        }

        const assessment = {
          finding_id: finding.id,
          title: finding.title,
          assessment: {
            vulnerability_type: finding.finding_type || "security_weakness",
            severity: finding.severity,
            confidence: finding.llm_confidence ?? (finding.status === "validated" ? 0.95 : 0.65),
            false_positive_likelihood: (finding.severity === "info" || !finding.curl_command) ? "MODERATE" : "LOW",
            reasoning: triageResult?.triage?.analysis || `Identified weakness on endpoint ${finding.matched_at || "target"}.`,
            verification_required: [
              "Verify HTTP response status code matches expected vulnerable state",
              "Execute safe non-destructive PoC in authorized environment",
              "Inspect authorization headers to verify tenant isolation",
            ],
            impact: triageResult?.triage?.impact || "Potential unauthorized data exposure or security policy violation.",
            remediation: triageResult?.triage?.remediation || "Apply input sanitization, strict boundary checks, and least-privilege access controls.",
          },
          llm_evaluation: triageResult,
        };

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "finding.analyze",
          arguments: { finding_id },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(assessment);
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.FINDING_NOT_FOUND, `Failed to analyze finding: ${e.message}`);
      }
    }
  );

  // 4. finding.verify
  server.tool(
    "finding.verify",
    "Perform evidence-based verification of a vulnerability finding. The LLM cannot independently confirm a finding without technical evidence.",
    {
      finding_id: z.string().describe("The UUID of the finding to verify"),
      status: z.enum([
        "candidate",
        "unverified",
        "likely",
        "confirmed",
        "false_positive",
        "insufficient_evidence",
      ]).describe("New verification status"),
      verification_notes: z.string().optional().describe("Technical verification notes or PoC execution log"),
    },
    async ({ finding_id, status, verification_notes }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const finding = await client.getFinding(finding_id);

        // Safeguard rule: CONFIRMED requires technical evidence
        if (status === "confirmed") {
          const hasEvidence = !!(finding.curl_command || finding.matched_at || verification_notes);
          if (!hasEvidence) {
            return mcpErrorResponse(
              McpErrorCode.POLICY_DENIED,
              "Confirmation rejected: A finding cannot be marked as CONFIRMED without reproducible technical evidence (cURL command, payload, or execution output)."
            );
          }
        }

        // Map status to backend finding status
        let backendStatus = "triaged";
        let kanbanCol = "in_progress";
        if (status === "confirmed") {
          backendStatus = "validated";
          kanbanCol = "validated";
        } else if (status === "false_positive") {
          backendStatus = "resolved";
          kanbanCol = "closed";
        } else if (status === "candidate") {
          backendStatus = "new";
          kanbanCol = "backlog";
        }

        const updated = await client.updateFinding(finding_id, {
          status: backendStatus,
          kanban_column: kanbanCol,
          description: verification_notes
            ? `${finding.description || ""}\n\n[Verification Notes]: ${verification_notes}`.trim()
            : finding.description,
        });

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "finding.verify",
          arguments: { finding_id, status, verification_notes },
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse({
          finding_id: updated.id,
          verification_status: status,
          current_state: updated.status,
          kanban_column: updated.kanban_column,
          verified: status === "confirmed",
          message: `Finding ${finding_id} successfully updated to '${status}'.`,
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.FINDING_NOT_FOUND, `Failed to verify finding: ${e.message}`);
      }
    }
  );
}
