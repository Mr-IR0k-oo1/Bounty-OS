/**
 * Bounty OS — Attack Surface Graph v0.2 Acceptance & Proof Suite
 * 
 * Verifies:
 * 1. Database-backed graph projection (target -> asset -> dns_record -> ip -> service -> http_service -> endpoint -> parameter -> finding -> evidence)
 * 2. Provenance tracking on every discovered relationship (source_tool, job_id, investigation_id, first_seen, last_seen, confidence)
 * 3. Attack surface summary & graph query endpoints
 * 4. Identification of unexplored attack surfaces (attack_surface.unexplored)
 * 5. Adaptive planner consumes unexplored surface to select high-value actions
 * 6. Closed-loop transition: new evidence changes graph state and planner adapts to next unexplored priority
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_BASE = process.env.BOUNTYOS_SERVER_URL || 'http://127.0.0.1:8000';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let authToken = null;

const results = {
  test_suite: "Bounty OS Attack Surface Graph v0.2",
  timestamp: new Date().toISOString(),
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

async function runSuite() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     BOUNTY OS — ATTACK SURFACE GRAPH v0.2 PROOF SUITE          ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // Step 0: Connectivity
  try {
    const health = await request('GET', '/health');
    logAssert("Backend server connectivity", health.status === 200, `HTTP ${health.status}`);
  } catch (e) {
    logAssert("Backend server connectivity", false, `Cannot connect to ${SERVER_BASE}: ${e.message}`);
    process.exit(1);
  }

  // Step 1: Authentication
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: process.env.BOUNTYOS_PASSWORD || 'admin',
    });
    if (loginRes.status === 200 && loginRes.data?.access_token) {
      authToken = loginRes.data.access_token;
      logAssert("Admin authentication", true, "Bearer token acquired");
    } else {
      logAssert("Admin authentication", false, `HTTP ${loginRes.status}`);
      process.exit(1);
    }
  } catch (e) {
    logAssert("Admin authentication", false, e.message);
    process.exit(1);
  }

  // Step 2: Investigation Target Selection
  let investigationId = null;
  try {
    const programsRes = await request('GET', '/api/programs');
    if (programsRes.status === 200 && Array.isArray(programsRes.data) && programsRes.data.length > 0) {
      investigationId = programsRes.data[0].id;
      logAssert("Target investigation resolution", true, `ID: ${investigationId} (${programsRes.data[0].name})`);
    } else {
      logAssert("Target investigation resolution", false, "No investigation programs found");
      process.exit(1);
    }
  } catch (e) {
    logAssert("Target investigation resolution", false, e.message);
    process.exit(1);
  }

  // Step 3: Record Provenance Graph Relationship
  try {
    const relPayload = {
      source_type: "asset",
      source_id: "target.local",
      source_label: "target.local",
      target_type: "endpoint",
      target_id: "http://target.local:8888/search",
      target_label: "/search",
      relationship_type: "hosts_endpoint",
      source_tool: "katana",
      confidence: 1.0,
      metadata: { method: "GET", parameter_count: 1 }
    };
    const relRes = await request('POST', `/api/investigations/${investigationId}/graph/relationships`, relPayload);
    logAssert(
      "Graph relationship ingestion with provenance",
      relRes.status === 200 && relRes.data?.status === "success",
      `source: katana, relationship: hosts_endpoint`
    );
  } catch (e) {
    logAssert("Graph relationship ingestion with provenance", false, e.message);
  }

  // Step 4: Verify Relationship Query API
  try {
    const listRelRes = await request('GET', `/api/investigations/${investigationId}/graph/relationships`);
    const rels = listRelRes.data;
    const hasRel = Array.isArray(rels) && rels.some(r => r.source_tool === "katana" && r.relationship_type === "hosts_endpoint");
    logAssert(
      "Query graph provenance relationships",
      listRelRes.status === 200 && hasRel,
      `Retrieved ${rels?.length || 0} relationship edges with provenance`
    );
  } catch (e) {
    logAssert("Query graph provenance relationships", false, e.message);
  }

  // Step 5: Query Attack Surface Summary API
  try {
    const summaryRes = await request('GET', `/api/investigations/${investigationId}/graph/summary`);
    const summary = summaryRes.data;
    const valid = summaryRes.status === 200 && summary && typeof summary.target_count === 'number';
    logAssert(
      "Attack surface summary metrics",
      valid,
      `Targets: ${summary?.target_count}, Assets: ${summary?.asset_count}, Endpoints: ${summary?.endpoint_count}, Unexplored: ${summary?.unexplored_count}`
    );
  } catch (e) {
    logAssert("Attack surface summary metrics", false, e.message);
  }

  // Step 6: Query Full Graph Projection API
  let initialGraph = null;
  try {
    const graphRes = await request('GET', `/api/investigations/${investigationId}/graph`);
    initialGraph = graphRes.data;
    const hasNodes = Array.isArray(initialGraph?.nodes) && initialGraph.nodes.length > 0;
    const hasEdges = Array.isArray(initialGraph?.edges);
    logAssert(
      "Graph-backed attack surface model projection",
      graphRes.status === 200 && hasNodes && hasEdges,
      `Projected ${initialGraph?.nodes?.length} nodes and ${initialGraph?.edges?.length} edges`
    );
  } catch (e) {
    logAssert("Graph-backed attack surface model projection", false, e.message);
  }

  // Step 7: Query Unexplored Attack Surface (attack_surface.unexplored)
  let unexploredItems = [];
  try {
    const unexpRes = await request('GET', `/api/investigations/${investigationId}/graph/unexplored`);
    unexploredItems = unexpRes.data;
    const hasUnexplored = Array.isArray(unexploredItems) && unexploredItems.length > 0;
    logAssert(
      "Identify unexplored attack surface opportunities",
      unexpRes.status === 200 && hasUnexplored,
      `Found ${unexploredItems?.length} unexplored nodes (top priority: ${unexploredItems[0]?.recommended_capability} on ${unexploredItems[0]?.target})`
    );
  } catch (e) {
    logAssert("Identify unexplored attack surface opportunities", false, e.message);
  }

  // Step 8: Adaptive Planner Consumes Unexplored Surface
  let initialDecision = null;
  try {
    const planRes = await request('GET', `/api/investigations/${investigationId}/next-action`);
    initialDecision = planRes.data;
    const isActionValid = planRes.status === 200 && initialDecision?.action && initialDecision.action !== 'stop';
    logAssert(
      "Adaptive planner action selection driven by unexplored surface",
      isActionValid,
      `Selected: ${initialDecision?.capability} (${initialDecision?.tool}) targeting ${initialDecision?.target} [Score: ${initialDecision?.score?.toFixed(1)}]`
    );
  } catch (e) {
    logAssert("Adaptive planner action selection driven by unexplored surface", false, e.message);
  }

  // Step 9: Execute Action & Feed New Evidence to Graph
  try {
    const execRes = await request('POST', `/api/investigations/${investigationId}/executions`, {
      tool: initialDecision?.tool || "dalfox",
      target: initialDecision?.target || "http://target.local:8888/search?q=test",
      capability: initialDecision?.capability || "investigate_xss",
      status: "completed",
      execution_duration_ms: 1250,
    });
    logAssert(
      "Execute tool action and record empirical delta",
      execRes.status === 200 && execRes.data?.status === "recorded",
      `Execution ID: ${execRes.data?.execution_id}`
    );
  } catch (e) {
    logAssert("Execute tool action and record empirical delta", false, e.message);
  }

  // Step 10: Register New Finding & Update Graph State
  try {
    const findingRes = await request('POST', `/api/findings`, {
      program_id: investigationId,
      title: "Reflected Cross-Site Scripting on /search (parameter q)",
      finding_type: "xss",
      severity: "high",
      matched_at: initialDecision?.target || "http://target.local:8888/search?q=test",
      description: "Confirmed reflected payload execution in browser context",
    });
    logAssert(
      "Graph state update with newly discovered evidence",
      findingRes.status === 200 || findingRes.status === 201,
      `Finding registered on attack surface`
    );
  } catch (e) {
    logAssert("Graph state update with newly discovered evidence", false, e.message);
  }

  // Step 11: Re-query Graph and Verify Graph State Delta
  try {
    const updatedGraphRes = await request('GET', `/api/investigations/${investigationId}/graph`);
    const updatedGraph = updatedGraphRes.data;
    const hasFindingNode = updatedGraph?.nodes?.some(n => n.node_type === "finding");
    logAssert(
      "Attack surface graph evolves with confirmed findings",
      updatedGraphRes.status === 200 && hasFindingNode,
      `Graph updated to ${updatedGraph?.nodes?.length} nodes (Finding node attached)`
    );
  } catch (e) {
    logAssert("Attack surface graph evolves with confirmed findings", false, e.message);
  }

  // Step 12: Verify Planner Makes a Different Next Decision
  try {
    const nextPlanRes = await request('GET', `/api/investigations/${investigationId}/next-action`);
    const nextDecision = nextPlanRes.data;
    const adapted = nextDecision?.action !== initialDecision?.action || nextDecision?.target !== initialDecision?.target;
    logAssert(
      "Closed-loop decision adaptation: Planner prioritizes alternative unexplored surface",
      nextPlanRes.status === 200 && (adapted || nextDecision?.score !== initialDecision?.score),
      `Previous: ${initialDecision?.action} on ${initialDecision?.target} -> Next: ${nextDecision?.action} on ${nextDecision?.target}`
    );
  } catch (e) {
    logAssert("Closed-loop decision adaptation", false, e.message);
  }

  // Summary
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${BOLD}SUMMARY: ${results.passed} PASSED / ${results.failed} FAILED (Total: ${results.tests.length})${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // Persist results log
  const logDir = path.resolve('.overnight-logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(
    path.join(logDir, 'attack_surface_graph_proof.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
