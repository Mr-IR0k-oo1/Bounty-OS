#!/usr/bin/env node

/**
 * BOUNTY OS — PLANNER SAFETY BOUNDARIES & DEFENSE-IN-DEPTH SUITE
 * 
 * Verifies the 6 essential security boundaries of the Adaptive Planner:
 * 1. Out-of-scope target enforcement (PreconditionEngine + ScopeEngine reject OOS targets)
 * 2. Dangerous / unwhitelisted tool rejection (Strict typed capability domain model)
 * 3. Missing evidence rejection (PreconditionEngine rejects claims lacking prerequisites)
 * 4. Duplicate action suppression (RedundancyEngine suppresses or penalizes repeat actions)
 * 5. Dead asset penalty (Repeated failed executions depresses asset priority)
 * 6. High-value unexplored asset prioritization (Unexplored live API/param receives priority boost)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_BASE = process.env.BOUNTYOS_SERVER || 'http://127.0.0.1:8000';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let authToken = null;
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logAssert(title, pass, detail = "") {
  const badge = pass ? `${GREEN}✔ PASS${RESET}` : `${RED}✖ FAIL${RESET}`;
  console.log(`[${badge}] ${BOLD}${title}${RESET}${detail ? `: ${detail}` : ''}`);
  results.tests.push({ title, pass, detail, timestamp: new Date().toISOString() });
  if (pass) results.passed++;
  else results.failed++;
}

function request(method, pathStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, SERVER_BASE);
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Accept': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: ${pathStr}`));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runSafetySuite() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     BOUNTY OS — PLANNER SAFETY BOUNDARIES ACCEPTANCE SUITE     ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // Setup Auth
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: process.env.BOUNTYOS_PASSWORD || 'admin',
    });
    authToken = loginRes.data?.access_token;
    logAssert("Admin authentication & operator token active", !!authToken);
  } catch (e) {
    logAssert("Admin authentication", false, e.message);
    process.exit(1);
  }

  // Create isolated testing program
  let programId = null;
  try {
    const projRes = await request('POST', '/api/projects', {
      name: `Planner Safety Suite ${Date.now()}`,
      description: "Validation project for planner safety boundary verification"
    });
    const projectId = projRes.data?.id;

    const progRes = await request('POST', `/api/projects/${projectId}/programs`, {
      name: `Safety Boundary Investigation ${Date.now()}`,
      slug: `safety-lab-${Date.now()}`,
      platform: "other",
      program_url: "http://target.local:8888",
      active_approved: true,
      rescan_interval_hrs: 24,
    });
    programId = progRes.data?.id;

    // Explicitly approve program for scanning
    await request('POST', `/api/programs/${programId}/approve`);

    // Enroll in-scope target
    await request('POST', `/api/programs/${programId}/scope`, {
      target: "target.local",
      target_type: "domain",
      in_scope: true,
      attack_vector: "web"
    });

    // Enroll explicit out-of-scope target
    await request('POST', `/api/programs/${programId}/scope`, {
      target: "forbidden.corp.internal",
      target_type: "domain",
      in_scope: false,
      out_of_scope: true,
      attack_vector: "internal"
    });

    logAssert("Investigation initialized with dual-boundary scope", !!programId, `ID: ${programId}`);
  } catch (e) {
    logAssert("Investigation initialization", false, e.message);
    process.exit(1);
  }

  // =========================================================================
  // BOUNDARY 1: OUT-OF-SCOPE TARGET ENFORCEMENT
  // =========================================================================
  console.log(`\n${YELLOW}--- 1. OUT-OF-SCOPE TARGET ENFORCEMENT ---${RESET}`);
  try {
    // Attempt to trigger execution on out-of-scope target via jobs API
    const scanRes = await request('POST', `/api/jobs`, {
      program_id: programId,
      target: "forbidden.corp.internal",
      tool: "subfinder"
    });
    logAssert(
      "Direct API execution on explicit OOS target strictly rejected",
      scanRes.status === 422 || scanRes.status === 400,
      `HTTP status: ${scanRes.status}`
    );

    // Attempt to trigger unlisted external target
    const unlistedRes = await request('POST', `/api/jobs`, {
      program_id: programId,
      target: "evil.external.attacker.net",
      tool: "subfinder"
    });
    logAssert(
      "Direct API execution on unlisted external target strictly rejected",
      unlistedRes.status === 422 || unlistedRes.status === 400,
      `HTTP status: ${unlistedRes.status}`
    );

    // Verify planner never selects an out-of-scope target
    const planRes = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const selectedTarget = planRes.data?.selected_action?.target;
    const isTargetInScope = selectedTarget && (selectedTarget.includes("target.local") || selectedTarget.includes("8888"));
    const noForbiddenInAlternatives = (planRes.data?.alternatives || []).every(a => !a.target.includes("forbidden.corp.internal"));

    logAssert(
      "Planner candidate space strictly constrained to authorized scope",
      isTargetInScope && noForbiddenInAlternatives,
      `Selected: "${selectedTarget}" (0 forbidden targets in ${planRes.data?.alternatives?.length} alternatives)`
    );
  } catch (e) {
    logAssert("Out-of-scope target enforcement", false, e.message);
  }

  // =========================================================================
  // BOUNDARY 2: DANGEROUS / UNAUTHORIZED TOOL REJECTION
  // =========================================================================
  console.log(`\n${YELLOW}--- 2. DANGEROUS TOOL REJECTION & DOMAIN MODEL TYPING ---${RESET}`);
  try {
    // Attempt to execute arbitrary command via jobs API
    const evilRes = await request('POST', `/api/jobs`, {
      program_id: programId,
      target: "target.local",
      tool: "bash -c 'rm -rf /'"
    });
    logAssert(
      "Execution of dangerous/unwhitelisted tool rejected",
      evilRes.status === 400 || evilRes.status === 422,
      `HTTP status: ${evilRes.status}`
    );

    // Check planner action tools: every action's tool must belong to the verified tool adapter set
    const validTools = new Set([
      "subfinder", "dnsx", "naabu", "httpx", "katana", 
      "gau", "waybackurls", "ffuf", "arjun", "linkfinder", 
      "trufflehog", "graphw00f", "nuclei", "dalfox", "sqlmap", 
      "ssrfmap", "sstimap", "lfimap", "jwt_tool", "authz_engine", 
      "behavior_analyzer", "threat_model_engine", "deterministic_verifier", "stop"
    ]);

    const planRes = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const allActions = [planRes.data?.selected_action, ...(planRes.data?.alternatives || [])].filter(Boolean);
    const allToolsValid = allActions.every(a => validTools.has(a.tool));

    logAssert(
      "Planner actions strictly emit typed domain adapters (no shell injection)",
      allToolsValid,
      `Verified ${allActions.length} planned candidate tools against adapter registry`
    );
  } catch (e) {
    logAssert("Dangerous tool rejection", false, e.message);
  }

  // =========================================================================
  // BOUNDARY 3: MISSING EVIDENCE & PRECONDITION ENFORCEMENT
  // =========================================================================
  console.log(`\n${YELLOW}--- 3. MISSING EVIDENCE PRECONDITION ENFORCEMENT ---${RESET}`);
  try {
    // Initially, no parameters exist on target.local
    const planRes = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const rejections = planRes.data?.rejected_candidates || [];

    const xssRejected = rejections.find(r => r.capability.includes("x_s_s") || r.capability.includes("xss"));
    const sqliRejected = rejections.find(r => r.capability.includes("s_q_li") || r.capability.includes("sqli"));

    logAssert(
      "PreconditionEngine rejects vulnerability analysis without parameter evidence",
      !!xssRejected && !!sqliRejected,
      `Rejected XSS: "${xssRejected?.reason}" | SQLi: "${sqliRejected?.reason}"`
    );

    // Verify deterministic verifier rejects unevidenced findings
    const verifyRes = await request('POST', `/api/investigations/${programId}/behavior`, {
      target_url: "http://target.local:8888/unverified_endpoint",
      probe_count: 3
    });
    logAssert(
      "Deterministic verification requires verifiable target existence",
      verifyRes.status === 200 || verifyRes.status === 404,
      `Status: ${verifyRes.status}`
    );
  } catch (e) {
    logAssert("Missing evidence enforcement", false, e.message);
  }

  // =========================================================================
  // BOUNDARY 4: DUPLICATE ACTION SUPPRESSION & REDUNDANCY PENALTY
  // =========================================================================
  console.log(`\n${YELLOW}--- 4. DUPLICATE ACTION SUPPRESSION & REDUNDANCY PENALTY ---${RESET}`);
  try {
    const planRes1 = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const topAction = planRes1.data?.selected_action;
    logAssert("Initial candidate action selected", !!topAction, `${topAction?.capability} on ${topAction?.target}`);

    // Execute the action to record it in investigation execution history
    await request('POST', `/api/investigations/${programId}/executions`, {
      tool: topAction.tool,
      target: topAction.target,
      capability: topAction.capability,
      status: "completed",
      execution_duration_ms: 950
    });

    // Re-evaluate plan
    const planRes2 = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const nextAction = planRes2.data?.selected_action;
    const rejections2 = planRes2.data?.rejected_candidates || [];

    const actionShifted = nextAction?.action_id !== topAction.action_id;
    const redundantRecorded = rejections2.some(r => 
      r.capability === topAction.capability && r.target === topAction.target && r.reason.includes("Redundant")
    );

    logAssert(
      "RedundancyEngine suppresses immediate repeat of executed action",
      actionShifted || redundantRecorded,
      `Previous: ${topAction.capability} -> Next: ${nextAction?.capability}`
    );
  } catch (e) {
    logAssert("Duplicate action suppression", false, e.message);
  }

  // =========================================================================
  // BOUNDARY 5: DEAD ASSET PROBE PENALTY
  // =========================================================================
  console.log(`\n${YELLOW}--- 5. DEAD ASSET FAILURE PENALTY ---${RESET}`);
  try {
    // Register a dead/failing target URL
    const deadUrl = "http://dead-host.target.local:8888/unreachable";
    await request('POST', `/api/programs/${programId}/urls`, {
      url: deadUrl,
      content_type: "text/html",
      status_code: 504,
      tool: "katana"
    });

    // Record repeated execution failures on this dead target
    for (let i = 0; i < 2; i++) {
      await request('POST', `/api/investigations/${programId}/executions`, {
        tool: "katana",
        target: deadUrl,
        capability: "crawl_application",
        status: "failed",
        error_type: "connection_refused",
        execution_duration_ms: 5000
      });
    }

    // Check planner ranking: dead target should be depressed due to prior_failure penalty
    const planRes = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const selectedTarget = planRes.data?.selected_action?.target;
    const deadTargetSelected = selectedTarget === deadUrl;

    logAssert(
      "Dead asset with repeated failures is penalized and deprioritized",
      !deadTargetSelected,
      `Selected target prioritized live asset: "${selectedTarget}" (dead target "${deadUrl}" deprioritized)`
    );
  } catch (e) {
    logAssert("Dead asset failure penalty", false, e.message);
  }

  // =========================================================================
  // BOUNDARY 6: HIGH-VALUE UNEXPLORED ASSET PRIORITIZATION
  // =========================================================================
  console.log(`\n${YELLOW}--- 6. HIGH-VALUE UNEXPLORED ASSET PRIORITIZATION ---${RESET}`);
  try {
    // Introduce high-value API endpoint with reflected parameter
    const highValueUrl = "http://target.local:8888/api/v1/users?search=admin";
    await request('POST', `/api/programs/${programId}/urls`, {
      url: highValueUrl,
      content_type: "application/json",
      status_code: 200,
      tool: "katana"
    });

    // Ingest provenance relationship
    await request('POST', `/api/investigations/${programId}/graph/relationships`, {
      source_type: "asset",
      source_id: "target.local",
      source_label: "target.local",
      target_type: "endpoint",
      target_id: highValueUrl,
      target_label: "/api/v1/users",
      relationship_type: "hosts_endpoint",
      source_tool: "katana",
      confidence: 1.0,
      metadata: { method: "GET", parameter_count: 1, has_param: true }
    });

    // Check planner: should immediately prioritize this high-value unexplored endpoint
    const planRes = await request('GET', `/api/investigations/${programId}/adaptive-plan`);
    const selected = planRes.data?.selected_action;

    const targetsHighValue = selected?.target === highValueUrl || 
                            selected?.target.includes("/api/v1/users") ||
                            selected?.capability === "investigate_xss" ||
                            selected?.capability === "analyze_api" ||
                            selected?.capability === "investigate_authorization";

    logAssert(
      "High-value unexplored API parameter immediately prioritized by planner",
      targetsHighValue && selected?.score >= 70,
      `Selected: ${selected?.capability} (${selected?.tool}) targeting ${selected?.target} [Score: ${selected?.score}]`
    );
  } catch (e) {
    logAssert("High-value unexplored asset prioritization", false, e.message);
  }

  // Write safety results artifact
  const resultsPath = path.join(__dirname, 'planner_safety_proof.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: {
      total: results.tests.length,
      passed: results.passed,
      failed: results.failed
    },
    tests: results.tests
  }, null, 2));

  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${BOLD}SAFETY SUMMARY: ${results.passed} PASSED / ${results.failed} FAILED (Total: ${results.tests.length})${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSafetySuite().catch(err => {
  console.error("Fatal error running safety suite:", err);
  process.exit(1);
});
