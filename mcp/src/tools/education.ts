import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerEducationTools(server: McpServer, client: BountyOSClient) {
  // 1. education.lesson
  server.tool(
    "education.lesson",
    "Help Me Learn: Retrieve dynamic contextual security lesson, next recommended action, rationale, and learning objectives based on current investigation state.",
    {
      investigation_id: z.string().describe("UUID of the investigation"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const lesson = await client.getInvestigationEducation(investigation_id);

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "education.lesson",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(lesson);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to retrieve education lesson: ${e.message}`
        );
      }
    }
  );

  // 2. education.explain
  server.tool(
    "education.explain",
    "Explain security vulnerability concepts, authorization models, and deterministic verification techniques.",
    {
      concept: z.string().describe("Security concept or vulnerability class (e.g. idor, bola, graphql_introspection, ssrf, xss, sqli)"),
    },
    async ({ concept }) => {
      const c = concept.toLowerCase();
      let explanation = {
        concept,
        description: "Security concept in bug bounty investigations",
        testing_strategy: "Gather empirical evidence using deterministic probes without disruptive payloads",
        evidence_required: "HTTP request/response proof-of-concept",
      };

      if (c.includes("idor") || c.includes("bola")) {
        explanation = {
          concept: "Broken Object Level Authorization (BOLA / IDOR)",
          description: "Occurs when an API endpoint relies on user-supplied identifiers (IDs, GUIDs, usernames) to access objects without validating caller ownership.",
          testing_strategy: "Create two separate authorized identities (User A and User B). Have User B request User A's private resource ID.",
          evidence_required: "HTTP 200 OK returning User A's private data when authenticated with User B's token.",
        };
      } else if (c.includes("graphql")) {
        explanation = {
          concept: "GraphQL Security & Schema Introspection",
          description: "Introspection queries permit full extraction of query, mutation, and type schemas, exposing unadvertised administrative operations.",
          testing_strategy: "Submit standard introspection query `query { __schema { types { name } } }` to discovered `/graphql` routes.",
          evidence_required: "Valid JSON schema payload listing internal models and operations.",
        };
      } else if (c.includes("ssrf")) {
        explanation = {
          concept: "Server-Side Request Forgery (SSRF)",
          description: "Web application fetches a remote resource without validating the user-supplied destination URL, allowing requests to loopback (127.0.0.1) or internal metadata services.",
          testing_strategy: "Supply out-of-band collaborator URL or loopback probe on URL parameters.",
          evidence_required: "Inbound HTTP/DNS callback with request ID from the target server IP.",
        };
      }

      return mcpSuccessResponse(explanation);
    }
  );
}
