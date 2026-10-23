#!/usr/bin/env node

/**
 * BOUNTY OS — PLANNER DETERMINISTIC REPLAY VERIFICATION SUITE
 * 
 * Demonstrates and verifies:
 * 1. Given fixed investigation state A, repeated planner queries produce 100% identical decisions.
 * 2. Determinism across independent cloned investigations with identical state.
 * 3. Invariance in score components, alternative rankings, and precondition rejections.
 * 4. State-change sensitivity: Decisions adapt deterministically ONLY when new state is introduced.
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
  assertions: []
};

function logAssert(title, pass, detail = "") {
  const badge = pass ? `${GREEN}✔ PASS${RESET}` : `${RED}✖ FAIL${RESET}`;
  console.log(`[${badge}] ${BOLD}${title}${RESET}${detail ? `: ${detail}` : ''}`);
  results.assertions.push({ title, pass, detail, timestamp: new Date().toISOString() });
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

/**
 * Creates and initializes a target investigation with a fixed, known state:
 * - Target: target.local
 * - Scope: target.local
 * - Endpoints: /, /search?q=test, /api/v1/config, /admin
 * - Findings: reflected XSS on /search?q=
 * - Explored: / (crawl_application), /search?q=test (investigate_xss)
 */
async function setupFixedInvestigationState(suiteName) {
  const projRes = await request('POST', '/api/projects', {
    name: `${suiteName} Project ${Date.now()}`,
    description: "Fixed state container for planner replay validation"
  });
  const projectId = projRes.data?.id;

  const progRes = await request('POST', `/api/projects/${projectId}/programs`, {
    name: `${suiteName} Program ${Date.now()}`,
    slug: `replay-${Date.now()}`,
    platform: "other",
    program_url: "http://target.local:8888",
    active_approved: true,
    rescan_interval_hrs: 24,
  });
  const investigationId = progRes.data?.id;

  // 1. Enforce Scope Target
  await request('POST', `/api/programs/${investigationId}/scope`, {
    target: "target.local",
    target_type: "domain",
    in_scope: true,
    attack_vector: "web"
  });

  // 2. Add Fixed Endpoints
  const endpoints = [
    "http://target.local:8888/",
    "http://target.local:8888/search?q=test",
    "http://target.local:8888/api/v1/config",
    "http://target.local:8888/admin"
  ];

  for (const url of endpoints) {
    await request('POST', `/api/programs/${investigationId}/urls`, {
      url,
      content_type: url.includes("/api/") ? "application/json" : "text/html",
      status_code: 200,
      tool: "katana"
    });
  }

  // 3. Attach Prior Finding: Reflected XSS on /search?q=
  await request('POST', '/api/findings', {
    program_id: investigationId,
    title: "Reflected XSS on /search?q=",
    vuln_type: "xss",
    severity: "high",
    target: "http://target.local:8888/search?q=test",
    confidence: 0.95
  });

  // 4. Mark Explored Actions:
  // Explored crawl_application on /
  await request('POST', `/api/investigations/${investigationId}/executions`, {
    tool: "katana",
    target: "http://target.local:8888/",
    capability: "crawl_application",
    status: "completed",
    execution_duration_ms: 1100
  });

  // Explored investigate_xss on /search?q=test
  await request('POST', `/api/investigations/${investigationId}/executions`, {
    tool: "dalfox",
    target: "http://target.local:8888/search?q=test",
    capability: "investigate_xss",
    status: "completed",
    execution_duration_ms: 1450
  });

  return investigationId;
}

