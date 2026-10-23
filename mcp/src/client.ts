import dotenv from "dotenv";
dotenv.config();

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface Program {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  platform: string;
  program_url?: string;
  active: boolean;
  active_approved: boolean;
  rescan_interval_hrs?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ScopeTarget {
  id: string;
  program_id: string;
  target: string;
  target_type: string;
  out_of_scope: boolean;
  source?: string;
  notes?: string;
  created_at: string;
}

export interface Subdomain {
  id: string;
  program_id: string;
  subdomain: string;
  ip_address?: string;
  status_code?: number;
  title?: string;
  web_server?: string;
  tech?: string[];
  screenshot_path?: string;
  cname?: string;
  ports?: number[];
  source?: string;
  created_at: string;
  updated_at?: string;
}

export interface PortService {
  id: string;
  program_id: string;
  subdomain_id?: string;
  ip: string;
  port: number;
  protocol: string;
  service?: string;
  state: string;
  banner?: string;
  created_at: string;
}

export interface UrlEndpoint {
  id: string;
  program_id: string;
  subdomain_id?: string;
  url: string;
  status_code?: number;
  content_type?: string;
  content_length?: number;
  source: string;
  created_at: string;
}

export interface Finding {
  id: string;
  program_id: string;
  subdomain_id?: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "new" | "triaged" | "validated" | "reported" | "resolved" | "candidate" | "unverified" | "likely" | "confirmed" | "false_positive";
  finding_type?: string;
  matched_at?: string;
  curl_command?: string;
  tags?: string[];
  assigned_to?: string;
  cvss_score?: number;
  kanban_column?: string;
  created_at: string;
  updated_at: string;
  llm_triage_json?: any;
  llm_confidence?: number;
  llm_triaged_at?: string;
}

export interface Job {
  id: string;
  program_id: string;
  subdomain_id?: string;
  stage: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  target?: string;
  flags?: any;
  error_log?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface JobLogs {
  job_id: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  status: string;
}

export interface JobArtifacts {
  job_id: string;
  available: boolean;
  files: string[];
  evidence_path?: string;
  message?: string;
}

export interface ReportData {
  program_id: string;
  program_name: string;
  generated_at: string;
  total_findings: number;
  severity_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  markdown: string;
}

export class BountyOSClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private username: string;
  private password: string;

  constructor(options?: {
    baseUrl?: string;
    token?: string;
    username?: string;
    password?: string;
  }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.BOUNTYOS_API_URL ||
      process.env.BOUNTYOS_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    this.token = options?.token || process.env.BOUNTYOS_API_TOKEN || null;
    this.username = options?.username || process.env.BOUNTYOS_USERNAME || "admin";
    this.password = options?.password || process.env.BOUNTYOS_PASSWORD || "admin";
  }

  private async ensureAuthenticated(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    const loginUrls = [
      `${this.baseUrl}/api/auth/login`,
      `${this.baseUrl}/auth/login`,
      `http://127.0.0.1:8000/api/auth/login`,
      `http://127.0.0.1:3000/api/auth/login`,
    ];

    let lastError: Error | null = null;
    for (const url of loginUrls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as AuthTokens;
          this.token = data.access_token;
          this.refreshToken = data.refresh_token;
          if (url.includes("/api/auth/login")) {
            this.baseUrl = url.replace(/\/auth\/login$/, "");
          }
          return this.token;
        }
      } catch (e: any) {
        lastError = e;
      }
    }

    throw new Error(
      `Failed to authenticate with BountyOS: ${lastError ? lastError.message : "Invalid credentials"}`
    );
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureAuthenticated();

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Auto-prefix with /api if not present
    let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (!path.startsWith("/api") && !this.baseUrl.endsWith("/api")) {
      path = `/api${path}`;
    }

    let res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && this.refreshToken) {
      try {
        const refreshPath = this.baseUrl.endsWith("/api") ? "/auth/refresh" : "/api/auth/refresh";
        const refreshRes = await fetch(`${this.baseUrl}${refreshPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshed = (await refreshRes.json()) as AuthTokens;
          this.token = refreshed.access_token;
          this.refreshToken = refreshed.refresh_token;
          headers["Authorization"] = `Bearer ${this.token}`;
          res = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers,
          });
        }
      } catch {
        // Ignore refresh error
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`BountyOS API error [${res.status}]: ${errText || res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  // --- Project Operations ---

  async listProjects(): Promise<any[]> {
    return this.request<any[]>("/projects");
  }

  async createProject(name: string, description?: string): Promise<any> {
    return this.request<any>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  }

  // --- Program / Investigation Operations ---

  async listPrograms(): Promise<Program[]> {
    return this.request<Program[]>("/programs");
  }

  async getProgram(id: string): Promise<Program> {
    return this.request<Program>(`/programs/${id}`);
  }

  async createProgram(
    projectId: string,
    name: string,
    platform = "self-hosted",
    url?: string
  ): Promise<Program> {
    return this.request<Program>(`/projects/${projectId}/programs`, {
      method: "POST",
      body: JSON.stringify({
        name,
        platform,
        program_url: url,
        active: true,
        active_approved: true,
      }),
    });
  }

  async updateProgram(id: string, payload: Partial<Program>): Promise<Program> {
    return this.request<Program>(`/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async approveProgram(id: string): Promise<Program> {
    return this.request<Program>(`/programs/${id}/approve`, {
      method: "POST",
    });
  }

  // --- Scope Operations ---

  async listScope(programId: string): Promise<ScopeTarget[]> {
    return this.request<ScopeTarget[]>(`/programs/${programId}/scope`);
  }

  async addScopeTarget(
    programId: string,
    target: {
      target: string;
      target_type?: string;
      out_of_scope?: boolean;
      source?: string;
      notes?: string;
    }
  ): Promise<ScopeTarget> {
    return this.request<ScopeTarget>(`/programs/${programId}/scope`, {
      method: "POST",
      body: JSON.stringify({
        target: target.target,
        target_type: target.target_type || "domain",
        out_of_scope: target.out_of_scope ?? false,
        source: target.source || "mcp",
        notes: target.notes || null,
      }),
    });
  }

  // --- Asset (Subdomain) Operations ---

  async listSubdomains(programId: string): Promise<Subdomain[]> {
    return this.request<Subdomain[]>(`/programs/${programId}/subdomains`);
  }

  async getSubdomain(id: string): Promise<Subdomain> {
    return this.request<Subdomain>(`/subdomains/${id}`);
  }

  // --- Service (Port) Operations ---

  async listPorts(subdomainId: string): Promise<PortService[]> {
    return this.request<PortService[]>(`/subdomains/${subdomainId}/ports`);
  }

  // --- Endpoint (URL) Operations ---

  async listUrls(programId: string, subdomainId?: string): Promise<UrlEndpoint[]> {
    const q = subdomainId ? `?subdomain_id=${subdomainId}` : "";
    return this.request<UrlEndpoint[]>(`/programs/${programId}/urls${q}`);
  }

  // --- Scan Job Operations ---

  async listJobs(params?: { program_id?: string; status?: string }): Promise<Job[]> {
    const qParts: string[] = [];
    if (params?.program_id) qParts.push(`program_id=${params.program_id}`);
    if (params?.status) qParts.push(`status=${params.status}`);
    const q = qParts.length ? `?${qParts.join("&")}` : "";
    return this.request<Job[]>(`/jobs${q}`);
  }

  async getJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${id}`);
  }

  async createJob(payload: {
    program_id: string;
    tool: string;
    target: string;
    stage?: number;
    flags?: any;
  }): Promise<Job> {
    return this.request<Job>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async cancelJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${id}`, {
      method: "DELETE",
    });
  }

  async getJobLogs(id: string): Promise<JobLogs> {
    return this.request<JobLogs>(`/jobs/${id}/logs`);
  }

  async getJobArtifacts(id: string): Promise<JobArtifacts> {
    return this.request<JobArtifacts>(`/jobs/${id}/artifacts`);
  }

  // --- Finding Operations ---

  async listFindings(params?: {
    program_id?: string;
    severity?: string;
    status?: string;
  }): Promise<Finding[]> {
    const qParts: string[] = [];
    if (params?.program_id) qParts.push(`program_id=${params.program_id}`);
    if (params?.severity) qParts.push(`severity=${params.severity}`);
    if (params?.status) qParts.push(`status=${params.status}`);
    const q = qParts.length ? `?${qParts.join("&")}` : "";
    return this.request<Finding[]>(`/findings${q}`);
  }

  async getFinding(id: string): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`);
  }

  async createFinding(payload: {
    program_id: string;
    title: string;
    description?: string;
    severity?: string;
    status?: string;
    matched_at?: string;
    finding_type?: string;
    tags?: string[];
    cvss_score?: number;
  }): Promise<Finding> {
    return this.request<Finding>("/findings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateFinding(
    id: string,
    payload: {
      title?: string;
      description?: string;
      severity?: string;
      status?: string;
      cvss_score?: number;
      kanban_column?: string;
    }
  ): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async validateFinding(id: string): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}/validate`, {
      method: "POST",
    });
  }

  async triageFinding(id: string): Promise<any> {
    return this.request<any>(`/findings/${id}/triage`, {
      method: "POST",
    });
  }

  async getFindingTriage(id: string): Promise<any> {
    return this.request<any>(`/findings/${id}/triage`);
  }

  // --- Report Operations ---

  async generateReport(programId: string): Promise<ReportData> {
    return this.request<ReportData>(`/programs/${programId}/report`);
  }

  // --- Static Evidence Operations ---

  async getEvidence(evidencePath: string): Promise<string> {
    const clean = evidencePath.replace(/^\/+/, "");
    return this.request<string>(`/evidence/${clean}`);
  }

  // --- Intelligence Engine Operations ---

  async planInvestigation(payload: {
    investigation_id?: string;
    target?: string;
    scope?: any;
    profile?: string;
    state?: any;
  }): Promise<InvestigationPlan> {
    return this.request<InvestigationPlan>("/investigations/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getInvestigationPlan(investigationId: string): Promise<InvestigationPlan> {
    return this.request<InvestigationPlan>(`/investigations/${investigationId}/plan`);
  }

  async runInvestigation(payload: {
    investigation_id?: string;
    target?: string;
    scope?: any;
    profile?: string;
    max_cycles?: number;
    budget?: any;
  }): Promise<InvestigationRunSummary> {
    const url = payload.investigation_id
      ? `/investigations/${payload.investigation_id}/run`
      : `/investigations/run`;
    return this.request<InvestigationRunSummary>(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getInvestigationActions(investigationId: string): Promise<InvestigationActionRecord[]> {
    return this.request<InvestigationActionRecord[]>(`/investigations/${investigationId}/actions`);
  }

  async getInvestigationOutcomes(investigationId: string): Promise<ActionOutcomeRecord[]> {
    return this.request<ActionOutcomeRecord[]>(`/investigations/${investigationId}/outcomes`);
  }

  async getInvestigationHypotheses(investigationId: string): Promise<SecurityHypothesisRecord[]> {
    return this.request<SecurityHypothesisRecord[]>(`/investigations/${investigationId}/hypotheses`);
  }

  async getInvestigationContext(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/context`);
  }

  async submitInvestigationHypotheses(investigationId: string, hypotheses: any[]): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/hypothesize`, {
      method: "POST",
      body: JSON.stringify({ hypotheses }),
    });
  }

  async prioritizeInvestigation(investigationId: string, hypotheses: any[]): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/prioritize`, {
      method: "POST",
      body: JSON.stringify({ hypotheses }),
    });
  }

  async createInvestigationHypothesis(investigationId: string, payload: {
    category: string;
    target: string;
    rationale: string;
    confidence?: number;
    suggested_actions?: string[];
    required_evidence?: string[];
  }): Promise<SecurityHypothesisRecord> {
    return this.request<SecurityHypothesisRecord>(`/investigations/${investigationId}/hypotheses`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getActionValues(): Promise<ToolHistoricalStats[]> {
    return this.request<ToolHistoricalStats[]>(`/intelligence/action-values`);
  }

  async getExperienceActions(): Promise<ExperienceActionRecord[]> {
    return this.request<ExperienceActionRecord[]>(`/experience/actions`);
  }

  async getExperienceProvenance(query?: { archetype?: string; tool?: string }): Promise<ExperienceProvenanceRecord[]> {
    const params = new URLSearchParams();
    if (query?.archetype) params.set("archetype", query.archetype);
    if (query?.tool) params.set("tool", query.tool);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request<ExperienceProvenanceRecord[]>(`/experience/provenance${qs}`);
  }

  async getInvestigationArchetype(investigationId: string): Promise<ArchetypeClassificationRecord> {
    return this.request<ArchetypeClassificationRecord>(`/investigations/${investigationId}/archetype`);
  }

  async getInvestigationProfile(investigationId: string): Promise<TargetProfileRecord> {
    return this.request<TargetProfileRecord>(`/investigations/${investigationId}/profile`);
  }

  async getInvestigationPolicy(investigationId: string): Promise<TargetPolicyRecord> {
    return this.request<TargetPolicyRecord>(`/investigations/${investigationId}/policy`);
  }

  async stopInvestigation(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/stop`, {
      method: "POST",
    });
  }

  async getInvestigationEducation(investigationId: string): Promise<EducationLessonRecord> {
    return this.request<EducationLessonRecord>(`/investigations/${investigationId}/education`);
  }

  async getInvestigationThreats(investigationId: string): Promise<ThreatItemRecord[]> {
    return this.request<ThreatItemRecord[]>(`/investigations/${investigationId}/threats`);
  }

  async getInvestigationPrioritization(investigationId: string): Promise<TargetPrioritizationScoreRecord> {
    return this.request<TargetPrioritizationScoreRecord>(`/investigations/${investigationId}/prioritization`);
  }

  async analyzeInvestigationBehavior(investigationId: string, targetUrl: string): Promise<BehaviorReportRecord> {
    return this.request<BehaviorReportRecord>(`/investigations/${investigationId}/behavior`, {
      method: "POST",
      body: JSON.stringify({ target_url: targetUrl }),
    });
  }

  async replayInvestigationFlow(investigationId: string, flow: any, dryRun: boolean = false): Promise<FlowReplayResultRecord> {
    return this.request<FlowReplayResultRecord>(`/investigations/${investigationId}/flows/replay`, {
      method: "POST",
      body: JSON.stringify({ flow, dry_run: dryRun }),
    });
  }

  async testInvestigationAuthz(
    investigationId: string,
    endpointTemplate: string,
    resourceIdA: string,
    identityB: any
  ): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/authz/test`, {
      method: "POST",
      body: JSON.stringify({
        endpoint_template: endpointTemplate,
        resource_id_a: resourceIdA,
        identity_b: identityB,
      }),
    });
  }

  async getAdaptivePlan(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/adaptive-plan`);
  }

  async getNextAction(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/next-action`);
  }

  async explainDecision(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/explain-decision`);
  }

  async getAttackSurfaceGraph(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/graph`);
  }

  async getAttackSurfaceSummary(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/graph/summary`);
  }

  async getAttackSurfaceUnexplored(investigationId: string): Promise<any[]> {
    return this.request<any[]>(`/investigations/${investigationId}/graph/unexplored`);
  }

  async getAttackSurfaceRelationships(investigationId: string): Promise<any[]> {
    return this.request<any[]>(`/investigations/${investigationId}/graph/relationships`);
  }

  async recordAttackSurfaceRelationship(investigationId: string, rel: any): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/graph/relationships`, {
      method: "POST",
      body: JSON.stringify(rel),
    });
  }

  async replanInvestigation(investigationId: string): Promise<any> {
    return this.request<any>(`/investigations/${investigationId}/replan`, {
      method: "POST",
    });
  }
}

