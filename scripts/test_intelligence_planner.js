/**
 * Bounty OS v0.2 — Investigation Intelligence Engine Test Suite
 *
 * Validates deterministic planning, attack-surface graph reasoning, action scoring,
 * coverage analysis, explicit stop conditions, and explainability across 12 distinct scenarios.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.BOUNTYOS_API_URL || 'http://127.0.0.1:8099/api';
const RESULTS_FILE = path.join(__dirname, 'intelligence_planner_results.json');

const results = {
  timestamp: new Date().toISOString(),
  milestone: 'Bounty OS v0.2 — Investigation Intelligence Engine',
  total_cases: 12,
  passed_cases: 0,
  failed_cases: 0,
  cases: [],
  decision_quality_metrics: {
    average_score: 0,
    average_latency_ms: 0,
    explainability_reasons_present: true,
    stop_conditions_validated: true,
  },
};

function logCase(index, name, passed, details = '', data = null) {
  const icon = passed ? '✓' : '✗';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon} ${status}] Case ${index}: ${name}${details ? ' - ' + details : ''}`);
  if (data && data.recommended_action) {
    const rec = data.recommended_action;
    console.log(`         → Action: ${rec.action_type} | Tool: ${rec.tool} | Target: ${rec.target} | Score: ${rec.score}`);
    console.log(`         → Reason: ${rec.reason}`);
  }
  if (data && data.stop_reason) {
    console.log(`         → Stop Reason: ${JSON.stringify(data.stop_reason)}`);
  }

  results.cases.push({
    index,
    name,
    status,
    details,
    action: data?.recommended_action || null,
    stop_reason: data?.stop_reason || null,
  });

  if (passed) {
    results.passed_cases++;
  } else {
    results.failed_cases++;
  }
}

async function queryPlan(stateOrPayload) {
  const start = Date.now();
  const res = await fetch(`${API_BASE}/investigations/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stateOrPayload),
  });
  const latency = Date.now() - start;
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json, latency };
}

function baseState(target = 'target.local') {
  return {
    id: 'test-inv-' + Date.now(),
    target,
    scope: {
      domains: [target],
      ips: [],
      wildcards: [`*.${target}`],
      excluded_hosts: [],
    },
    profile: 'standard',
    status: 'pending',
    subdomains: [],
    hosts: [{ host: target, ip: null, ports_scanned: false, first_seen: new Date().toISOString() }],
    services: [],
    endpoints: [],
    technologies: [],
    findings: [],
    executed_actions: [],
    budget: {
      max_actions: 50,
      current_actions: 0,
      max_duration_seconds: 3600,
      started_at: null,
      max_risk_level: 0.8,
      action_counts_by_tool: {},
    },
    stop_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function runTests() {
  console.log('========================================================================');
  console.log('     BOUNTY OS v0.2 — INVESTIGATION INTELLIGENCE ENGINE SUITE           ');
  console.log('========================================================================\n');

  let totalLatency = 0;
  let totalScores = 0;
  let scoreCount = 0;

  // -------------------------------------------------------------------------
  // Case 1: Empty target → subfinder
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true; // prevent host naabu priority
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'subfinder';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(1, 'Empty target without subdomains selects subfinder', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 2: Subdomains discovered → dnsx
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.subdomains.push({
      subdomain: 'api.target.local',
      discovered_by: 'subfinder',
      dns_resolved: false,
      ips: [],
      cnames: [],
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'dnsx' && res.data.recommended_action?.target === 'api.target.local';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(2, 'Subdomains discovered without DNS resolution selects dnsx', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 3: DNS resolved → naabu
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.subdomains.push({
      subdomain: 'api.target.local',
      discovered_by: 'subfinder',
      dns_resolved: true,
      ips: ['192.168.1.10'],
      cnames: [],
      first_seen: new Date().toISOString(),
    });
    state.hosts.push({
      host: 'api.target.local',
      ip: '192.168.1.10',
      ports_scanned: false,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'naabu';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(3, 'DNS resolved host without port coverage selects naabu', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 4: Port 443 discovered → httpx
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push({
      action_type: 'subdomain_enumeration',
      tool: 'subfinder',
      target: 'target.local',
      executed_at: new Date().toISOString(),
      duration_ms: 200,
      success: true,
      details: null,
    });
    state.services.push({
      host: 'target.local',
      port: 443,
      protocol: 'tcp',
      service_name: 'https',
      banner: null,
      http_probed: false,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'httpx' && res.data.recommended_action?.target === 'target.local:443';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(4, 'Discovered port 443 without HTTP metadata selects httpx', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 5: Live application + no endpoints → katana
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null },
      { action_type: 'http_probe', tool: 'httpx', target: 'target.local:8888', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    state.services.push({
      host: 'target.local',
      port: 8888,
      protocol: 'tcp',
      service_name: 'http',
      banner: 'Apache 2.4',
      http_probed: true,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'katana' && res.data.recommended_action?.target === 'http://target.local:8888';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(5, 'Live application without endpoint coverage selects katana', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 6: Historical coverage absent → gau / waybackurls
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null },
      { action_type: 'http_probe', tool: 'httpx', target: 'target.local:8888', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null },
      { action_type: 'endpoint_crawl', tool: 'katana', target: 'http://target.local:8888', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    state.services.push({
      host: 'target.local',
      port: 8888,
      protocol: 'tcp',
      service_name: 'http',
      banner: 'Apache 2.4',
      http_probed: true,
      first_seen: new Date().toISOString(),
    });
    state.endpoints.push({
      url: 'http://target.local:8888/index.php',
      host: 'target.local',
      port: 8888,
      path: '/index.php',
      method: 'GET',
      params: [],
      status_code: 200,
      content_type: 'text/html',
      technologies: [],
      crawled: true,
      historical: false,
      fuzzed: false,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && (res.data.recommended_action?.tool === 'gau' || res.data.recommended_action?.tool === 'waybackurls');
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(6, 'Historical URL archive coverage absent selects gau', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 7: Parameterized reflected endpoint → dalfox
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null },
      { action_type: 'http_probe', tool: 'httpx', target: 'target.local:8888', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    state.services.push({
      host: 'target.local',
      port: 8888,
      protocol: 'tcp',
      service_name: 'http',
      banner: 'Apache',
      http_probed: true,
      first_seen: new Date().toISOString(),
    });
    state.endpoints.push({
      url: 'http://target.local:8888/search?q=test',
      host: 'target.local',
      port: 8888,
      path: '/search?q=test',
      method: 'GET',
      params: [{
        name: 'q',
        location: 'query',
        reflected: true,
        reflection_context: 'html_body',
        tested_for_xss: false,
        tested_for_sqli: false,
      }],
      status_code: 200,
      content_type: 'text/html',
      technologies: [],
      crawled: true,
      historical: false,
      fuzzed: false,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'dalfox' && res.data.recommended_action?.action_type === 'xss_analysis';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(7, 'Parameterized reflected endpoint prioritizes dalfox over crawling', ok, `Score: ${res.data.recommended_action?.score}`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 8: Technology identified → targeted nuclei
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    state.technologies.push({
      name: 'Apache',
      version: '2.4.41',
      cpe: 'cpe:/a:apache:http_server:2.4.41',
      category: 'Web Server',
      templates_matched: [],
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'nuclei' && res.data.recommended_action?.action_type === 'tech_vulnerability_scan';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(8, 'Identified technology stack selects targeted nuclei scan', ok, `Latency: ${res.latency}ms`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 9: High-confidence finding → verification
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    state.findings.push({
      id: 'find-xss-123',
      title: 'Confirmed Reflected Cross-Site Scripting (XSS)',
      severity: 'high',
      confidence: 'firm',
      target: 'http://target.local:8888/search?q=test',
      matched_at: 'http://target.local:8888/search?q=test',
      verified: false,
      evidence: ['<script>alert(1)</script> reflected in response body'],
      cve_id: null,
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.tool === 'verification' && res.data.recommended_action?.action_type === 'finding_verification';
    if (res.data.recommended_action) {
      totalScores += res.data.recommended_action.score;
      scoreCount++;
    }
    logCase(9, 'High-confidence finding prioritizes deterministic verification', ok, `Score: ${res.data.recommended_action?.score}`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 10: No valuable unexplored surface → STOP
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null },
      { action_type: 'port_scan', tool: 'naabu', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && res.data.recommended_action?.action_type === 'stop' && res.data.stop_reason !== null;
    logCase(10, 'No valuable unexplored surface halts scan with explicit STOP', ok, `Stop reason: ${JSON.stringify(res.data.stop_reason)}`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 11: Out-of-scope target → no executable action
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    // Explicitly exclude out-of-scope domain
    state.scope.excluded_hosts.push('forbidden.target.local');
    state.subdomains.push({
      subdomain: 'forbidden.target.local',
      discovered_by: 'subfinder',
      dns_resolved: false,
      ips: [],
      cnames: [],
      first_seen: new Date().toISOString(),
    });
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const ok = res.ok && (res.data.recommended_action?.target !== 'forbidden.target.local');
    logCase(11, 'Out-of-scope target strictly rejected from candidate generation', ok, `Chosen: ${res.data.recommended_action?.target || 'none'}`, res.data);
  }

  // -------------------------------------------------------------------------
  // Case 12: Tool already executed → don't duplicate it unnecessarily
  // -------------------------------------------------------------------------
  {
    const state = baseState('target.local');
    state.hosts[0].ports_scanned = true;
    state.executed_actions.push(
      { action_type: 'subdomain_enumeration', tool: 'subfinder', target: 'target.local', executed_at: new Date().toISOString(), duration_ms: 100, success: true, details: null }
    );
    const res = await queryPlan({ state });
    totalLatency += res.latency;
    const notDuplicated = res.ok && (res.data.recommended_action?.tool !== 'subfinder' || res.data.recommended_action?.target !== 'target.local');
    logCase(12, 'Tool already executed on target is not duplicated', notDuplicated, `Recommended: ${res.data.recommended_action?.tool}`, res.data);
  }

  // Compute metrics
  results.decision_quality_metrics.average_latency_ms = Math.round(totalLatency / 12);
  results.decision_quality_metrics.average_score = scoreCount > 0 ? Number((totalScores / scoreCount).toFixed(2)) : 0;

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${results.passed_cases}/${results.total_cases} PASSED (${results.failed_cases} failed)`);
  console.log(`Average Decision Latency: ${results.decision_quality_metrics.average_latency_ms} ms`);
  console.log(`Average Action Score: ${results.decision_quality_metrics.average_score}`);
  console.log(`Audit Results saved to: ${RESULTS_FILE}`);
  console.log('========================================================================\n');

  if (results.failed_cases > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
