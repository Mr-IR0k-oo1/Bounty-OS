"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Sparkles, RefreshCw, CheckCircle2, ShieldAlert, Cpu, 
  ArrowRight, Activity, Globe, Bug, ChevronRight, Layers, HelpCircle, AlertTriangle
} from "lucide-react"

interface AdaptivePlannerPanelProps {
  programId: string
  programName: string
}

export function AdaptivePlannerPanel({ programId, programName }: AdaptivePlannerPanelProps) {
  const [loading, setLoading] = useState(true)
  const [replanning, setReplanning] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showRejected, setShowRejected] = useState(false)

  const fetchPlan = async () => {
    try {
      const res = await fetch(`/api/investigations/${programId}/adaptive-plan`)
      if (res.ok) {
        const data = await res.json()
        setPlan(data)
      }
    } catch (e) {
      console.error("Failed to fetch adaptive plan", e)
    } finally {
      setLoading(false)
      setReplanning(false)
    }
  }

  useEffect(() => {
    fetchPlan()
  }, [programId])

  const handleReplan = async () => {
    setReplanning(true)
    try {
      const res = await fetch(`/api/investigations/${programId}/replan`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setPlan(data)
      }
    } catch (e) {
      console.error("Failed to replan", e)
    } finally {
      setReplanning(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 bg-bg-card border-border flex items-center justify-center min-h-[220px]">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          <span>Evaluating state preconditions & computing adaptive plan...</span>
        </div>
      </Card>
    )
  }

  const selected = plan?.selected_action
  const metrics = plan?.state_metrics
  const components = selected?.score_components

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-elevated/40 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-glow-primary/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              Adaptive Investigation Planner
              <span className="badge bg-primary-muted text-primary text-[10px] font-semibold uppercase">
                Deterministic Engine
              </span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Target Archetype: <span className="font-semibold text-text-secondary uppercase">{plan?.target_archetype || "Unknown"}</span> • Real-time precondition & score evaluation
            </p>
          </div>
        </div>

        <Button
          onClick={handleReplan}
          disabled={replanning}
          size="sm"
          className="rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary gap-1.5 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${replanning ? "animate-spin" : ""}`} />
          {replanning ? "Re-evaluating..." : "Replan Now"}
        </Button>
      </div>

      {/* CURRENT STATE GRID */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" /> Current Attack Surface State
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Assets / Hosts</span>
            <div className="text-xl font-bold text-text-primary mt-1">
              {(metrics?.subdomains_count ?? 0) + (metrics?.services_count > 0 ? 1 : 0)}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">Discovered hosts</div>
          </div>

          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Services</span>
            <div className="text-xl font-bold text-accent mt-1">
              {metrics?.services_count ?? 0}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">Open network ports</div>
          </div>

          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Endpoints</span>
            <div className="text-xl font-bold text-primary mt-1">
              {metrics?.endpoints_count ?? 0}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">HTTP routes & URLs</div>
          </div>

          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Parameters</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {metrics?.parameters_count ?? 0}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">Input surfaces</div>
          </div>

          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Findings</span>
            <div className="text-xl font-bold text-medium mt-1">
              {metrics?.findings_count ?? 0}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">Observed candidates</div>
          </div>

          <div className="card p-3 bg-bg-card border-border hover:border-border-hover transition-colors">
            <span className="text-[10px] uppercase font-bold text-text-muted">Confirmed</span>
            <div className="text-xl font-bold text-high mt-1">
              {plan?.selected_action?.capability === "verify_finding" ? "In Progress" : "Verified"}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">Deterministic proof</div>
          </div>
        </div>
      </div>

      {/* NEXT ACTION HERO CARD */}
      {selected ? (
        <Card className="p-5 bg-gradient-to-br from-bg-card to-bg-elevated/60 border-primary/30 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Recommended Next Action
                </span>
                <span className="badge bg-bg-overlay border border-border text-[10px] font-medium text-text-secondary">
                  Tool: <strong className="text-text-primary ml-1">{selected.tool}</strong>
                </span>
                <span className="badge bg-bg-overlay border border-border text-[10px] font-medium text-text-secondary">
                  Cost: <strong className="text-text-primary ml-1">{selected.estimated_cost}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                {selected.capability.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </h2>
              <div className="text-xs text-text-muted font-mono mt-0.5">
                Target: <span className="text-text-secondary">{selected.target}</span>
              </div>
            </div>

            {/* Score Ring */}
            <div className="flex items-center gap-3 bg-bg-base/80 px-4 py-2.5 rounded-2xl border border-border/80">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                  Adaptive Score
                </div>
                <div className="text-2xl font-black text-primary tracking-tight">
                  {selected.score}
                  <span className="text-xs text-text-muted font-normal ml-0.5">/100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Why Section */}
          <div className="bg-bg-base/60 rounded-xl p-3.5 border border-border/60 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              Why This Action Is Recommended
            </div>
            <p className="text-xs text-text-primary leading-relaxed font-medium">
              {selected.reason}
            </p>
          </div>

          {/* Expected State & Outcomes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
            <div className="p-3 bg-bg-base/40 rounded-xl border border-border/40">
              <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">
                Prerequisites Satisfied
              </span>
              <span className="text-text-secondary flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {selected.required_state}
              </span>
            </div>

            <div className="p-3 bg-bg-base/40 rounded-xl border border-border/40">
              <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">
                Expected State Produced
              </span>
              <span className="text-text-secondary flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                {selected.produced_state}
              </span>
            </div>
          </div>

          {/* Explainable Score Components Toggle */}
          {components && (
            <div>
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {showBreakdown ? "Hide explainable score components" : "Inspect explainable score breakdown"}
                <ChevronRight className={`w-3 h-3 transition-transform ${showBreakdown ? "rotate-90" : ""}`} />
              </button>

              {showBreakdown && (
                <div className="mt-3 p-3.5 bg-bg-base/90 rounded-xl border border-border grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs animate-in fade-in">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Info Gain</span>
                    <div className="font-bold text-emerald-400">+{components.information_gain} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Finding Potential</span>
                    <div className="font-bold text-accent">+{components.finding_potential} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Target Relevance</span>
                    <div className="font-bold text-primary">+{components.target_relevance} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Evidence Complete</span>
                    <div className="font-bold text-text-primary">+{components.evidence_completeness} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Cost Deduction</span>
                    <div className="font-bold text-medium">-{components.execution_cost} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Risk Penalty</span>
                    <div className="font-bold text-high">-{components.risk_penalty} pts</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Redundancy Penalty</span>
                    <div className="font-bold text-high">-{components.redundancy_penalty} pts</div>
                  </div>
                  {components.advisory_llm_bonus > 0 && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">Advisory LLM Bonus</span>
                      <div className="font-bold text-accent">+{components.advisory_llm_bonus} pts</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 bg-bg-card border-border text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-text-primary">Investigation Complete or Stopped</h3>
          <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            {plan?.stop_reason || plan?.reason || "All eligible attack surfaces have been evaluated within authorized scope and budget."}
          </p>
        </Card>
      )}

      {/* TOP ALTERNATIVES */}
      {plan?.alternatives && plan.alternatives.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Top Alternative Candidate Actions ({plan.alternatives.length})
          </div>
          <div className="space-y-2">
            {plan.alternatives.map((alt: any, idx: number) => (
              <div
                key={alt.action_id || idx}
                className="p-3 bg-bg-card/70 hover:bg-bg-elevated border border-border rounded-xl flex items-center justify-between gap-4 transition-colors text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-text-primary">
                      {alt.capability.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                    <span className="badge bg-bg-overlay border border-border text-[9px] text-text-muted">
                      {alt.tool}
                    </span>
                    <span className="text-text-muted text-[11px] truncate">
                      {alt.target}
                    </span>
                  </div>
                  <div className="text-text-secondary text-[11px] truncate">
                    {alt.reason}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-primary text-sm">{alt.score} pts</div>
                  <div className="text-[9px] text-text-muted uppercase">Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REJECTED / PRECONDITION-FILTERED ACTIONS */}
      {plan?.rejected_candidates && plan.rejected_candidates.length > 0 && (
        <div>
          <button
            onClick={() => setShowRejected(!showRejected)}
            className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-medium" />
            <span>Precondition-Filtered Actions ({plan.rejected_candidates.length})</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showRejected ? "rotate-90" : ""}`} />
          </button>

          {showRejected && (
            <div className="mt-2.5 space-y-1.5 max-h-60 overflow-y-auto p-2 bg-bg-base/50 rounded-xl border border-border/60">
              {plan.rejected_candidates.map((rej: any, idx: number) => (
                <div key={idx} className="p-2 bg-bg-card rounded-lg border border-border/40 text-[11px] flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-text-secondary uppercase text-[10px]">
                      {rej.capability}
                    </span>
                    <div className="text-text-muted">{rej.reason}</div>
                  </div>
                  <span className="badge bg-medium/10 text-medium text-[9px] shrink-0">
                    Missing: {rej.missing_prerequisite}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
