export * from "./errors.js";
export * from "./events.js";

export type ScanProfile = "passive" | "standard" | "deep";

export interface InvestigationScopeInput {
  domains?: string[];
  ips?: string[];
  excluded_hosts?: string[];
}

export interface InvestigationStartResponse {
  investigation_id: string;
  status: "queued" | "running";
  target: string;
  created_at: string;
  profile: ScanProfile;
  active_jobs: number;
}

export interface InvestigationStatusResponse {
  investigation_id: string;
  name: string;
  status: "created" | "queued" | "running" | "paused" | "completed" | "failed" | "cancelled" | "degraded";
  stage: "recon" | "asset_discovery" | "service_discovery" | "web_discovery" | "vulnerability_discovery" | "analysis" | "verification" | "reporting";
  progress: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  assets_count: number;
  services_count: number;
  endpoints_count: number;
  findings_count: number;
}
