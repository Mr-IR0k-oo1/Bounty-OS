"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Radio,
  Activity,
  Shield,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  Globe,
  Terminal,
  CheckCircle2,
  SlidersHorizontal,
  Wifi,
  Cpu,
  Server,
  Zap,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  WifiOff,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"

interface MonitorEvent {
  id: string
  timestamp: string
  program: string
  host: string
  type: "new_subdomain" | "port_opened" | "cert_change" | "status_change" | "tech_detected"
  severity: "critical" | "high" | "medium" | "low" | "info"
  description: string
  details: string
}

const initialEvents: MonitorEvent[] = [
  {
    id: "ev-1",
    timestamp: "Just now",
    program: "Uber",
    host: "dev-auth.stage.uber.com",
    type: "new_subdomain",
    severity: "high",
    description: "New alive subdomain discovered via crt.sh & DNS brute force",
    details: "CNAME points to internal-auth-k8s.stage.uberinternal.net (HTTP 200 OK, nginx/1.24)",
  },
  {
    id: "ev-2",
    timestamp: "3m ago",
    program: "Airbnb",
    host: "payments-api.airbnb.com",
    type: "port_opened",
    severity: "critical",
    description: "Unexpected open port detected: 8443 (Alt-HTTPS)",
    details: "TLS Banner: Kubernetes Ingress Controller, exposed swagger-ui endpoint at /docs",
  },
  {
    id: "ev-3",
    timestamp: "12m ago",
    program: "Twitter",
    host: "upload.twitter.com",
    type: "status_change",
    severity: "medium",
    description: "HTTP status changed from 403 Forbidden -> 200 OK",
    details: "Path /v2/media/chunked-upload returning JSON response without authorization header",
  },
  {
    id: "ev-4",
    timestamp: "28m ago",
    program: "Shopify",
    host: "cdn-assets.myshopify.com",
    type: "cert_change",
    severity: "low",
    description: "TLS Certificate updated by Cloudflare Inc ECC CA-3",
    details: "SAN list expanded to include 14 new regional distribution endpoints",
  },
  {
    id: "ev-5",
    timestamp: "45m ago",
    program: "Uber",
    host: "fleet-telematics.uber.com",
    type: "tech_detected",
    severity: "info",
    description: "New technology signature: Apache Kafka REST Proxy 7.2",
    details: "Port 9092 open, exposed metrics endpoint at /metrics",
  },
  {
    id: "ev-6",
    timestamp: "1h ago",
    program: "Dropbox",
    host: "client-telemetry.dropbox.com",
    type: "new_subdomain",
    severity: "medium",
    description: "Subdomain reinstated after 30-day DNS disappearance",
    details: "Resolves to 162.125.81.1, TLS handshake verified",
  },
]

const watchlistHosts = [
  { host: "api.uber.com", program: "Uber", status: "alive", latency: "24ms", ports: [80, 443], lastDelta: "No change (12h)" },
  { host: "payments-api.airbnb.com", program: "Airbnb", status: "alert", latency: "42ms", ports: [80, 443, 8443], lastDelta: "Port 8443 opened (3m ago)" },
  { host: "dev-auth.stage.uber.com", program: "Uber", status: "new", latency: "58ms", ports: [443], lastDelta: "Discovered just now" },
  { host: "auth.twitter.com", program: "Twitter", status: "alive", latency: "19ms", ports: [443], lastDelta: "Headers updated (2h ago)" },
  { host: "admin.shopify.com", program: "Shopify", status: "alive", latency: "31ms", ports: [443], lastDelta: "No change (2d)" },
]

