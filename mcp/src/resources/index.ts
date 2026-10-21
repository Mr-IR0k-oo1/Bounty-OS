import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BountyOSClient } from "../client.js";
import { redactObject, redactSecrets } from "../policy/redaction.js";

export function registerResources(server: McpServer, client: BountyOSClient) {
  // Static resources
  server.resource(
    "programs",
    "bountyos://programs",
    async (uri) => {
      try {
        const programs = await client.listPrograms();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(programs, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error loading programs: ${e.message}`,
            },
          ],
        };
      }
    }
  );

  server.resource(
    "active-findings",
    "bountyos://findings/active",
    async (uri) => {
      try {
        const findings = await client.listFindings();
        const active = findings.filter((f) => f.status !== "resolved");
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(active, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error loading active findings: ${e.message}`,
            },
          ],
        };
      }
    }
  );

  // Dynamic: investigation://{id}
  server.resource(
    "investigation-overview",
    new ResourceTemplate("investigation://{id}", { list: undefined }),
    async (uri, { id }) => {
      try {
        const program = await client.getProgram(String(id));
        const scope = await client.listScope(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ program, scope }, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/assets
  server.resource(
    "investigation-assets",
    new ResourceTemplate("investigation://{id}/assets", { list: undefined }),
    async (uri, { id }) => {
      try {
        const subs = await client.listSubdomains(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(subs, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/services
  server.resource(
    "investigation-services",
    new ResourceTemplate("investigation://{id}/services", { list: undefined }),
    async (uri, { id }) => {
      try {
        const subs = await client.listSubdomains(String(id));
        const allPorts: any[] = [];
        for (const s of subs) {
          try {
            const ports = await client.listPorts(s.id);
            allPorts.push({ hostname: s.subdomain, ports });
          } catch {}
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(allPorts, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/endpoints
  server.resource(
    "investigation-endpoints",
    new ResourceTemplate("investigation://{id}/endpoints", { list: undefined }),
    async (uri, { id }) => {
      try {
        const urls = await client.listUrls(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(urls, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/findings
  server.resource(
    "investigation-findings",
    new ResourceTemplate("investigation://{id}/findings", { list: undefined }),
    async (uri, { id }) => {
      try {
        const findings = await client.listFindings({ program_id: String(id) });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(findings, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/evidence
  server.resource(
    "investigation-evidence",
    new ResourceTemplate("investigation://{id}/evidence", { list: undefined }),
    async (uri, { id }) => {
      try {
        const findings = await client.listFindings({ program_id: String(id) });
        const evidenceRecords = findings
          .filter((f) => f.curl_command || f.matched_at)
          .map((f) => ({
            finding_id: f.id,
            matched_at: f.matched_at,
            curl_command: f.curl_command,
            description: f.description,
          }));
        const sanitized = redactObject(evidenceRecords);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(sanitized, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/timeline
  server.resource(
    "investigation-timeline",
    new ResourceTemplate("investigation://{id}/timeline", { list: undefined }),
    async (uri, { id }) => {
      try {
        const jobs = await client.listJobs({ program_id: String(id) });
        const findings = await client.listFindings({ program_id: String(id) });

        const timeline: any[] = [];
        jobs.forEach((j) => {
          timeline.push({
            type: "SCAN_JOB",
            timestamp: j.created_at,
            job_id: j.id,
            stage: j.stage,
            status: j.status,
            completed_at: j.completed_at,
          });
        });

        findings.forEach((f) => {
          timeline.push({
            type: "FINDING_DISCOVERED",
            timestamp: f.created_at,
            finding_id: f.id,
            title: f.title,
            severity: f.severity,
            status: f.status,
          });
        });

        timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(timeline, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );

  // Dynamic: investigation://{id}/report
  server.resource(
    "investigation-report",
    new ResourceTemplate("investigation://{id}/report", { list: undefined }),
    async (uri, { id }) => {
      try {
        const report = await client.generateReport(String(id));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: redactSecrets(report.markdown),
            },
          ],
        };
      } catch (e: any) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${e.message}` }],
        };
      }
    }
  );
}
