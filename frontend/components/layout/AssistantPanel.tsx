"use client"

import { useState, useCallback, useEffect } from "react"
import {
  PanelRightClose,
  FileText,
  Target,
  AlertTriangle,
  Braces,
  Wrench,
  Search,
  Download,
  ChevronDown,
  Copy,
  Save,
  Sparkles,
  Brain,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TriageBadge } from "@/components/findings/TriageBadge"

// ---------------------------------------------------------------------------
// Report builder actions
// ---------------------------------------------------------------------------

const actions = [
  { icon: FileText,      label: "Draft Full Report",       primary: true, desc: "Generate a complete security report" },
  { icon: Target,        label: "Write Impact Statement",  desc: "Describe business impact and risk" },
  { icon: AlertTriangle, label: "Reproduction Steps",      desc: "Step-by-step PoC walkthrough" },
  { icon: Braces,        label: "CVSS Calculator",         desc: "Calculate severity score" },
  { icon: Wrench,        label: "Remediation Suggestion",  desc: "How to fix the vulnerability" },
  { icon: Search,        label: "Similar in DB",           desc: "Find similar past findings" },
  { icon: Download,      label: "Export for Platform",     desc: "Format for H1, Bugcrowd, etc." },
]

const platforms = ["HackerOne", "Bugcrowd", "Intigriti", "Synack", "Generic"]

// ---------------------------------------------------------------------------
// Triage state types
// ---------------------------------------------------------------------------

type TriageStatus = "idle" | "loading" | "done" | "error"

interface TriageResult {
  finding_type: string
  confidence: number
  severity: string
  evidence_used: string[]
  reasoning_summary: string
  missing_evidence: string[]
  recommended_manual_verification: string[]
  escalate: boolean
}

interface TriageData {
  triage: TriageResult
  confidence: number
  triaged_at: string
}

// ---------------------------------------------------------------------------
// Panel tabs
// ---------------------------------------------------------------------------