export interface PlannedAction {
  id: string;
  action_type: string;
  tool: string;
  target: string;
  reason: string;
  score: number;
  info_gain?: number;
  relevance?: number;
  confidence?: number;
  cost?: number;
  risk?: number;
  context?: Record<string, string>;
  policy_reasons?: string[];
  evidence_refs?: string[];
}

export interface CoverageGap {
  gap_type: string;
  target: string;
  description: string;
  priority: number;
}

export interface InvestigationPlan {
  recommended_action: PlannedAction | null;
  alternatives: PlannedAction[];
  coverage_gaps: CoverageGap[];
  stop_reason: any | null;
  strategic_summary?: string | null;
  target_profile?: TargetProfileRecord | null;
  policy_name?: string | null;
}

export interface SecurityHypothesisRecord {
  id: string;
  investigation_id: string;
  category: string;
  target: string;
  rationale: string;
  confidence: number;
  status: "active" | "validated" | "refuted" | "unverified" | "investigating";
  suggested_actions: string[];
  required_evidence: string[];
  created_at: string;
  updated_at: string;
}

export interface InvestigationActionRecord {
  id: string;
  investigation_id: string;
  action_type: string;
  target: string;
  tool: string;
  score: number;
  information_gain: number;
  relevance: number;
  confidence: number;
  cost: number;
  risk: number;
  reason: string;
  status: string;
  actual_information_gain?: number | null;
  prediction_error?: number | null;
  findings_generated: number;
  new_assets_generated: number;
  job_id?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ActionOutcomeRecord {
  id: string;
  investigation_id: string;
  action_id?: string | null;
  tool: string;
  target: string;
  planner_score: number;
  predicted_information_gain: number;
  execution_time_ms: number;
  resource_cost: number;
  risk_score: number;
  new_assets: number;
  new_services: number;
  new_endpoints: number;
  new_parameters: number;
  new_technologies: number;
  new_findings: number;
  confirmed_findings: number;
  false_positives: number;
  verification_result?: string | null;
  actual_information_gain: number;
  actual_value: number;
  prediction_error: number;
  created_at: string;
}

export interface ToolHistoricalStats {
  tool: string;
  execution_count: number;
  success_count: number;
  avg_actual_value: number;
  avg_information_gain: number;
  avg_execution_time_ms: number;
  total_findings: number;
  total_confirmed_findings: number;
  total_new_assets: number;
  total_new_endpoints: number;
}

export interface StateSummary {
  subdomains_count: number;
  services_count: number;
  endpoints_count: number;
  parameters_count: number;
  technologies_count: number;
  findings_count: number;
  executed_actions_count: number;
}

export interface InvestigationRunSummary {
  investigation_id: string;
  target: string;
  status: string;
  cycles_executed: number;
  actions_executed: InvestigationActionRecord[];
  outcomes?: ActionOutcomeRecord[];
  hypotheses?: SecurityHypothesisRecord[];
  stop_reason?: string | null;
  initial_state_summary: StateSummary;
  final_state_summary: StateSummary;
  total_findings: number;
  total_assets: number;
  total_endpoints: number;
  total_information_gain: number;
  archetype?: ArchetypeClassificationRecord;
  target_profile?: TargetProfileRecord | null;
  policy_name?: string | null;
}

export interface ExperienceActionRecord {
  id: string;
  archetype: string;
  technology: string;
  action_type: string;
  tool: string;
  predicted_value: number;
  actual_value: number;
  avg_execution_time_ms: number;
  total_new_assets: number;
  total_new_endpoints: number;
  total_new_parameters: number;
  total_new_findings: number;
  total_confirmed_findings: number;
  total_false_positives: number;
  success_rate: number;
  sample_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExperienceProvenanceRecord {
  id: string;
  experience_id: string;
  archetype: string;
  tool: string;
  action_type: string;
  investigation_id: string;
  action_id?: string | null;
  outcome_id?: string | null;
  observed_value: number;
  new_findings: number;
  confirmed_findings: number;
  created_at: string;
}

export interface ArchetypeClassificationRecord {
  archetype: string;
  confidence: number;
  evidence: string[];
}

export interface TargetProfileRecord {
  id: string;
  investigation_id: string;
  archetype: string;
  technologies: string[];
  exposed_services: string[];
  application_type: string;
  authentication_state: string;
  api_indicators: boolean;
  javascript_heavy: boolean;
  historical_url_density: number;
  evidence: string[];
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface TargetPolicyRecord {
  investigation_id: string;
  policy_name: string;
  archetype: string;
  confidence: number;
  target_profile: TargetProfileRecord;
  recommended_action: PlannedAction | null;
  alternatives: PlannedAction[];
}

export interface EducationLessonRecord {
  stage: string;
  current_surface_summary: string;
  recommended_action: string;
  reason: string;
  evidence_requirements: string;
  learning_objective: string;
}

export interface ThreatItemRecord {
  asset: string;
  stride: "Spoofing" | "Tampering" | "Repudiation" | "InformationDisclosure" | "DenialOfService" | "ElevationOfPrivilege";
  title: string;
  description: string;
  status: "Observed" | "Inferred" | "Hypothesized" | "Verified";
  evidence: string[];
  mitigation?: string;
}

export interface TargetPrioritizationScoreRecord {
  target: string;
  base_score: number;
  endpoint_density_score: number;
  parameter_richness_score: number;
  technology_multiplier: number;
  auth_boundary_bonus: number;
  historical_experience_factor: number;
  total_priority_score: number;
  explanations: string[];
}

export interface BehaviorReportRecord {
  target_url: string;
  baseline_status: number;
  baseline_latency_ms: number;
  baseline_length: number;
  waf_vendor?: string | null;
  rate_limit_detected: boolean;
  active_blocking_detected: boolean;
  observations: string[];
}

export interface FlowReplayResultRecord {
  flow_id: string;
  effective_url: string;
  effective_method: string;
  effective_headers: Record<string, string>;
  effective_body?: string | null;
  status_code?: number | null;
  response_body_snippet?: string | null;
  response_headers: Record<string, string>;
  duration_ms: number;
  dry_run: boolean;
}


