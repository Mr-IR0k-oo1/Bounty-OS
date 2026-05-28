"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle, Bug, FileText, MessageSquare, History, Copy, ChevronRight,
  ExternalLink, Download, Send, Shield
} from "lucide-react"

type Tab = "details" | "evidence" | "notes" | "history"

const events = [
  { action: "Finding created", user: "nuclei", time: "2025-04-10 14:23:00" },
  { action: "Assigned to hunter1", user: "system", time: "2025-04-10 14:25:00" },
  { action: "Validated as true positive", user: "hunter1", time: "2025-04-10 16:00:00" },
  { action: "Report submitted to program", user: "hunter1", time: "2025-04-11 09:15:00" },
]

export default function FindingDetailPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState<Tab>("details")

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "details", label: "Details", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "evidence", label: "Evidence", icon: <Bug className="w-3.5 h-3.5" /> },
    { key: "notes", label: "Notes", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "history", label: "History", icon: <History className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-[2] space-y-5 min-w-0">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <a href="/findings" className="hover:text-text-primary">Findings</a>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-primary truncate">SSRF in api.uber.com</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">SSRF in api.uber.com/internal/health</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-severity-critical text-white">
                <AlertTriangle className="w-3 h-3" /> critical
              </span>
              <span className="badge bg-primary-muted text-primary text-xs">new</span>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Assigned to <span className="text-text-secondary">hunter1</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm"><Send className="w-3.5 h-3.5 mr-1" /> Submit</Button>
            <Button variant="destructive" size="sm">Mark FP</Button>
            <Button variant="ghost" size="sm"><Copy className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-bg-subtle rounded-md w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
                activeTab === tab.key
                  ? "bg-bg-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "details" && (
          <Card className="bg-bg-elevated border border-border p-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">Host</label>
                  <p className="text-sm font-mono text-text-primary mt-0.5">api.uber.com</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">URL</label>
                  <p className="text-sm font-mono text-text-primary mt-0.5 break-all">https://api.uber.com/internal/health?url=http://169.254.169.254/</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">Tool</label>
                  <p className="text-sm text-text-secondary mt-0.5">nuclei / nuclei-templates:v4.2.0</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">CVE</label>
                  <p className="text-sm text-text-secondary mt-0.5">N/A</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">CVSS</label>
                  <p className="text-sm text-text-secondary mt-0.5">9.1 (Critical)</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">Template</label>
                  <p className="text-sm font-mono text-text-secondary mt-0.5">ssrf-detect.yaml</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">Discovered</label>
                  <p className="text-sm text-text-secondary mt-0.5">2025-04-10 14:23:00</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider">Severity Rationale</label>
                  <p className="text-sm text-text-secondary mt-0.5">Cloud metadata endpoint accessible via SSRF</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <label className="text-xs text-text-muted uppercase tracking-wider">Description</label>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                A Server-Side Request Forgery (SSRF) vulnerability was discovered in the health check endpoint of the internal API.
                The application accepts a URL parameter and makes requests to arbitrary hosts without proper validation.
                An attacker could exploit this to access internal services and cloud provider metadata endpoints.
              </p>
            </div>
          </Card>
        )}

        {activeTab === "evidence" && (
          <div className="space-y-4">
            <Card className="bg-bg-elevated border border-border">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-subtle">
                <span className="text-xs font-semibold text-text-muted uppercase">Request</span>
                <Button variant="ghost" size="sm"><Copy className="w-3 h-3" /></Button>
              </div>
              <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto">
{`GET /internal/health?url=http://169.254.169.254/latest/meta-data/ HTTP/1.1
Host: api.uber.com
User-Agent: Mozilla/5.0 (compatible; Nuclei)
Accept: */*`}
              </pre>
            </Card>
            <Card className="bg-bg-elevated border border-border">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-subtle">
                <span className="text-xs font-semibold text-text-muted uppercase">Response</span>
                <Button variant="ghost" size="sm"><Copy className="w-3 h-3" /></Button>
              </div>
              <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto">
{`HTTP/1.1 200 OK
Content-Type: text/plain

ami-id
ami-launch-index
ami-manifest-path
hostname
instance-id
instance-type
local-ipv4
public-keys/`}
              </pre>
            </Card>
          </div>
        )}

        {activeTab === "notes" && (
          <Card className="bg-bg-elevated border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Notes</h3>
              <Button variant="ghost" size="sm">+ Add Note</Button>
            </div>
            <Textarea
              placeholder="Add notes about this finding..."
              className="min-h-[200px] w-full"
              defaultValue="Confirmed SSRF via metadata endpoint. The request returns cloud instance metadata. Cloudflare WAF doesn't block the internal endpoint."
            />
            <div className="flex justify-end mt-3">
              <Button size="sm">Save Notes</Button>
            </div>
          </Card>
        )}

        {activeTab === "history" && (
          <Card className="bg-bg-elevated border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left">Action</th>
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e, i) => (
                  <tr key={i} className="hover:bg-bg-overlay">
                    <td className="px-4 py-2.5 text-text-primary">{e.action}</td>
                    <td className="px-4 py-2.5 text-text-muted">{e.user}</td>
                    <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{e.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="flex-1 space-y-4">
        <Card className="bg-bg-elevated border border-border p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button className="w-full justify-start" variant="ghost" size="sm">
              <Send className="w-3.5 h-3.5 mr-2" /> Submit to Program
            </Button>
            <Button className="w-full justify-start" variant="ghost" size="sm">
              <Download className="w-3.5 h-3.5 mr-2" /> Export as PoC
            </Button>
            <Button className="w-full justify-start" variant="ghost" size="sm">
              <Shield className="w-3.5 h-3.5 mr-2" /> Add to Report
            </Button>
            <Button className="w-full justify-start" variant="ghost" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open in Browser
            </Button>
          </div>
        </Card>

        <Card className="bg-bg-elevated border border-border p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase mb-3">Report Builder</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-bg-subtle border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Quick Report</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs">Add</Button>
              </div>
              <p className="text-xs text-text-muted mt-1">Add this finding to a new or existing report</p>
            </div>
            <div className="p-3 rounded-md bg-bg-subtle border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Bug Bounty Template</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs">Use</Button>
              </div>
              <p className="text-xs text-text-muted mt-1">Generate a platform-formatted submission</p>
            </div>
          </div>
        </Card>

        <Card className="bg-bg-elevated border border-border p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Finding Context</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Program</span>
              <span className="text-text-primary">Uber (HackerOne)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Scan Job</span>
              <span className="text-text-secondary">#job-20250410-001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Similar (3)</span>
              <span className="text-text-secondary">Related findings</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
