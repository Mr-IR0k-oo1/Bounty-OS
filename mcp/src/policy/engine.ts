import { CapabilityLevel, parseCapabilityLevel, TOOL_CAPABILITY_MAP } from "./permissions.js";
import { McpErrorCode, McpErrorPayload, createMcpError } from "../schemas/errors.js";

export interface ScopeRule {
  target: string;
  target_type: string;
  out_of_scope: boolean;
}

export interface ScopeValidationResult {
  allowed: boolean;
  reason: string;
  matched_rule?: string;
  rule_type?: string;
}

export class PolicyEngine {
  private allowedLevel: CapabilityLevel;
  private maxConcurrentJobs: number;

  constructor() {
    this.allowedLevel = parseCapabilityLevel(process.env.MCP_ALLOWED_CAPABILITIES);
    this.maxConcurrentJobs = parseInt(process.env.MCP_MAX_CONCURRENT_JOBS || "5", 10);
  }

  /**
   * Validate if the tool is allowed under the current capability profile
   */
  checkPermission(toolName: string): McpErrorPayload | null {
    const requiredLevel = TOOL_CAPABILITY_MAP[toolName] ?? CapabilityLevel.ACTIVE;
    if (requiredLevel > this.allowedLevel) {
      return createMcpError(
        McpErrorCode.POLICY_DENIED,
        `Tool '${toolName}' requires ${CapabilityLevel[requiredLevel]} permissions, but current MCP capability is restricted to ${CapabilityLevel[this.allowedLevel]}.`
      );
    }
    return null;
  }

  /**
   * Reject dangerous shell metacharacters and path traversal sequences
   */
  validateInput(input: string, fieldName = "target"): McpErrorPayload | null {
    if (!input || typeof input !== "string") {
      return createMcpError(
        McpErrorCode.INVALID_ARGUMENT,
        `Field '${fieldName}' must be a non-empty string.`
      );
    }

    const dangerousChars = [";", "|", "&", "$", "`", "\n", "\r", "<", ">", "\\", "\0"];
    for (const char of dangerousChars) {
      if (input.includes(char)) {
        return createMcpError(
          McpErrorCode.INVALID_ARGUMENT,
          `Dangerous character '${char}' detected in ${fieldName}. Shell metacharacters are strictly forbidden.`
        );
      }
    }

    if (input.includes("../") || input.includes("..\\")) {
      return createMcpError(
        McpErrorCode.INVALID_ARGUMENT,
        `Path traversal sequence detected in ${fieldName}.`
      );
    }

    return null;
  }

  /**
   * Clean and normalize a target hostname, URL, or IP
   */
  normalizeTarget(target: string): string {
    return target
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  /**
   * Strict scope validation against in-scope and out-of-scope rule sets
   */
  validateScope(target: string, rules: ScopeRule[]): ScopeValidationResult {
    const normalized = this.normalizeTarget(target);

    // 1. Explicit out-of-scope exclusions take absolute precedence
    const outMatches = rules.filter(
      (r) => r.out_of_scope && this.matchesPattern(normalized, r.target, r.target_type)
    );
    if (outMatches.length > 0) {
      return {
        allowed: false,
        reason: `Target is outside authorized scope (explicitly excluded by rule: ${outMatches[0].target})`,
        matched_rule: outMatches[0].target,
        rule_type: outMatches[0].target_type,
      };
    }

    // 2. In-scope inclusions
    const inMatches = rules.filter(
      (r) => !r.out_of_scope && this.matchesPattern(normalized, r.target, r.target_type)
    );
    if (inMatches.length > 0) {
      return {
        allowed: true,
        reason: "Target is inside configured scope",
        matched_rule: inMatches[0].target,
        rule_type: inMatches[0].target_type,
      };
    }

    // 3. Whitelist enforcement: anything not explicitly matched is denied
    return {
      allowed: false,
      reason: "Target is outside configured scope (no matching authorized scope rule)",
    };
  }

  /**
   * Pattern matcher for wildcards, domains, CIDRs, and URLs
   */
  matchesPattern(target: string, ruleTarget: string, ruleType?: string): boolean {
    const rule = ruleTarget.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const cleanTarget = target.trim().toLowerCase();

    if (cleanTarget === rule) {
      return true;
    }

    // Wildcard domain matching: *.example.com or .example.com
    if (rule.startsWith("*.") || rule.startsWith(".")) {
      const baseDomain = rule.replace(/^\*\.?/, "").replace(/^\./, "");
      return cleanTarget === baseDomain || cleanTarget.endsWith(`.${baseDomain}`);
    }

    // Plain domain matching with implicit subdomain coverage if specified as wildcard type
    if (ruleType === "wildcard") {
      return cleanTarget === rule || cleanTarget.endsWith(`.${rule}`);
    }

    // IPv4 CIDR matching
    if (ruleType === "cidr" || rule.includes("/")) {
      return this.ipInCidr(cleanTarget, rule);
    }

    return false;
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split("/");
      const prefix = parseInt(bitsStr || "32", 10);
      if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

      const ipNum = this.ipv4ToNumber(ip);
      const rangeNum = this.ipv4ToNumber(range);
      if (ipNum === null || rangeNum === null) return false;

      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  private ipv4ToNumber(ip: string): number | null {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return null;
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  /**
   * Check concurrency limits
   */
  checkConcurrency(activeJobsCount: number): McpErrorPayload | null {
    if (activeJobsCount >= this.maxConcurrentJobs) {
      return createMcpError(
        McpErrorCode.POLICY_DENIED,
        `Maximum concurrent job limit reached (${activeJobsCount}/${this.maxConcurrentJobs}). Please wait for active jobs to complete.`,
        true
      );
    }
    return null;
  }
}

export const globalPolicyEngine = new PolicyEngine();
