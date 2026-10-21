/**
 * Bounty OS v0.1 — Chaos & Failure Recovery Drill
 * Deliberately induces system faults to verify resilient self-healing and zero hung states.
 */

const { execSync } = require('child_process');

const API_BASE = process.env.BOUNTYOS_API_URL || 'http://127.0.0.1:8000/api';
let token = '';
const results = [];

function logTest(phase, name, status, details = '') {
  const icon = status === 'PASS' ? '✓' : (status === 'FAIL' ? '✗' : '⚠');
  console.log(`[${icon} ${status}] [${phase}] ${name}${details ? ' - ' + details : ''}`);
  results.push({ phase, name, status, details, timestamp: new Date().toISOString() });
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(url, { ...options, headers });
    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function pollJob(jobId, maxWaitSec = 35) {
  if (!jobId) return null;
  const start = Date.now();
  while ((Date.now() - start) < maxWaitSec * 1000) {
    const res = await request(`/jobs/${jobId}`);
    if (res.ok && res.data) {
      const status = res.data.status;
      if (status === 'done' || status === 'failed' || status === 'timed_out') {
        return res.data;
      }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

async function runRecoveryDrill() {
  console.log('========================================================================');
  console.log('       BOUNTY OS v0.1 — CHAOS & FAILURE RECOVERY DRILL                  ');
  console.log('========================================================================\n');

  // Login
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });
  if (!login.ok || !login.data?.access_token) {
    console.error('Login failed:', login.data);
    process.exit(1);
  }
  token = login.data.access_token;
  logTest('Auth', 'Acquire JWT', 'PASS', 'Operator token active');

  // Create Test Program
  const proj = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({ name: `Chaos Program ${Date.now()}`, description: 'Failure Testing' }),
  });
  const prog = await request(`/projects/${proj.data.id}/programs`, {
    method: 'POST',
    body: JSON.stringify({ name: `Chaos Target ${Date.now()}`, platform: 'Authorized Lab', program_url: 'http://target.local:8888' }),
  });
  const programId = prog.data.id;
  await request(`/programs/${programId}/scope`, {
    method: 'POST',
    body: JSON.stringify({ target: 'target.local', target_type: 'domain', out_of_scope: false }),
  });
  await request(`/programs/${programId}/approve`, { method: 'POST' });

  // ---------------------------------------------------------------------------
  // FAULT 1: Unreachable service port completes and transitions cleanly
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 1: UNREACHABLE PORT TOOL TERMINATION ---');
  const deadPortJob = await request('/jobs', {
    method: 'POST',
    body: JSON.stringify({
      program_id: programId,
      tool: 'httpx',
      target: 'http://target.local:8889',
    }),
  });
  const deadJobResult = await pollJob(deadPortJob.data?.id);
  const isTerminated = deadJobResult && (deadJobResult.status === 'done' || deadJobResult.status === 'failed');
  logTest('Fault: Network Error', 'Unreachable Service Port Terminates Cleanly', isTerminated ? 'PASS' : 'FAIL', `Finished with status: ${deadJobResult?.status}`);

  // ---------------------------------------------------------------------------
  // FAULT 2: Failed Job Partial Evidence Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 2: PARTIAL EVIDENCE INTEGRITY ---');
  // Verify that an unreachable target does NOT inject false findings
  const findingsCheck = await request(`/findings?program_id=${programId}`);
  const hasGhostFindings = (findingsCheck.data || []).some(f => f.matched_at?.includes(':8889'));
  logTest('Fault: False Positive', 'No Ghost Findings On Connection Failure', !hasGhostFindings ? 'PASS' : 'FAIL', 'Zero phantom findings created');

  // ---------------------------------------------------------------------------
  // FAULT 3: VulnLLM Offline Graceful Fallback
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 3: VULNLLM SERVICE OFFLINE ---');
  const dummyFinding = await request('/findings', {
    method: 'POST',
    body: JSON.stringify({
      program_id: programId,
      title: 'Testing Offline LLM Resilience',
      severity: 'medium',
      finding_type: 'xss',
      matched_at: 'http://target.local:8888/search?q=test',
      curl_command: 'curl -s "http://target.local:8888/search?q=test"',
    }),
  });
  const triageCall = await request(`/findings/${dummyFinding.data.id}/triage`, { method: 'POST' });
  logTest('Fault: LLM Offline', 'VulnLLM 501 Fallback Without Crash', triageCall.status === 501 || triageCall.status === 200 ? 'PASS' : 'FAIL', `Returned HTTP ${triageCall.status}`);

  // ---------------------------------------------------------------------------
  // FAULT 4: Redis Service Restart & Reconnection
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 4: REDIS RESTART & RECONNECTION ---');
  try {
    console.log('[*] Restarting bountyos-redis container...');
    execSync('docker restart bountyos-redis', { stdio: 'pipe' });
    // Allow redis to re-establish
    await new Promise(r => setTimeout(r, 2500));

    // Verify system continues accepting and executing jobs
    const postRedisJob = await request('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId,
        tool: 'httpx',
        target: 'http://target.local:8888',
      }),
    });
    const postRedisResult = await pollJob(postRedisJob.data?.id);
    const redisRecovered = postRedisResult && postRedisResult.status === 'done';
    logTest('Fault: Redis Bounce', 'Self-Healing Redis Job Processing', redisRecovered ? 'PASS' : 'FAIL', `Job completed after restart: ${postRedisResult?.status}`);
  } catch (err) {
    logTest('Fault: Redis Bounce', 'Self-Healing Redis Job Processing', 'FAIL', err.message);
  }

  // ---------------------------------------------------------------------------
  // FAULT 5: PostgreSQL Transient Query & Health Check
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 5: DATABASE HEALTH & RECOVERY ---');
  const dbHealth = await request('/health/doctor');
  const dbOk = dbHealth.ok && dbHealth.data?.subsystems?.database?.status === 'connected';
  logTest('Fault: DB Liveness', 'Database Connected & Healthy', dbOk ? 'PASS' : 'FAIL', `Doctor DB status: ${dbHealth.data?.subsystems?.database?.status || 'unknown'}`);

  // ---------------------------------------------------------------------------
  // FAULT 6: Verify Zero Stuck / Orphaned "Running" Jobs
  // ---------------------------------------------------------------------------
  console.log('\n--- FAULT 6: ORPHANED JOB DETECTION ---');
  const allJobsRes = await request(`/jobs?program_id=${programId}`);
  const jobs = allJobsRes.data || [];
  const runningJobs = jobs.filter(j => j.status === 'running');
  logTest('Fault: Stuck Job', 'Zero Jobs Stuck in "running" State', runningJobs.length === 0 ? 'PASS' : 'FAIL', `${runningJobs.length} running jobs remaining`);

  console.log('\n========================================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`CHAOS & RECOVERY RESULTS: ${results.length} TESTS | ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runRecoveryDrill().catch(err => {
  console.error('Chaos drill failed:', err);
  process.exit(1);
});
