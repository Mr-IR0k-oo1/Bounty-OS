/**
 * Bounty OS v0.5 — Strategic VulnLLM Integration Benchmark Suite
 * 
 * Conducts controlled, repeatable comparative evaluations between:
 * - Strategy A: Deterministic Planner (v0.2 / v0.3 rule-based baseline)
 * - Strategy B: Strategic VulnLLM + Planner (v0.5 structured context + hypothesis engine + bounded prioritization)
 * 
 * Strict Measurement Criteria:
 * 1. Time to first finding (TTFF in ms)
 * 2. Confirmed findings (verified with reproducible evidence)
 * 3. False positives (refuted or unverified candidates)
 * 4. Unique endpoints discovered
 * 5. Unnecessary tool executions (redundant or non-productive runs)
 * 6. Verification success rate (%)
 * 7. Security hypotheses formulated, validated, and refuted
 * 8. Total compute cost (normalized resource cost units)
 * 
 * Principle:
 * "If B isn't better, don't ship the LLM layer just because it looks sophisticated."
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_BASE = process.env.BOUNTYOS_SERVER_URL || 'http://127.0.0.1:8000';
const TARGET_URL = process.env.BOUNTYOS_TARGET_URL || 'http://target.local:8888';
const TARGET_HOST = 'target.local';

// ANSI styling
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function requestJson(urlStr, options = {}) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const reqOpts = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        timeout: options.timeout || 90000,
      };

      const req = http.request(reqOpts, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode, data, raw: body });
          } catch (e) {
            resolve({ status: res.statusCode, data: null, raw: body });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ status: 500, error: err.message, raw: '' });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    } catch (e) {
      resolve({ status: 500, error: e.message, raw: '' });
    }
  });
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (!arr || arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

async function runBenchmarkTrial(strategyKey, strategyName, trialIndex, targetUrl, scopePayload) {
  const startTime = Date.now();

  let profile = 'standard';
  let maxCycles = 8;

  if (strategyKey === 'strategy_b_vulnllm') {
    profile = 'strategic';
    maxCycles = 8;
  } else {
    // Strategy A: Deterministic Planner
    profile = 'standard';
    maxCycles = 8;
  }

  const res = await requestJson(`${SERVER_BASE}/api/investigations/run`, {
    method: 'POST',
    body: {
      target: targetUrl,
      scope: scopePayload,
      profile,
      max_cycles: maxCycles,
    },
  });

  const durationMs = Date.now() - startTime;

  if (res.status !== 200 || !res.data) {
    return {
      success: false,
      error: res.data?.error || res.raw || `HTTP ${res.status}`,
    };
  }

  const summary = res.data;
  const actions = summary.actions_executed || [];
  const outcomes = summary.outcomes || [];
  const hypotheses = summary.hypotheses || [];

  // Metrics computation
  const totalExecutions = actions.length;
  const unnecessaryExecutions = actions.filter((a) => {
    return (
      (a.new_assets_generated || 0) === 0 &&
      (a.findings_generated || 0) === 0 &&
      a.action_type !== 'stop'
    );
  }).length;

  const confirmedFindings = outcomes.reduce(
    (sum, o) => sum + (o.confirmed_findings || 0),
    0
  );
  const totalFindings = summary.total_findings || 0;
  const falsePositives = Math.max(0, totalFindings - confirmedFindings);
  const totalAssets = summary.total_assets || 0;
  const uniqueEndpoints = summary.total_endpoints || 0;

  // Verification success rate
  const verificationSuccessRate = totalFindings > 0
    ? (confirmedFindings / totalFindings) * 100.0
    : 100.0;

  // Time to first finding
  let ttffMs = durationMs;
  let accumulatedTime = 0;
  for (const o of outcomes) {
    accumulatedTime += (o.execution_time_ms || 1000);
    if ((o.new_findings || 0) > 0 || (o.confirmed_findings || 0) > 0) {
      ttffMs = accumulatedTime;
      break;
    }
  }

  // Hypotheses breakdown
  const hypothesesCount = hypotheses.length;
  const validatedHypotheses = hypotheses.filter((h) => h.status === 'validated').length;
  const refutedHypotheses = hypotheses.filter((h) => h.status === 'refuted').length;

  // Normalized compute cost: base tool execution ms / 100 + LLM inference token factor
  const baseCost = outcomes.reduce((sum, o) => sum + (o.resource_cost || 1), 0);
  const llmCost = strategyKey === 'strategy_b_vulnllm' ? hypothesesCount * 1.5 : 0;
  const totalComputeCost = Math.round((baseCost + llmCost) * 10) / 10;

  return {
    success: true,
    investigation_id: summary.investigation_id,
    strategy_key: strategyKey,
    strategy_name: strategyName,
    trial_index: trialIndex,
    duration_ms: durationMs,
    ttff_ms: ttffMs,
    total_executions: totalExecutions,
    unnecessary_executions: unnecessaryExecutions,
    unique_endpoints: uniqueEndpoints,
    total_assets: totalAssets,
    total_findings: totalFindings,
    confirmed_findings: confirmedFindings,
    false_positives: falsePositives,
    verification_success_rate: Math.round(verificationSuccessRate * 10) / 10,
    hypotheses_count: hypothesesCount,
    validated_hypotheses: validatedHypotheses,
    refuted_hypotheses: refutedHypotheses,
    total_compute_cost: totalComputeCost,
    stop_reason: summary.stop_reason,
  };
}

async function main() {
  console.log(`\n${CYAN}========================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   Bounty OS v0.5 — Strategic VulnLLM Integration Benchmark Suite       ${RESET}`);
  console.log(`${CYAN}   Comparative Evaluation: Deterministic Planner vs Planner + VulnLLM   ${RESET}`);
  console.log(`${CYAN}========================================================================${RESET}\n`);

  // 1. Verify Server Health
  const health = await requestJson(`${SERVER_BASE}/health`);
  if (health.status !== 200) {
    console.error(`${RED}[ERROR] Could not connect to BountyOS Server at ${SERVER_BASE}.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}✔ Connected to BountyOS Server at ${SERVER_BASE} (200 OK)${RESET}\n`);

  const TARGET_SUITE = [
    {
      id: 'target_webapp',
      name: 'Local Web App (Apache/PHP, Form Inputs, Reflected /search)',
      url: 'http://target.local:8888',
      host: 'target.local',
      scope: {
        domains: ['target.local'],
        wildcards: ['*.local'],
        excluded_hosts: ['evil.com'],
      },
    },
    {
      id: 'target_api',
      name: 'REST API Target (JSON Endpoints, Sensitive Disclosures /api/v1/config)',
      url: 'http://target.local:8888/api/v1/config',
      host: 'target.local',
      scope: {
        domains: ['target.local'],
        wildcards: ['*.local'],
        excluded_hosts: ['evil.com'],
      },
    },
    {
      id: 'target_admin_boundary',
      name: 'Auth Boundary Target (401 Administrative Console /admin, /robots.txt)',
      url: 'http://target.local:8888/admin',
      host: 'target.local',
      scope: {
        domains: ['target.local'],
        wildcards: ['*.local'],
        excluded_hosts: ['evil.com'],
      },
    },
  ];

  const STRATEGIES = [
    {
      key: 'strategy_a_deterministic',
      name: 'Strategy A: Deterministic Planner (v0.2 Baseline)',
    },
    {
      key: 'strategy_b_vulnllm',
      name: 'Strategy B: Strategic VulnLLM + Planner (v0.5)',
    },
  ];

  const TRIALS_PER_TARGET = parseInt(process.env.BENCHMARK_TRIALS || '3', 10);
  console.log(`${BOLD}Running multi-target diversity benchmark (${TARGET_SUITE.length} target archetypes, ${TRIALS_PER_TARGET} trials per target per strategy)...${RESET}\n`);

  const rawResults = {};
  for (const strat of STRATEGIES) {
    rawResults[strat.key] = [];
  }

  for (const targetItem of TARGET_SUITE) {
    console.log(`${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${CYAN}${BOLD}▶ Target Archetype: ${targetItem.name}${RESET}`);
    console.log(`${CYAN}  URL: ${targetItem.url}${RESET}`);
    console.log(`${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

    for (const strat of STRATEGIES) {
      console.log(`${YELLOW}${BOLD}▶ Executing ${strat.name}...${RESET}`);

      for (let i = 1; i <= TRIALS_PER_TARGET; i++) {
        process.stdout.write(`   [${targetItem.id}] Trial ${i}/${TRIALS_PER_TARGET}... `);
        const trialRes = await runBenchmarkTrial(strat.key, strat.name, i, targetItem.url, targetItem.scope);
        trialRes.target_archetype = targetItem.id;
        trialRes.target_name = targetItem.name;

        if (trialRes.success) {
          rawResults[strat.key].push(trialRes);
          console.log(
            `${GREEN}✔ Completed in ${trialRes.duration_ms}ms (TTFF: ${trialRes.ttff_ms}ms, Confirmed: ${trialRes.confirmed_findings}, Endpoints: ${trialRes.unique_endpoints}, Unnecessary: ${trialRes.unnecessary_executions}, Hyps: ${trialRes.hypotheses_count})${RESET}`
          );
        } else {
          console.log(`${RED}✖ Failed: ${trialRes.error}${RESET}`);
        }
      }
      console.log('');
    }
  }

  // 2. Statistical Aggregation
  const summaryReport = {
    timestamp: new Date().toISOString(),
    benchmark_version: 'v0.5',
    target: TARGET_URL,
    trials_per_strategy: TARGET_SUITE.length * TRIALS_PER_TARGET,
    trials_per_target: TRIALS_PER_TARGET,
    targets_evaluated: TARGET_SUITE.length,
    metrics: {},
    comparison: {},
  };

  for (const strat of STRATEGIES) {
    const trials = rawResults[strat.key];
    const durations = trials.map((t) => t.duration_ms);
    const ttffs = trials.map((t) => t.ttff_ms);
    const confirmed = trials.map((t) => t.confirmed_findings);
    const totalFindings = trials.map((t) => t.total_findings);
    const falsePositives = trials.map((t) => t.false_positives);
    const endpoints = trials.map((t) => t.unique_endpoints);
    const unnecessary = trials.map((t) => t.unnecessary_executions);
    const vSuccess = trials.map((t) => t.verification_success_rate);
    const computeCosts = trials.map((t) => t.total_compute_cost);
    const hypotheses = trials.map((t) => t.hypotheses_count);
    const validatedHypotheses = trials.map((t) => t.validated_hypotheses);
    const refutedHypotheses = trials.map((t) => t.refuted_hypotheses);

    summaryReport.metrics[strat.key] = {
      name: strat.name,
      completed_trials: trials.length,
      time_to_first_finding_ms: {
        mean: Math.round(mean(ttffs)),
        stddev: Math.round(stddev(ttffs)),
      },
      confirmed_findings: {
        mean: Math.round(mean(confirmed) * 10) / 10,
        stddev: Math.round(stddev(confirmed) * 10) / 10,
      },
      false_positives: {
        mean: Math.round(mean(falsePositives) * 10) / 10,
        stddev: Math.round(stddev(falsePositives) * 10) / 10,
      },
      unique_endpoints: {
        mean: Math.round(mean(endpoints) * 10) / 10,
        stddev: Math.round(stddev(endpoints) * 10) / 10,
      },
      unnecessary_tool_executions: {
        mean: Math.round(mean(unnecessary) * 10) / 10,
        stddev: Math.round(stddev(unnecessary) * 10) / 10,
      },
      verification_success_rate_pct: {
        mean: Math.round(mean(vSuccess) * 10) / 10,
        stddev: Math.round(stddev(vSuccess) * 10) / 10,
      },
      total_duration_ms: {
        mean: Math.round(mean(durations)),
        stddev: Math.round(stddev(durations)),
      },
      total_compute_cost: {
        mean: Math.round(mean(computeCosts) * 10) / 10,
        stddev: Math.round(stddev(computeCosts) * 10) / 10,
      },
      hypotheses_formulated: {
        mean: Math.round(mean(hypotheses) * 10) / 10,
      },
      hypotheses_validated: {
        mean: Math.round(mean(validatedHypotheses) * 10) / 10,
      },
      hypotheses_refuted: {
        mean: Math.round(mean(refutedHypotheses) * 10) / 10,
      },
    };
  }

  // 3. Delta Analysis (Strategy B vs Strategy A)
  const a = summaryReport.metrics['strategy_a_deterministic'];
  const b = summaryReport.metrics['strategy_b_vulnllm'];

  function pctChange(newVal, oldVal) {
    if (oldVal === 0) return newVal > 0 ? '+100.0%' : '0.0%';
    const pct = ((newVal - oldVal) / oldVal) * 100.0;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }

  summaryReport.comparison = {
    ttff_reduction: pctChange(b.time_to_first_finding_ms.mean, a.time_to_first_finding_ms.mean),
    confirmed_findings_lift: pctChange(b.confirmed_findings.mean, a.confirmed_findings.mean),
    false_positives_change: pctChange(b.false_positives.mean, a.false_positives.mean),
    unique_endpoints_lift: pctChange(b.unique_endpoints.mean, a.unique_endpoints.mean),
    unnecessary_executions_reduction: pctChange(b.unnecessary_tool_executions.mean, a.unnecessary_tool_executions.mean),
    verification_success_rate_change: pctChange(b.verification_success_rate_pct.mean, a.verification_success_rate_pct.mean),
    compute_cost_overhead: pctChange(b.total_compute_cost.mean, a.total_compute_cost.mean),
    is_vulnllm_superior: b.confirmed_findings.mean >= a.confirmed_findings.mean &&
                         b.time_to_first_finding_ms.mean <= a.time_to_first_finding_ms.mean &&
                         b.unnecessary_tool_executions.mean <= a.unnecessary_tool_executions.mean,
  };

  // 4. Output Summary Table
  console.log(`\n${CYAN}========================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                     BENCHMARK RESULTS SUMMARY                          ${RESET}`);
  console.log(`${CYAN}========================================================================${RESET}\n`);

  console.log(`| Metric                         | Strategy A (Deterministic) | Strategy B (VulnLLM) | Delta (B vs A) |`);
  console.log(`|:-------------------------------|:---------------------------|:---------------------|:---------------|`);
  console.log(`| Time to First Finding (TTFF)   | ${String(a.time_to_first_finding_ms.mean + 'ms').padEnd(26)} | ${String(b.time_to_first_finding_ms.mean + 'ms').padEnd(20)} | ${summaryReport.comparison.ttff_reduction.padEnd(14)} |`);
  console.log(`| Confirmed Findings             | ${String(a.confirmed_findings.mean).padEnd(26)} | ${String(b.confirmed_findings.mean).padEnd(20)} | ${summaryReport.comparison.confirmed_findings_lift.padEnd(14)} |`);
  console.log(`| False Positives                | ${String(a.false_positives.mean).padEnd(26)} | ${String(b.false_positives.mean).padEnd(20)} | ${summaryReport.comparison.false_positives_change.padEnd(14)} |`);
  console.log(`| Unique Endpoints Discovered    | ${String(a.unique_endpoints.mean).padEnd(26)} | ${String(b.unique_endpoints.mean).padEnd(20)} | ${summaryReport.comparison.unique_endpoints_lift.padEnd(14)} |`);
  console.log(`| Unnecessary Tool Executions    | ${String(a.unnecessary_tool_executions.mean).padEnd(26)} | ${String(b.unnecessary_tool_executions.mean).padEnd(20)} | ${summaryReport.comparison.unnecessary_executions_reduction.padEnd(14)} |`);
  console.log(`| Verification Success Rate      | ${String(a.verification_success_rate_pct.mean + '%').padEnd(26)} | ${String(b.verification_success_rate_pct.mean + '%').padEnd(20)} | ${summaryReport.comparison.verification_success_rate_change.padEnd(14)} |`);
  console.log(`| Total Compute Cost             | ${String(a.total_compute_cost.mean).padEnd(26)} | ${String(b.total_compute_cost.mean).padEnd(20)} | ${summaryReport.comparison.compute_cost_overhead.padEnd(14)} |`);
  console.log(`| Hypotheses (Form/Val/Ref)      | ${String('N/A').padEnd(26)} | ${String(`${b.hypotheses_formulated.mean}/${b.hypotheses_validated.mean}/${b.hypotheses_refuted.mean}`).padEnd(20)} | N/A            |`);

  console.log(`\n${BOLD}Decision Recommendation:${RESET}`);
  if (summaryReport.comparison.is_vulnllm_superior) {
    console.log(`${GREEN}${BOLD}✔ SHIP VULNLLM STRATEGIC LAYER: Strategy B demonstrably outperforms Strategy A with faster TTFF and reduced unnecessary executions.${RESET}\n`);
  } else {
    console.log(`${YELLOW}${BOLD}⚠ CAUTION: Strategy B does not strictly dominate Strategy A across all efficiency gates.${RESET}\n`);
  }

  // 5. Persist Report to disk
  const reportsDir = path.join(__dirname, '..', 'experiments', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'v0.5_strategic_vulnllm_benchmark_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summaryReport, null, 2));
  console.log(`${CYAN}Benchmark report saved to: ${reportPath}${RESET}\n`);
}

main().catch((err) => {
  console.error(`${RED}Fatal benchmark error: ${err.message}${RESET}`);
  process.exit(1);
});
