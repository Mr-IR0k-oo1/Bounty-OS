/**
 * Permission and Capability Levels for MCP Tools
 */

export enum CapabilityLevel {
  PASSIVE = 1,     // Read-only queries and non-invasive OSINT
  LOW_IMPACT = 2,  // State transitions, safe HTTP probes, reporting
  ACTIVE = 3,      // Vulnerability scans, payload testing, verification
  RESTRICTED = 4,  // High consequence actions requiring explicit override
}

export function parseCapabilityLevel(val?: string): CapabilityLevel {
  if (!val) return CapabilityLevel.ACTIVE;
  switch (val.toUpperCase().trim()) {
    case "PASSIVE":
      return CapabilityLevel.PASSIVE;
    case "LOW_IMPACT":
      return CapabilityLevel.LOW_IMPACT;
    case "ACTIVE":
      return CapabilityLevel.ACTIVE;
    case "RESTRICTED":
      return CapabilityLevel.RESTRICTED;
    default:
      return CapabilityLevel.ACTIVE;
  }
}

export const TOOL_CAPABILITY_MAP: Record<string, CapabilityLevel> = {
  // Scope tools
  "scope.get": CapabilityLevel.PASSIVE,
  "scope.validate": CapabilityLevel.PASSIVE,
  "get_program_scope": CapabilityLevel.PASSIVE,
  "check_scope": CapabilityLevel.PASSIVE,
  "add_scope_target": CapabilityLevel.LOW_IMPACT,

  // Investigation tools
  "investigation.start": CapabilityLevel.LOW_IMPACT,
  "investigation.status": CapabilityLevel.PASSIVE,
  "investigation.plan": CapabilityLevel.PASSIVE,
  "investigation.run": CapabilityLevel.ACTIVE,
  "investigation.action_history": CapabilityLevel.PASSIVE,
  "investigation.pause": CapabilityLevel.LOW_IMPACT,
  "investigation.resume": CapabilityLevel.LOW_IMPACT,
  "investigation.stop": CapabilityLevel.LOW_IMPACT,
  "investigation.cancel": CapabilityLevel.LOW_IMPACT,
  "list_programs": CapabilityLevel.PASSIVE,
  "get_program_details": CapabilityLevel.PASSIVE,

  // Asset tools
  "assets.list": CapabilityLevel.PASSIVE,
  "asset.get": CapabilityLevel.PASSIVE,
  "list_subdomains": CapabilityLevel.PASSIVE,
  "add_subdomain": CapabilityLevel.LOW_IMPACT,

  // Service tools
  "services.list": CapabilityLevel.PASSIVE,
  "service.get": CapabilityLevel.PASSIVE,

  // Endpoint tools
  "endpoints.list": CapabilityLevel.PASSIVE,
  "endpoint.get": CapabilityLevel.PASSIVE,

  // Scan tools
  "scan.recon": CapabilityLevel.PASSIVE,
  "scan.web": CapabilityLevel.LOW_IMPACT,
  "scan.vulnerabilities": CapabilityLevel.ACTIVE,
  "trigger_scan": CapabilityLevel.ACTIVE,
  "get_scan_jobs": CapabilityLevel.PASSIVE,

  // Finding tools
  "findings.list": CapabilityLevel.PASSIVE,
  "finding.get": CapabilityLevel.PASSIVE,
  "finding.analyze": CapabilityLevel.PASSIVE,
  "finding.verify": CapabilityLevel.ACTIVE,
  "list_findings": CapabilityLevel.PASSIVE,
  "create_finding": CapabilityLevel.LOW_IMPACT,
  "update_finding": CapabilityLevel.LOW_IMPACT,
  "triage_finding": CapabilityLevel.LOW_IMPACT,

  // Evidence tools
  "evidence.list": CapabilityLevel.PASSIVE,
  "evidence.get": CapabilityLevel.PASSIVE,

  // Report tools
  "report.generate": CapabilityLevel.LOW_IMPACT,
  "report.get": CapabilityLevel.PASSIVE,
  "generate_bug_bounty_report": CapabilityLevel.LOW_IMPACT,
};