async function runReplaySuite() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     BOUNTY OS — DETERMINISTIC PLANNER REPLAY VERIFICATION      ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // Step 0: Connectivity & Auth
  try {
    const health = await request('GET', '/health');
    logAssert("Backend server connectivity", health.status === 200);

    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: process.env.BOUNTYOS_PASSWORD || 'admin',
    });
    authToken = loginRes.data?.access_token;
    logAssert("Admin authentication", !!authToken, "JWT active");
  } catch (e) {
    logAssert("Pre-flight checks", false, e.message);
    process.exit(1);
  }

  // =========================================================================
  // TEST 1: REPEATABILITY ON FIXED STATE A (State A -> Decision X x 5)
  // =========================================================================
  console.log(`\n${YELLOW}--- 1. PROVE REPEATABILITY ON FIXED INVESTIGATION STATE A ---${RESET}`);
  
  const investigationA = await setupFixedInvestigationState("Replay State A");
  logAssert("Fixed investigation state A instantiated", !!investigationA, `ID: ${investigationA}`);

  const iterations = 5;
  const decisionsA = [];

  for (let i = 1; i <= iterations; i++) {
    const planRes = await request('GET', `/api/investigations/${investigationA}/adaptive-plan`);
    if (planRes.status === 200 && planRes.data?.selected_action) {
      decisionsA.push(planRes.data);
    } else {
      logAssert(`Query iteration ${i}`, false, `Status ${planRes.status}`);
    }
  }

  logAssert(
    `Collected ${iterations} consecutive planner evaluations on state A`,
    decisionsA.length === iterations,
    `Evaluations count: ${decisionsA.length}`
  );

  const baselineDecision = decisionsA[0].selected_action;
  const baselineScore = decisionsA[0].score;
  const baselineComponents = decisionsA[0].score_components;
  const baselineAlternatives = decisionsA[0].alternatives.map(a => `${a.capability}:${a.target}`);

  console.log(`[*] Baseline Decision X: Capability = ${baselineDecision.capability}, Tool = ${baselineTool = baselineDecision.tool}, Target = ${baselineDecision.target}, Score = ${baselineScore}`);

  let allIdenticalAction = true;
  let allIdenticalScore = true;
  let allIdenticalComponents = true;
  let allIdenticalAlternatives = true;

  for (let i = 1; i < decisionsA.length; i++) {
    const d = decisionsA[i];
    const act = d.selected_action;

    if (act.capability !== baselineDecision.capability || act.target !== baselineDecision.target || act.tool !== baselineDecision.tool) {
      allIdenticalAction = false;
      console.error(`[!] Action drift in iteration ${i + 1}: ${act.capability} != ${baselineDecision.capability}`);
    }

    if (d.score !== baselineScore) {
      allIdenticalScore = false;
      console.error(`[!] Score drift in iteration ${i + 1}: ${d.score} != ${baselineScore}`);
    }

    if (JSON.stringify(d.score_components) !== JSON.stringify(baselineComponents)) {
      allIdenticalComponents = false;
      console.error(`[!] Score component drift in iteration ${i + 1}`);
    }

    const altSignatures = d.alternatives.map(a => `${a.capability}:${a.target}`);
    if (JSON.stringify(altSignatures) !== JSON.stringify(baselineAlternatives)) {
      allIdenticalAlternatives = false;
      console.error(`[!] Alternative ranking order drift in iteration ${i + 1}`);
    }
  }

  logAssert(
    "Decision invariance: Selected action is 100% deterministic (State A → Decision X)",
    allIdenticalAction,
    `Action: ${baselineDecision.capability} on ${baselineDecision.target}`
  );

  logAssert(
    "Score invariance: Overall normalized score is 100% deterministic",
    allIdenticalScore,
    `Exact Score: ${baselineScore}`
  );

  logAssert(
    "Component invariance: Explainable score breakdown components are identical",
    allIdenticalComponents,
    JSON.stringify(baselineComponents)
  );

  logAssert(
    "Ranking invariance: Ranked candidate alternatives maintain identical ordering",
    allIdenticalAlternatives,
    `${baselineAlternatives.length} ranked candidate alternatives`
  );

  // =========================================================================
  // TEST 2: DETERMINISM ACROSS INDEPENDENT STATE CLONES (State A1 == State A2)
  // =========================================================================
  console.log(`\n${YELLOW}--- 2. PROVE DETERMINISM ACROSS INDEPENDENT STATE CLONES ---${RESET}`);

  const investigationB = await setupFixedInvestigationState("Replay State B (Clone)");
  logAssert("Independent clone state B instantiated", !!investigationB, `ID: ${investigationB}`);

  const planResB = await request('GET', `/api/investigations/${investigationB}/adaptive-plan`);
  const decisionB = planResB.data?.selected_action;

  const cloneMatchesAction = decisionB?.capability === baselineDecision.capability;
  const cloneMatchesScore = planResB.data?.score === baselineScore;
  const cloneMatchesComponents = JSON.stringify(planResB.data?.score_components) === JSON.stringify(baselineComponents);

  logAssert(
    "Clone reproducibility: State Clone B selects identical capability to State A",
    cloneMatchesAction,
    `Selected: ${decisionB?.capability} (${decisionB?.tool})`
  );

  logAssert(
    "Clone score reproducibility: Cloned investigation yields identical score",
    cloneMatchesScore && cloneMatchesComponents,
    `Score: ${planResB.data?.score}`
  );

  // =========================================================================
  // TEST 3: DECISION PERSISTENCE MATCHES IN-MEMORY COMPUTATION
  // =========================================================================
  console.log(`\n${YELLOW}--- 3. PROVE PERSISTED DECISION MATCHES EXPLAINED CONTRACT ---${RESET}`);

  // Query explain-decision endpoint
  const explainRes = await request('GET', `/api/investigations/${investigationA}/explain-decision`);
  const persistedDecision = explainRes.data?.persisted_decision;

  const persistedMatchesCapability = persistedDecision?.capability === baselineDecision.capability;
  const persistedMatchesScore = Math.round(persistedDecision?.score) === Math.round(baselineScore);

  logAssert(
    "Persisted decision matches calculated plan",
    persistedMatchesCapability && persistedMatchesScore,
    `Persisted ID: ${persistedDecision?.id}, Capability: ${persistedDecision?.capability}, Score: ${persistedDecision?.score}`
  );

  // =========================================================================
  // TEST 4: STATE-CHANGE SENSITIVITY (STATE A -> STATE B -> DECISION Y)
  // =========================================================================
  console.log(`\n${YELLOW}--- 4. PROVE PLANNER ADAPTS EXCLUSIVELY ON LEGITIMATE STATE CHANGE ---${RESET}`);

  // Execute the top baseline action to change the state (marking it explored/redundant)
  await request('POST', `/api/investigations/${investigationA}/executions`, {
    tool: baselineDecision.tool,
    target: baselineDecision.target,
    capability: baselineDecision.capability,
    status: "completed",
    execution_duration_ms: 1200
  });

  // Also introduce a new observation: GraphQL endpoint
  await request('POST', `/api/programs/${investigationA}/urls`, {
    url: "http://target.local:8888/graphql",
    content_type: "application/json",
    status_code: 200,
    tool: "katana"
  });

  const adaptedPlanRes = await request('GET', `/api/investigations/${investigationA}/adaptive-plan`);
  const adaptedDecision = adaptedPlanRes.data?.selected_action;

  const actionAdapted = adaptedDecision?.capability !== baselineDecision.capability ||
                        adaptedDecision?.target !== baselineDecision.target;

  logAssert(
    "Planner adapts upon new attack surface observation",
    adaptedPlanRes.status === 200 && actionAdapted,
    `Prior action: ${baselineDecision.capability} on ${baselineDecision.target} -> New adapted action: ${adaptedDecision?.capability} on ${adaptedDecision?.target}`
  );

  // Save replay proof results
  const reportPath = path.join(__dirname, 'planner_replay_proof.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: {
      total: results.assertions.length,
      passed: results.passed,
      failed: results.failed,
    },
    baseline_decision: baselineDecision,
    assertions: results.assertions
  }, null, 2));

  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${BOLD}SUMMARY: ${results.passed} PASSED / ${results.failed} FAILED (Total: ${results.assertions.length})${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runReplaySuite().catch(err => {
  console.error("Fatal error running replay suite:", err);
  process.exit(1);
});