export default function MonitorPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"live" | "watchlist" | "telemetry" | "terminal">("live")
  const [isStreaming, setIsStreaming] = useState(true)
  const [isConnecting, setIsConnecting] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all")
  const [events, setEvents] = useState<MonitorEvent[]>(initialEvents)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  // Simulated initial feed connection (mock only — no backend or WebSocket involved)
  useEffect(() => {
    const timer = setTimeout(() => setIsConnecting(false), 900)
    return () => clearTimeout(timer)
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchSearch =
        e.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.program.toLowerCase().includes(searchQuery.toLowerCase())
      const matchSeverity = selectedSeverity === "all" || e.severity === selectedSeverity
      return matchSearch && matchSeverity
    })
  }, [events, searchQuery, selectedSeverity])

  const handleClearLogs = () => {
    setEvents([])
    toast({ title: "Logs cleared", description: "Monitor event stream has been cleared." })
  }

  const handleManualPoll = () => {
    toast({
      title: "Polling triggers dispatched",
      description: "Triggered active DNS diff and HTTP status probe across 1,428 hosts.",
    })
  }

  const handleSimulateOutage = () => {
    setIsStreaming(false)
    setFeedError("Monitor stream stopped receiving change events — 3 consecutive polling cycles timed out.")
  }

  const handleReconnect = () => {
    setFeedError(null)
    setIsStreaming(true)
    toast({ title: "Reconnected", description: "Monitor feed resumed." })
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(id)
    setTimeout(() => setCopiedIndex(null), 1500)
    toast({ title: "Copied to clipboard", description: text })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <span>Workspace</span>
            <span>/</span>
            <span>Pipeline</span>
            <span>/</span>
            <span className="text-text-primary font-medium">Monitor</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-accent animate-pulse" />
            Continuous Host Monitor
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time change detection, DNS alterations, certificate telemetry, and HTTP drift detection
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStreaming((prev) => !prev)}
            className={cn(
              "border-border text-xs gap-1.5",
              isStreaming ? "text-accent border-accent/40 bg-accent/10" : "text-text-muted"
            )}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Live Stream ON
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Stream Paused
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualPoll}
            className="border-border text-xs text-text-muted hover:text-text-primary gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Poll Now
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLogs}
            className="border-border text-xs text-text-muted hover:text-critical gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Monitored Hosts</span>
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary mt-2">1,428</div>
          <div className="text-[11px] text-accent mt-1 flex items-center gap-1 font-medium">
            <span>+14 newly alive today</span>
          </div>
        </Card>

        <Card className="p-4 bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Change Events (24h)</span>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary mt-2">34</div>
          <div className="text-[11px] text-text-muted mt-1">4 critical / high deltas</div>
        </Card>

        <Card className="p-4 bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Active Alerts</span>
            <AlertTriangle className="w-4 h-4 text-severity-critical" />
          </div>
          <div className="text-2xl font-bold font-mono text-severity-critical mt-2">2</div>
          <div className="text-[11px] text-severity-critical mt-1">Requires triage</div>
        </Card>

        <Card className="p-4 bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Polling Engine</span>
            <Cpu className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary mt-2">15m crons</div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            run_monitor.sh operational
          </div>
        </Card>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-3">
        <div className="flex gap-1 bg-bg-subtle p-1 rounded-xl border border-border">
          {[
            { key: "live", label: "Change Feed", count: filteredEvents.length },
            { key: "watchlist", label: "Host Watchlist", count: watchlistHosts.length },
            { key: "telemetry", label: "Pipeline Telemetry" },
            { key: "terminal", label: "Raw Terminal Stream" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2",
                activeTab === tab.key
                  ? "bg-bg-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-bg-overlay text-[10px] font-mono text-text-secondary">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "live" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Search host, program, detail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs w-56 bg-bg-elevated border-border"
              />
            </div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-secondary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <button
              onClick={handleSimulateOutage}
              title="Simulate feed outage"
              aria-label="Simulate feed outage"
              className="h-8 px-2.5 rounded-md border border-border bg-bg-elevated text-text-muted hover:text-critical hover:border-critical/40 transition-colors"
            >
              <WifiOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: LIVE CHANGE FEED */}
      {activeTab === "live" && (
        <div className="space-y-3">
          {feedError ? (
            <Card className="p-10 text-center bg-bg-elevated border border-border">
              <AlertTriangle className="w-10 h-10 text-severity-critical mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-semibold text-text-primary">Monitor feed disconnected</h3>
              <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">{feedError}</p>
              <Button size="sm" className="mt-4 text-xs" onClick={handleReconnect}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reconnect
              </Button>
            </Card>
          ) : isConnecting ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-4 bg-bg-elevated border border-border">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-4 w-16 rounded" />
                      <div className="skeleton h-4 w-20 rounded" />
                      <div className="skeleton h-4 w-36 rounded" />
                    </div>
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                  <div className="skeleton h-4 w-3/4 rounded mb-2" />
                  <div className="skeleton h-8 w-full rounded" />
                </Card>
              ))}
              <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Connecting to monitor feed&hellip;
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card className="p-12 text-center bg-bg-elevated border border-border">
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-semibold text-text-primary">All hosts quiet</h3>
              <p className="text-xs text-text-muted mt-1">No matching change events detected in the active window.</p>
            </Card>
          ) : (
            filteredEvents.map((event) => {
            const severityColors = {
              critical: "bg-critical/15 text-critical border-critical/30",
              high: "bg-high/15 text-high border-high/30",
              medium: "bg-medium/15 text-medium border-medium/30",
              low: "bg-low/15 text-low border-low/30",
              info: "bg-info/15 text-info border-info/30",
            }[event.severity]

            return (
              <Card
                key={event.id}
                className="p-4 bg-bg-elevated/90 border border-border hover:border-primary/40 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border",
                        severityColors
                      )}
                    >
                      {event.severity}
                    </span>
                    <Badge variant="outline" className="bg-primary-muted text-primary border-primary/20 text-xs">
                      {event.program}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-text-primary flex items-center gap-1">
                      {event.host}
                      <button
                        onClick={() => handleCopy(event.host, event.id)}
                        className="text-text-muted hover:text-text-primary p-0.5"
                        title="Copy host"
                      >
                        {copiedIndex === event.id ? (
                          <Check className="w-3 h-3 text-accent" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {event.timestamp}
                  </span>
                </div>

                <div className="text-sm font-medium text-text-primary mb-1">{event.description}</div>
                <div className="text-xs text-text-muted font-mono bg-bg-base/60 p-2.5 rounded-lg border border-border/80 flex items-start justify-between gap-2">
                  <span>{event.details}</span>
                  <a
                    href={`https://${event.host}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-[11px] shrink-0"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </Card>
            )
            })
          )}
        </div>
      )}

      {/* TAB 2: HOST WATCHLIST */}
      {activeTab === "watchlist" && (
        <Card className="bg-bg-elevated border border-border overflow-hidden">
          <div className="px-4 py-3 bg-bg-subtle border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase text-text-muted tracking-wider">
              Continuous Polling Registry (15m Interval)
            </h3>
            <span className="text-xs font-mono text-text-muted">{watchlistHosts.length} hosts flagged</span>
          </div>

          <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-base/50 text-text-muted uppercase border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Host</th>
                <th className="py-2.5 px-4">Program</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Open Ports</th>
                <th className="py-2.5 px-4">Last Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {watchlistHosts.map((h) => (
                <tr key={h.host} className="hover:bg-bg-overlay/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-text-primary flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        h.status === "alive" ? "bg-accent" : h.status === "alert" ? "bg-critical animate-ping" : "bg-primary"
                      )}
                    />
                    {h.host}
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{h.program}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        h.status === "alive"
                          ? "bg-accent/10 text-accent"
                          : h.status === "alert"
                          ? "bg-critical/10 text-critical"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-muted">{h.latency}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {h.ports.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 bg-bg-subtle rounded border border-border text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{h.lastDelta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </Card>
      )}

      {/* TAB 3: PIPELINE TELEMETRY */}
      {activeTab === "telemetry" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 bg-bg-elevated border border-border space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Orchestrator Background Workers
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Stage 1 (Passive Subfinder / crt.sh)</span>
                <span className="text-accent font-semibold">Idle • Next in 14m</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Stage 2 (httpx / naabu diff)</span>
                <span className="text-primary font-semibold">Running (PID 3912)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Stage 3 (Active Endpoint Fuzz)</span>
                <span className="text-text-muted">Gated by Scope Approval</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Stage 4 (Nuclei Vuln Scans)</span>
                <span className="text-text-muted">Scheduled for 02:00 UTC</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-bg-elevated border border-border space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Redis Queues & Broadcast
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Redis Stream Channel</span>
                <span className="text-text-primary">bountyos:monitor:events</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">WebSocket Broadcast</span>
                <span className="text-accent font-semibold">ONLINE (ws://localhost:8000/ws)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Event Retention Window</span>
                <span className="text-text-primary">7 Days (max 50,000 entries)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-bg-base/60 border border-border">
                <span className="text-text-secondary">Host Change Rate</span>
                <span className="text-text-primary">~1.4 events/hour</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: RAW TERMINAL STREAM */}
      {activeTab === "terminal" && (
        <Card className="bg-[#05070a] border border-border p-4 font-mono text-xs text-text-secondary overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-border/80 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="font-semibold text-text-primary">stdout / stderr: run_monitor.sh</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              LIVE TELEMETRY
            </div>
          </div>

          <div className="space-y-1.5 overflow-x-auto text-[11px] leading-relaxed">
            <div className="text-text-muted">[2026-09-19 14:10:02] [INFO] Initializing continuous monitor daemon (v3.0)...</div>
            <div className="text-text-muted">[2026-09-19 14:10:03] [INFO] Loaded 1,428 targets across 4 active programs.</div>
            <div className="text-accent">[2026-09-19 14:12:15] [CHANGE_DETECTED] Uber: dev-auth.stage.uber.com resolved to 10.240.12.89</div>
            <div className="text-text-muted">[2026-09-19 14:12:16] [PROBE] Dispatching httpx to dev-auth.stage.uber.com:443...</div>
            <div className="text-medium">[2026-09-19 14:12:18] [HTTP_200] Title: &quot;Stage Identity Gateway&quot; [nginx/1.24.0]</div>
            <div className="text-critical font-bold">[2026-09-19 14:14:02] [ALERT] Airbnb: Port 8443 open on payments-api.airbnb.com</div>
            <div className="text-text-muted">[2026-09-19 14:15:00] [CRON] Heartbeat verified. Active connections: 3. Worker load: 4.2%.</div>
          </div>
        </Card>
      )}
    </div>
  )
}