type PanelTab = "report" | "triage"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssistantPanel({
  findingId,
  onClose,
}: {
  findingId?: string
  onClose?: () => void
}) {
  const [selectedPlatform, setSelectedPlatform] = useState(0)
  const [platformOpen, setPlatformOpen]         = useState(false)
  const [activeAction, setActiveAction]         = useState<number | null>(null)
  const [activeTab, setActiveTab]               = useState<PanelTab>("report")

  // Triage state
  const [triageStatus, setTriageStatus]   = useState<TriageStatus>("idle")
  const [triageData, setTriageData]       = useState<TriageData | null>(null)
  const [triageError, setTriageError]     = useState<string | null>(null)
  const [checkedSteps, setCheckedSteps]   = useState<Set<number>>(new Set())

  // ---------------------------------------------------------------------------
  // Fetch existing triage result on mount / when findingId changes
  // ---------------------------------------------------------------------------

  const fetchTriage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/findings/${id}/triage`)
      if (res.status === 404) return // Not yet triaged — silent
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: TriageData = await res.json()
      setTriageData(data)
      setTriageStatus("done")
    } catch (e) {
      // Silently ignore — we'll show the "run" button instead
    }
  }, [])

  useEffect(() => {
    if (findingId) {
      setTriageData(null)
      setTriageStatus("idle")
      setTriageError(null)
      setCheckedSteps(new Set())
      fetchTriage(findingId)
    }
  }, [findingId, fetchTriage])

  // ---------------------------------------------------------------------------
  // Trigger triage then poll for result
  // ---------------------------------------------------------------------------

  const runTriage = useCallback(async () => {
    if (!findingId) return
    setTriageStatus("loading")
    setTriageError(null)

    try {
      const triggerRes = await fetch(`/api/findings/${findingId}/triage`, { method: "POST" })
      if (!triggerRes.ok) {
        const body = await triggerRes.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${triggerRes.status}`)
      }

      // Poll every 5s until triage is available (max 150s = 30 polls)
      let polls = 0
      const poll = async () => {
        if (polls >= 30) {
          setTriageStatus("error")
          setTriageError("Triage timed out after 150s. The model may still be running.")
          return
        }
        polls++

        const res = await fetch(`/api/findings/${findingId}/triage`)
        if (res.status === 404) {
          setTimeout(poll, 5000)
          return
        }
        if (!res.ok) {
          setTriageStatus("error")
          setTriageError(`Polling error: HTTP ${res.status}`)
          return
        }
        const data: TriageData = await res.json()
        setTriageData(data)
        setTriageStatus("done")
      }

      setTimeout(poll, 5000)
    } catch (e: unknown) {
      setTriageStatus("error")
      setTriageError(e instanceof Error ? e.message : "Unknown error")
    }
  }, [findingId])

  const toggleStep = (i: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-text-primary">Assistant</span>
          <span className="text-[10px] text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded-full">context-aware</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(["report", "triage"] as PanelTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-fast",
              activeTab === tab
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab === "report" ? <FileText className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
            {tab === "report" ? "Report Builder" : "AI Triage"}
            {tab === "triage" && triageStatus === "done" && (
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
            )}
            {tab === "triage" && triageStatus === "loading" && (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

        {/* ------------------------------------------------------------------ */}
        {/* REPORT BUILDER TAB                                                  */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "report" && (
          <>
            <div>
              <div className="text-xs text-text-muted font-medium mb-1">Report Builder</div>
              <div className="text-xs text-text-secondary mb-3 leading-relaxed">
                Select a finding to generate platform-specific reports, impact statements, and remediation guides.
              </div>

              {/* Platform Selector */}
              <div className="relative mb-3">
                <button
                  onClick={() => setPlatformOpen(!platformOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border bg-bg-overlay text-sm text-text-primary hover:border-primary/30 transition-fast"
                >
                  {platforms[selectedPlatform]}
                  <ChevronDown className={cn("w-3.5 h-3.5 text-text-muted transition-transform duration-200", platformOpen && "rotate-180")} />
                </button>
                {platformOpen && (
                  <div className="absolute top-full mt-1 w-full rounded-lg border border-border bg-bg-elevated shadow-lg py-1 z-10 animate-in fade-in slide-in-from-top-1 duration-150">
                    {platforms.map((p, i) => (
                      <button
                        key={p}
                        onClick={() => { setSelectedPlatform(i); setPlatformOpen(false) }}
                        className={cn(
                          "w-full px-3 py-1.5 text-sm text-left hover:bg-bg-overlay transition-fast",
                          i === selectedPlatform ? "text-primary font-medium" : "text-text-secondary"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5">
                {actions.map((action, i) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.label}
                      onClick={() => setActiveAction(activeAction === i ? null : i)}
                      className={cn(
                        "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                        activeAction === i
                          ? "bg-primary-muted text-primary border border-primary/30"
                          : action.primary
                            ? "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
                            : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary border border-transparent"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div>{action.label}</div>
                        {activeAction === i && (
                          <div className="text-[10px] text-text-muted mt-0.5">{action.desc}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Output Area */}
            <div className="rounded-lg border border-border bg-bg-base overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-subtle/50">
                <span className="text-xs font-medium text-text-muted">Output</span>
                <div className="flex items-center gap-0.5">
                  <button className="p-1 rounded text-text-subtle hover:text-text-muted hover:bg-bg-overlay transition-fast" title="Copy">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1 rounded text-text-subtle hover:text-text-muted hover:bg-bg-overlay transition-fast" title="Save">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-3 py-3 text-xs text-text-muted leading-relaxed min-h-[100px] font-mono">
                {activeAction !== null ? (
                  <span className="text-text-secondary animate-in fade-in duration-200">
                    Generating {actions[activeAction].label.toLowerCase()} for {platforms[selectedPlatform]}...
                  </span>
                ) : (
                  <span className="text-text-subtle italic">
                    Select a template action above to generate content...
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* AI TRIAGE TAB                                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "triage" && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-text-muted font-medium mb-1">VulnLLM-R-7B Triage</div>
              <div className="text-xs text-text-secondary leading-relaxed">
                Locally-inferred vulnerability classification, confidence scoring, and manual verification guidance.
                The model reads evidence already on disk — no network access during inference.
              </div>
            </div>

            {/* ---- IDLE: show run button ---- */}
            {triageStatus === "idle" && (
              <button
                onClick={runTriage}
                disabled={!findingId}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-all duration-150",
                  findingId
                    ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15 hover:border-primary/50"
                    : "bg-bg-overlay text-text-subtle border-border cursor-not-allowed"
                )}
              >
                <Brain className="w-4 h-4" />
                {findingId ? "Run AI Triage" : "Select a finding to triage"}
              </button>
            )}

            {/* ---- LOADING ---- */}
            {triageStatus === "loading" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-text-primary">Triage in progress</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      VulnLLM-R-7B is analysing evidence... this may take 60–120s on CPU.
                    </div>
                  </div>
                </div>
                {/* Animated progress bar */}
                <div className="h-1 rounded-full bg-bg-overlay overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              </div>
            )}

            {/* ---- ERROR ---- */}
            {triageStatus === "error" && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-danger">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Triage failed</span>
                </div>
                <p className="text-xs text-text-muted pl-6 leading-relaxed">{triageError}</p>
                <button
                  onClick={runTriage}
                  className="ml-6 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-fast"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            )}

            {/* ---- DONE: show results ---- */}
            {triageStatus === "done" && triageData && (
              <div className="space-y-3 animate-in fade-in duration-300">
                {/* Classification + confidence badge */}
                <TriageBadge
                  findingType={triageData.triage.finding_type}
                  confidence={triageData.triage.confidence}
                  severity={triageData.triage.severity}
                />

                {/* Escalate callout */}
                {triageData.triage.escalate && (
                  <div className="flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                    <p className="text-xs text-danger font-medium leading-relaxed">
                      High-confidence critical/high finding — immediate review recommended.
                    </p>
                  </div>
                )}

                {/* Reasoning */}
                <div className="rounded-lg border border-border bg-bg-base p-3 space-y-1">
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Reasoning</div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {triageData.triage.reasoning_summary}
                  </p>
                </div>

                {/* Evidence used */}
                {triageData.triage.evidence_used.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Evidence Used</div>
                    <div className="flex flex-wrap gap-1">
                      {triageData.triage.evidence_used.map((ev, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-bg-overlay border border-border text-text-muted"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual verification checklist */}
                {triageData.triage.recommended_manual_verification.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                      Manual Verification Steps
                    </div>
                    <div className="space-y-1">
                      {triageData.triage.recommended_manual_verification.map((step, i) => (
                        <button
                          key={i}
                          onClick={() => toggleStep(i)}
                          className="flex items-start gap-2 w-full text-left group"
                        >
                          {checkedSteps.has(i)
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            : <Circle className="w-3.5 h-3.5 text-text-subtle shrink-0 mt-0.5 group-hover:text-text-muted transition-fast" />
                          }
                          <span className={cn(
                            "text-xs leading-relaxed transition-fast",
                            checkedSteps.has(i) ? "line-through text-text-subtle" : "text-text-secondary"
                          )}>
                            {step}
                          </span>
                        </button>
                      ))}
                    </div>
                    {checkedSteps.size > 0 && (
                      <div className="text-[10px] text-text-muted">
                        {checkedSteps.size}/{triageData.triage.recommended_manual_verification.length} steps completed
                      </div>
                    )}
                  </div>
                )}

                {/* Missing evidence */}
                {triageData.triage.missing_evidence.length > 0 && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-warning text-[10px] font-semibold uppercase tracking-wide">
                      <AlertCircle className="w-3 h-3" />
                      Evidence Gaps
                    </div>
                    <ul className="space-y-1">
                      {triageData.triage.missing_evidence.map((gap, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                          <span className="text-xs text-text-secondary leading-relaxed">{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Re-triage + timestamp */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-text-subtle">
                    {triageData.triaged_at
                      ? `Triaged ${new Date(triageData.triaged_at).toLocaleString()}`
                      : ""}
                  </span>
                  <button
                    onClick={runTriage}
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-fast"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-triage
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Context */}
      <div className="p-3 border-t border-border shrink-0 bg-bg-base/50">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1.5">
            {["#f85149", "#e8912d", "#58a6ff", "#3fb950"].map((color, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2 border-bg-elevated"
                style={{ background: color }}
              />
            ))}
          </div>
          <div>
            <div className="text-xs text-text-muted">
              <span className="font-medium text-text-primary">4</span> findings selected
            </div>
            <div className="text-[10px] text-text-subtle">Uber, Airbnb, Twitter + 1</div>
          </div>
        </div>
      </div>
    </div>
  )
}
