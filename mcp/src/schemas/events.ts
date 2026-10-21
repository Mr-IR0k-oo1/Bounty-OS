import { randomUUID } from "crypto";

export type DiscoveryEventType =
  | "target.discovered"
  | "subdomain.discovered"
  | "dns.resolved"
  | "ip.discovered"
  | "port.discovered"
  | "service.discovered"
  | "http_service.discovered"
  | "url.discovered"
  | "endpoint.discovered"
  | "parameter.discovered"
  | "technology.discovered"
  | "finding.discovered"
  | "finding.updated"
  | "finding.verified";

export interface DiscoveryEvent {
  event_id: string;
  type: DiscoveryEventType;
  investigation_id: string;
  asset_id?: string;
  value: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function createDiscoveryEvent(
  type: DiscoveryEventType,
  investigation_id: string,
  value: string,
  source: string,
  asset_id?: string,
  metadata?: Record<string, any>
): DiscoveryEvent {
  return {
    event_id: randomUUID(),
    type,
    investigation_id,
    asset_id,
    value,
    source,
    timestamp: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}
