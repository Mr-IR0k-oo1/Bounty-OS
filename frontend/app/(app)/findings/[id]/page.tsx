"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle, Bug, FileText, MessageSquare, History, Copy, ChevronRight,
  ExternalLink, Download, Send, Shield, Check, Calculator, Clock, CheckCircle2, Sparkles, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { EvidenceViewer } from "@/components/findings/EvidenceViewer"
import { CvssCalculator } from "@/components/findings/CvssCalculator"
import { api } from "@/lib/api"
import type { Severity, FindingStatus, Finding } from "@/lib/types"

type Tab = "details" | "evidence" | "cvss" | "notes" | "history"

interface HistoryEvent {
  action: string
  user: string
  time: string
}

export default function FindingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const findingId = (params.id as string) || ""

  const [activeTab, setActiveTab] = useState<Tab>("details")
  const [copiedPoc, setCopiedPoc] = useState(false)
  const [status, setStatus] = useState<FindingStatus>("new")
  const [assignedHunter, setAssignedHunter] = useState("admin")
  const [notesText, setNotesText] = useState("")
  const [cvssScore, setCvssScore] = useState(7.5)
  const [programName, setProgramName] = useState("Active Program")
  const [loading, setLoading] = useState(true)
  const [isTriaging, setIsTriaging] = useState(false)

  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([
    { action: "Finding ingested into PostgreSQL", user: "system", time: "Discovered" },
  ])

  const [finding, setFinding] = useState({
    id: findingId,
    title: "Vulnerability Finding",
    severity: "medium" as Severity,
    host: "target.com",
    targetUrl: "https://target.com",
    program: "Bug Bounty Engagement",
    programId: "",
    cveId: "CVE-PENDING",
    template: "nuclei-detection",
    tool: "BountyOS Pipeline",
    foundAt: "Recently",
    description: "Detailed vulnerability analysis and reproduction steps.",
    request: `GET / HTTP/1.1\nHost: target.com\nUser-Agent: BountyOS-Scanner/2.1`,
    response: `HTTP/1.1 200 OK\nServer: Cloudflare\nContent-Type: application/json`,
    curlCommand: `curl -i -s 'https://target.com'`
  })

  useEffect(() => {
    async function loadData() {
      if (!findingId) return
      setLoading(true)
      try {
        const [f, progs] = await Promise.all([
          api.getFinding(findingId).catch(() => null),
          api.listPrograms().catch(() => []),
        ])

        if (f) {
          const prog = progs?.find((p: any) => p.id === f.program_id)
          const pName = prog?.name || "Active Engagement"
          setProgramName(pName)
          setStatus((f.status || "new") as FindingStatus)
          const score = f.cvss_score || (f.severity === 'critical' ? 9.5 : f.severity === 'high' ? 8.2 : f.severity === 'medium' ? 6.1 : 3.2)
          setCvssScore(score)
          setNotesText(f.description || "")

          setFinding({
            id: f.id || findingId,
            title: f.title || "Vulnerability Finding",
            severity: (f.severity || "medium").toLowerCase() as Severity,
            host: f.matched_at || "Target Endpoint",
            targetUrl: f.matched_at?.startsWith("http") ? f.matched_at : `https://${f.matched_at || "target.com"}`,
            program: pName,
            programId: f.program_id || "",
            cveId: f.tags?.find((t: string) => t.toUpperCase().startsWith("CVE-")) || "CVE-2024-PENDING",
            template: f.finding_type ? `${f.finding_type}-probe` : "pipeline-scanner",
            tool: f.finding_type || "nuclei",
            foundAt: f.created_at ? new Date(f.created_at).toLocaleString() : "Recently",
            description: f.description || "Identified security exposure during automated scanning.",
            request: `GET /${f.matched_at ? f.matched_at.replace(/^https?:\/\/[^\/]+/, '') : ''} HTTP/1.1\nHost: ${f.matched_at || 'target.com'}\nUser-Agent: BountyOS-Scanner/2.1`,
            response: `HTTP/1.1 200 OK\nContent-Type: application/json\nConnection: keep-alive`,
            curlCommand: f.curl_command || `curl -ik -s 'https://${f.matched_at || "target.com"}'`
          })

          setHistoryEvents([
            { action: `Status loaded: ${f.status?.toUpperCase() || 'NEW'}`, user: "system", time: "Loaded" },
            { action: `Assigned severity: ${f.severity?.toUpperCase() || 'INFO'}`, user: "scanner", time: "Discovered" }
          ])
        }
      } catch {
        // Use default
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [findingId])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "details", label: "Details", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "evidence", label: "Evidence & PoC", icon: <Bug className="w-3.5 h-3.5" /> },
    { key: "cvss", label: `CVSS Calculator (${cvssScore})`, icon: <Calculator className="w-3.5 h-3.5" /> },
    { key: "notes", label: "Notes & Triage", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "history", label: `Audit Log (${historyEvents.length})`, icon: <History className="w-3.5 h-3.5" /> },
  ]

  const handleStatusChange = async (newStatus: FindingStatus) => {
    setStatus(newStatus)
    try {
      await api.updateFinding(findingId, { status: newStatus })
      setHistoryEvents(prev => [
        { action: `Status changed to ${newStatus.toUpperCase()}`, user: "admin", time: new Date().toLocaleTimeString() },
        ...prev
      ])
      toast({ title: "Status updated", description: `Finding marked as ${newStatus} in database.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message })
    }
  }

  const handleSubmitToProgram = async () => {
    try {
      await api.reportFinding(findingId)
      setStatus("submitted")
      setHistoryEvents(prev => [
        { action: `Report dispatched to ${programName}`, user: "admin", time: new Date().toLocaleTimeString() },
        ...prev
      ])
      toast({ title: "Report Submitted", description: `Finding successfully recorded for ${programName}.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Submission failed", description: e.message })
    }
  }

  const handleRunAiTriage = async () => {
    setIsTriaging(true)
    try {
      const res = await api.triageFinding(findingId)
      toast({ title: "AI Triage Completed", description: res.message || "Triage analysis finished." })
      setHistoryEvents(prev => [
        { action: "AI automated triage completed", user: "bountyos-llm", time: new Date().toLocaleTimeString() },
        ...prev
      ])
    } catch (e: any) {
      toast({ variant: "destructive", title: "Triage error", description: e.message || "Failed to run triage." })
    } finally {
      setIsTriaging(false)
    }
  }

  const handleCopyPoc = async () => {
    const pocText = `### Title: ${finding.title}\nHost: ${finding.host}\nURL: ${finding.targetUrl}\nCVSS: ${cvssScore}\n\n### Reproduction Command:\n${finding.curlCommand}\n\n### Request:\n${finding.request}\n\n### Response:\n${finding.response}`
    await navigator.clipboard.writeText(pocText)
    setCopiedPoc(true)
    setTimeout(() => setCopiedPoc(false), 2000)
    toast({ title: "PoC Copied", description: "Reproducible PoC copied to clipboard in markdown format." })
  }

  const handleSaveNotes = async () => {
    try {
      await api.updateFinding(findingId, { description: notesText, cvss_score: cvssScore })
      setHistoryEvents(prev => [
        { action: "Updated triage notes in database", user: "admin", time: new Date().toLocaleTimeString() },
        ...prev
      ])
      toast({ title: "Notes saved", description: "Triage notes updated in database." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e.message })
    }
  }

  const handleApplyCvss = async (score: number) => {
    setCvssScore(score)
    try {
      await api.updateFinding(findingId, { cvss_score: score })
      setHistoryEvents(prev => [
        { action: `CVSS score updated to ${score}`, user: "admin", time: new Date().toLocaleTimeString() },
        ...prev
      ])
      toast({ title: "CVSS Score Applied", description: `Updated score to ${score}.` })
      setActiveTab("details")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to persist CVSS", description: e.message })
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Main Column */}
      <div className="flex-1 space-y-5 min-w-0">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/findings" className="hover:text-text-primary transition-colors">
            Findings
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-primary truncate">{finding.title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-text-primary">
                {finding.title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-critical-muted text-critical border border-critical/30">
                <AlertTriangle className="w-3 h-3" /> {finding.severity}
              </span>
              <span className="badge uppercase tracking-wider bg-primary-muted text-primary text-xs font-semibold">
                {status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted mt-2">
              <span>Program: <strong className="text-text-secondary">{finding.program}</strong></span>
              <span>•</span>
              <span>Assigned: <strong className="text-text-secondary">{assignedHunter}</strong></span>
              <span>•</span>
              <span>Discovered: {finding.foundAt}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleRunAiTriage}
              disabled={isTriaging}
              variant="outline"
              size="sm"
              className="border-accent/40 text-accent hover:bg-accent/10 text-xs gap-1.5"
            >
              {isTriaging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Triage
            </Button>
            <Button
              onClick={handleSubmitToProgram}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary"
              size="sm"
            >
              <Send className="w-3.5 h-3.5" /> Submit to Program
            </Button>
            <Button
              onClick={() => handleStatusChange("fp")}
              variant="outline"
              size="sm"
              className="border-critical/30 text-critical hover:bg-critical-muted text-xs"
            >
              Mark FP
            </Button>
            <Button
              onClick={handleCopyPoc}
              variant="outline"
              size="sm"
              className="text-xs border-border bg-bg-elevated hover:bg-bg-overlay"
              title="Copy Full PoC"
            >
              {copiedPoc ? <Check className="w-3.5 h-3.5 text-low" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-bg-elevated border border-border rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-primary text-white shadow-glow-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Details */}
        {activeTab === "details" && (
          <Card className="bg-bg-elevated border border-border p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Host</label>
                  <p className="text-sm font-mono text-text-primary mt-1 bg-bg-subtle p-2 rounded-lg border border-border">
                    {finding.host}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Target Endpoint</label>
                  <p className="text-xs font-mono text-text-secondary mt-1 break-all bg-bg-subtle p-2 rounded-lg border border-border">
                    {finding.targetUrl}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Discovery Tool</label>
                  <p className="text-xs text-text-secondary mt-1">{finding.tool}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">CVE Reference</label>
                  <p className="text-xs text-text-secondary mt-1">{finding.cveId}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">CVSS v3.1 Base Score</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold text-critical">{cvssScore}</span>
                    <span className="badge bg-critical-muted text-critical text-[10px] uppercase font-bold">Critical</span>
                    <button
                      onClick={() => setActiveTab("cvss")}
                      className="text-xs text-primary hover:underline ml-2 flex items-center gap-1"
                    >
                      <Calculator className="w-3 h-3" /> Recalculate
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Detection Template</label>
                  <p className="text-xs font-mono text-text-secondary mt-1">{finding.template}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Timestamp</label>
                  <p className="text-xs text-text-secondary mt-1">{finding.foundAt}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Current Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(e.target.value as FindingStatus)}
                      className="rounded-lg border border-border bg-bg-subtle px-2.5 py-1 text-xs text-text-primary capitalize font-medium"
                    >
                      <option value="new">New</option>
                      <option value="triaged">Triaged</option>
                      <option value="validated">Validated</option>
                      <option value="submitted">Submitted</option>
                      <option value="fp">False Positive</option>
                      <option value="dup">Duplicate</option>
                      <option value="bounty_awarded">Bounty Awarded</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Vulnerability Overview</label>
              <div className="text-xs text-text-secondary mt-2 leading-relaxed whitespace-pre-line bg-bg-subtle p-3.5 rounded-xl border border-border">
                {finding.description}
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Evidence */}
        {activeTab === "evidence" && (
          <div className="space-y-4">
            <EvidenceViewer
              request={finding.request}
              response={finding.response}
              curlCommand={finding.curlCommand}
            />
          </div>
        )}

        {/* Tab: CVSS Calculator */}
        {activeTab === "cvss" && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-1">CVSS 3.1 Vector & Score Calculator</h3>
            <p className="text-xs text-text-muted mb-4">Adjust vector metrics to determine exact base score and severity classification.</p>
            <CvssCalculator onApply={handleApplyCvss} />
          </div>
        )}

        {/* Tab: Notes */}
        {activeTab === "notes" && (
          <Card className="bg-bg-elevated border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Hunter Notes & Triage Comments</h3>
                <p className="text-xs text-text-muted">Record internal findings, bypass attempts, or reproduction caveats.</p>
              </div>
            </div>
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add reproduction steps, perimeter notes, or communication log..."
              className="min-h-[160px] w-full text-xs font-mono bg-bg-subtle border-border leading-relaxed"
            />
            <div className="flex justify-end mt-4">
              <Button onClick={handleSaveNotes} size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs">
                Save Triage Notes
              </Button>
            </div>
          </Card>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <Card className="bg-bg-elevated border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle border-b border-border text-text-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Triggered By</th>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyEvents.map((e, i) => (
                  <tr key={i} className="hover:bg-bg-overlay/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-text-primary font-medium">{e.action}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{e.user}</td>
                    <td className="px-4 py-3 text-xs text-text-subtle font-mono">{e.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Right Column: Actions & Context */}
      <div className="w-full lg:w-[280px] shrink-0 space-y-4">
        <Card className="bg-bg-elevated border border-border p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              onClick={handleSubmitToProgram}
              className="w-full justify-start text-xs bg-bg-subtle hover:bg-bg-overlay text-text-primary border border-border"
              variant="outline"
              size="sm"
            >
              <Send className="w-3.5 h-3.5 mr-2 text-primary" /> Submit Report
            </Button>
            <Button
              onClick={handleCopyPoc}
              className="w-full justify-start text-xs bg-bg-subtle hover:bg-bg-overlay text-text-primary border border-border"
              variant="outline"
              size="sm"
            >
              <Download className="w-3.5 h-3.5 mr-2 text-accent" /> Export PoC Markdown
            </Button>
            <Button
              onClick={() => router.push(`/programs/${finding.programId}`)}
              className="w-full justify-start text-xs bg-bg-subtle hover:bg-bg-overlay text-text-primary border border-border"
              variant="outline"
              size="sm"
            >
              <Shield className="w-3.5 h-3.5 mr-2 text-low" /> View Program Assets
            </Button>
            <a
              href={finding.targetUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full"
            >
              <Button
                className="w-full justify-start text-xs bg-bg-subtle hover:bg-bg-overlay text-text-primary border border-border mt-2"
                variant="outline"
                size="sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2 text-medium" /> Open Target URL
              </Button>
            </a>
          </div>
        </Card>

        <Card className="bg-bg-elevated border border-border p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Program Context</h3>
          <div className="space-y-2 text-xs divide-y divide-border/40">
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Platform</span>
              <span className="text-text-primary font-medium">HackerOne</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Bounty Range</span>
              <span className="text-text-secondary font-mono">$500 - $30,000</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Target Scope</span>
              <span className="text-text-secondary font-mono">*.uber.com</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Triage SLA</span>
              <span className="text-low font-medium">Within 24 hours</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

