import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BountyOSClient } from "../client.js";
import { globalPolicyEngine } from "../policy/engine.js";
import { McpLogger } from "../policy/logger.js";
import { McpErrorCode, mcpErrorResponse, mcpSuccessResponse } from "../schemas/errors.js";

export function registerInvestigationTools(server: McpServer, client: BountyOSClient) {
  // 1. investigation.start
  server.tool(
    "investigation.start",
    "Initialize and launch a structured security assessment and reconnaissance workflow against an authorized lab target.",
    {
      target: z.string().describe("Primary root domain or IP to assess (e.g. target.local)"),
      scope: z
        .object({
          domains: z.array(z.string()).optional().default([]),
          ips: z.array(z.string()).optional().default([]),
          excluded_hosts: z.array(z.string()).optional().default([]),
        })
        .optional()
        .describe("Scope boundary specifications for the engagement"),
      profile: z
        .enum(["passive", "standard", "deep"])
        .default("standard")
        .describe("Investigation scan profile (passive: OSINT/DNS, standard: web+port+nuclei, deep: fuzzing+crawling)"),
    },
    async ({ target, scope, profile }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      const permErr = globalPolicyEngine.checkPermission("investigation.start");
      if (permErr) {
        return mcpErrorResponse(permErr.error.code, permErr.error.message);
      }

      const inputErr = globalPolicyEngine.validateInput(target, "target");
      if (inputErr) {
        return mcpErrorResponse(inputErr.error.code, inputErr.error.message);
      }

      // 1. Pre-flight Scope Check
      const inDomains = scope?.domains || [target];
      const excluded = scope?.excluded_hosts || [];
      const syntheticRules = [
        ...inDomains.map((d) => ({ target: d, target_type: d.startsWith("*.") ? "wildcard" : "domain", out_of_scope: false })),
        ...excluded.map((d) => ({ target: d, target_type: "domain", out_of_scope: true })),
      ];

      const scopeCheck = globalPolicyEngine.validateScope(target, syntheticRules);
      if (!scopeCheck.allowed) {
        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "investigation.start",
          arguments: { target, profile },
          duration_ms: Date.now() - startTime,
          result: "DENIED",
          error: scopeCheck.reason,
        });
        return mcpErrorResponse(
          McpErrorCode.SCOPE_DENIED,
          `Cannot start investigation: ${scopeCheck.reason}`
        );
      }

      try {
        // 2. Locate or create a project
        const projects = await client.listProjects();
        let project = projects[0];
        if (!project) {
          project = await client.createProject("Security Assessment Engagement", "Automated MCP assessment project");
        }

        // 3. Locate existing active investigation or create a new unique one
        const cleanTarget = globalPolicyEngine.normalizeTarget(target);
        const existingPrograms = await client.listPrograms();
        let program = existingPrograms.find(
          (p) => (p.name.includes(cleanTarget) || p.program_url?.includes(cleanTarget)) && p.active
        );

        if (!program) {
          const progName = `Assessment ${cleanTarget} ${Date.now()}`;
          program = await client.createProgram(project.id, progName, "self-hosted", `https://${cleanTarget}`);
        }

        // 4. Enroll in-scope and out-of-scope rules
        for (const d of inDomains) {
          await client.addScopeTarget(program.id, {
            target: d,
            target_type: d.startsWith("*.") ? "wildcard" : "domain",
            out_of_scope: false,
          });
        }
        for (const ex of excluded) {
          await client.addScopeTarget(program.id, {
            target: ex,
            target_type: "domain",
            out_of_scope: true,
          });
        }

        // 5. Approve active scanning if required by profile
        if (profile !== "passive") {
          await client.approveProgram(program.id);
        }

        // 6. Queue initial scan job according to profile
        const initialTool = profile === "passive" ? "subfinder" : "subfinder";
        let job = null;
        try {
          job = await client.createJob({
            program_id: program.id,
            tool: initialTool,
            target: cleanTarget,
            stage: 1,
          });
        } catch (je: any) {
          process.stderr.write(`[Investigation] Initial job enqueue notice: ${je.message}\n`);
        }

        const responsePayload = {
          investigation_id: program.id,
          status: "queued" as const,
          target: cleanTarget,
          created_at: program.created_at || new Date().toISOString(),
          profile,
          initial_job_id: job ? job.id : null,
          active_jobs: job ? 1 : 0,
        };

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "investigation.start",
          arguments: { target, profile },
          investigation_id: program.id,
          job_id: job?.id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(responsePayload);
      } catch (e: any) {
        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "investigation.start",
          arguments: { target, profile },
          duration_ms: Date.now() - startTime,
          result: "FAILED",
          error: e.message,
        });
        return mcpErrorResponse(
          McpErrorCode.INTERNAL_ERROR,
          `Failed to initialize investigation: ${e.message}`
        );
      }
    }
  );

  // 2. investigation.status
  server.tool(
    "investigation.status",
    "Monitor active lifecycle state, current stage, progress percentage, and job telemetry of an ongoing investigation.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      const startTime = Date.now();
      const requestId = McpLogger.createRequestId();

      try {
        const program = await client.getProgram(investigation_id);
        const jobs = await client.listJobs({ program_id: investigation_id });
        const findings = await client.listFindings({ program_id: investigation_id });
        const subdomains = await client.listSubdomains(investigation_id);
        const urls = await client.listUrls(investigation_id);

        const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");
        const completedJobs = jobs.filter((j) => j.status === "completed");
        const failedJobs = jobs.filter((j) => j.status === "failed");

        // Compute current stage
        let stage = "recon";
        let progress = 10;
        if (jobs.some((j) => j.stage >= 4 || j.flags?.tool === "nuclei")) {
          stage = "vulnerability_discovery";
          progress = 75;
        } else if (jobs.some((j) => j.stage >= 3 || urls.length > 0)) {
          stage = "web_discovery";
          progress = 50;
        } else if (jobs.some((j) => j.stage >= 2 || subdomains.length > 0)) {
          stage = "service_discovery";
          progress = 30;
        }

        if (activeJobs.length === 0 && completedJobs.length > 0) {
          stage = findings.length > 0 ? "analysis" : "reporting";
          progress = 100;
        }

        const overallStatus = !program.active
          ? "cancelled"
          : activeJobs.length > 0
          ? "running"
          : "completed";

        const statusPayload = {
          investigation_id: program.id,
          name: program.name,
          status: overallStatus,
          stage,
          progress,
          active_jobs: activeJobs.length,
          completed_jobs: completedJobs.length,
          failed_jobs: failedJobs.length,
          assets_count: subdomains.length,
          endpoints_count: urls.length,
          findings_count: findings.length,
        };

        McpLogger.logOperation({
          request_id: requestId,
          actor: "agent",
          tool: "investigation.status",
          arguments: { investigation_id },
          investigation_id,
          duration_ms: Date.now() - startTime,
          result: "SUCCESS",
        });

        return mcpSuccessResponse(statusPayload);
      } catch (e: any) {
        return mcpErrorResponse(
          McpErrorCode.INVESTIGATION_NOT_FOUND,
          `Investigation '${investigation_id}' not found: ${e.message}`
        );
      }
    }
  );

  // 3. investigation.pause
  server.tool(
    "investigation.pause",
    "Temporarily pause active scan jobs and workflows for an investigation.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      try {
        const jobs = await client.listJobs({ program_id: investigation_id, status: "running" });
        let pausedCount = 0;
        for (const job of jobs) {
          try {
            await client.cancelJob(job.id);
            pausedCount++;
          } catch {}
        }
        return mcpSuccessResponse({
          investigation_id,
          status: "paused",
          active_jobs_halted: pausedCount,
          message: `Investigation paused. ${pausedCount} active jobs halted.`,
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to pause investigation: ${e.message}`);
      }
    }
  );

  // 4. investigation.resume
  server.tool(
    "investigation.resume",
    "Resume an investigation by relaunching discovery on enrolled targets.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      try {
        const program = await client.getProgram(investigation_id);
        const scope = await client.listScope(investigation_id);
        const primaryTarget = scope.find((s) => !s.out_of_scope)?.target || program.program_url || "target.local";
        const cleanTarget = globalPolicyEngine.normalizeTarget(primaryTarget);

        const newJob = await client.createJob({
          program_id: investigation_id,
          tool: "subfinder",
          target: cleanTarget,
          stage: 1,
        });

        return mcpSuccessResponse({
          investigation_id,
          status: "running",
          resumed_job_id: newJob.id,
          message: "Investigation resumed with discovery scan.",
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to resume investigation: ${e.message}`);
      }
    }
  );

  // 5. investigation.cancel
  server.tool(
    "investigation.cancel",
    "Cancel an active investigation and terminate any associated running scan jobs.",
    {
      investigation_id: z.string().describe("The UUID of the investigation / program"),
    },
    async ({ investigation_id }) => {
      try {
        const jobs = await client.listJobs({ program_id: investigation_id });
        let cancelledJobs = 0;
        for (const job of jobs.filter((j) => j.status === "running" || j.status === "queued")) {
          try {
            await client.cancelJob(job.id);
            cancelledJobs++;
          } catch {}
        }

        await client.updateProgram(investigation_id, { active: false });

        return mcpSuccessResponse({
          investigation_id,
          status: "cancelled",
          cancelled_jobs_count: cancelledJobs,
          message: "Investigation and all pending/running jobs have been successfully cancelled.",
        });
      } catch (e: any) {
        return mcpErrorResponse(McpErrorCode.INTERNAL_ERROR, `Failed to cancel investigation: ${e.message}`);
      }
    }
  );
}
