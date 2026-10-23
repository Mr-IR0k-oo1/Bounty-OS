"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Compass, ShieldAlert, Cpu, Sparkles, Play, CheckCircle2, 
  AlertTriangle, RefreshCw, Server, Globe, Lock, Code2, Zap, Send
} from "lucide-react"


interface IntelligenceLearningTabProps {
  programId: string
  programName: string
}

export function IntelligenceLearningTab({ programId, programName }: IntelligenceLearningTabProps) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [lesson, setLesson] = useState<any>(null)
  const [threats, setThreats] = useState<any[]>([])
  const [prioritization, setPrioritization] = useState<any>(null)
  
  // Behavior analyzer state
  const [probeUrl, setProbeUrl] = useState("")
  const [probeLoading, setProbeLoading] = useState(false)
  const [behaviorReport, setBehaviorReport] = useState<any>(null)

  // Request flow repeater state
  const [flowTarget, setFlowTarget] = useState("")
  const [flowMethod, setFlowMethod] = useState("GET")
  const [dryRun, setDryRun] = useState(false)
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayResult, setReplayResult] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [profRes, eduRes, threatRes, prioRes] = await Promise.all([
        fetch(`/api/investigations/${programId}/profile`).then(r => r.ok ? r.json() : null),
        fetch(`/api/investigations/${programId}/education`).then(r => r.ok ? r.json() : null),
        fetch(`/api/investigations/${programId}/threats`).then(r => r.ok ? r.json() : []),
        fetch(`/api/investigations/${programId}/prioritization`).then(r => r.ok ? r.json() : null),
      ])
      setProfile(profRes)
      setLesson(eduRes)
      setThreats(threatRes || [])
      setPrioritization(prioRes)
      if (profRes && !probeUrl) {
        setProbeUrl(`http://${programName}`)
        setFlowTarget(`http://${programName}/api`)
      }
    } catch (e) {
      console.error("Failed to load intelligence state", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [programId])

  const handleAnalyzeBehavior = async () => {
    if (!probeUrl) return
    setProbeLoading(true)
    try {
      const res = await fetch(`/api/investigations/${programId}/behavior`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: probeUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        setBehaviorReport(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setProbeLoading(false)
    }
  }

  const handleReplayFlow = async () => {
    if (!flowTarget) return
    setReplayLoading(true)
    try {
      const res = await fetch(`/api/investigations/${programId}/flows/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: {
            id: "00000000-0000-0000-0000-000000000000",
            name: "Manual Probe Flow",
            target_url: flowTarget,
            method: flowMethod,
            headers: { "X-BountyOS-Flow": "1" },
            mutations: [],
          },
          dry_run: dryRun,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReplayResult(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setReplayLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        <span>Synthesizing Target Profile & STRIDE Threat Intelligence...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Target Profile Banner */}
      <div className="card p-5 bg-card/60 backdrop-blur border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-primary">Target Attack Surface Profile</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                  {profile?.archetype || "Generic Web Application"}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Deterministic profile synthesized from empirical network evidence and server responses.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Intelligence
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-border/50 text-xs">
          <div>
            <span className="text-text-muted block text-[11px]">Archetype Confidence</span>
            <span className="font-semibold text-text-primary text-sm">
              {Math.round((profile?.confidence || 0.85) * 100)}%
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Authentication State</span>
            <span className="font-semibold text-text-primary text-sm capitalize">
              {profile?.authentication_state || "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">API Indicators</span>
            <span className="font-semibold text-text-primary text-sm">
              {profile?.api_indicators ? "Detected (JSON/REST)" : "None"}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Application Architecture</span>
            <span className="font-semibold text-text-primary text-sm capitalize">
              {profile?.javascript_heavy ? "Client-Side SPA" : "Server Rendered"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. "Help Me Learn" Pedagogical Layer */}
      {lesson && (
        <div className="card p-5 border-l-4 border-l-amber-500 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Help Me Learn — Investigation Stage: {lesson.stage}
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs font-semibold text-text-primary block">Recommended Next Investigation:</span>
              <p className="text-xs text-amber-200/90 font-medium">{lesson.recommended_action}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-text-muted block">Rationale:</span>
              <p className="text-xs text-text-muted">{lesson.reason}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-text-muted block">Required Technical Evidence:</span>
              <code className="text-[11px] bg-background/80 px-2 py-1 rounded block text-text-secondary border border-border/60">
                {lesson.evidence_requirements}
              </code>
            </div>
            <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-400">
              <span className="font-semibold">Learning Objective: </span>
              {lesson.learning_objective}
            </div>
          </div>
        </div>
      )}

      {/* 3. STRIDE Threat Model & Target Prioritization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* STRIDE Threats (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              STRIDE Threat Model ({threats.length})
            </h4>
            <span className="text-[11px] text-text-muted">Observed • Inferred • Hypothesized • Verified</span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {threats.length === 0 ? (
              <div className="card p-6 text-center text-xs text-text-muted">
                No active threats modeled yet. Run reconnaissance to populate attack surface graph.
              </div>
            ) : (
              threats.map((t, idx) => (
                <div key={idx} className="card p-4 hover:border-border transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-text-primary">{t.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {t.stride}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.status === "Verified" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        t.status === "Observed" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">{t.description}</p>
                  {t.mitigation && (
                    <div className="text-[11px] text-text-secondary bg-background/50 px-2 py-1 rounded border border-border/40">
                      <span className="text-text-muted font-medium">Mitigation: </span>
                      {t.mitigation}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Target Prioritization (1 col) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            ROI Prioritization Score
          </h4>

          {prioritization && (
            <div className="card p-5 space-y-4">
              <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                <span className="text-xs text-text-muted">Calculated Priority</span>
                <span className="text-2xl font-black text-accent">{prioritization.total_priority_score}</span>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-semibold text-text-muted block">Score Formula Breakdown:</span>
                {prioritization.explanations?.map((exp: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-text-secondary">
                    <span className="text-accent">•</span>
                    <span>{exp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Request Flow Repeater & Behavioral Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border/60">
        {/* WAF & Behavior Analyzer */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Observable Behavior & WAF Detection
            </h4>
          </div>
          <div className="flex gap-2">
            <Input 
              value={probeUrl}
              onChange={(e) => setProbeUrl(e.target.value)}
              placeholder="http://target.com"
              className="text-xs font-mono"
            />
            <Button size="sm" onClick={handleAnalyzeBehavior} disabled={probeLoading} className="gap-2 shrink-0 text-xs">
              {probeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Analyze
            </Button>
          </div>

          {behaviorReport && (
            <div className="bg-background/80 p-3 rounded-lg border border-border/70 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Detected WAF:</span>
                <span className="font-semibold text-text-primary">
                  {behaviorReport.waf_vendor ? JSON.stringify(behaviorReport.waf_vendor) : "None (Direct Origin)"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Baseline Status & Latency:</span>
                <span className="font-mono text-text-secondary">
                  HTTP {behaviorReport.baseline_status} ({behaviorReport.baseline_latency_ms}ms)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Rate Limiting Triggered:</span>
                <span className={behaviorReport.rate_limit_detected ? "text-critical font-bold" : "text-emerald-400"}>
                  {behaviorReport.rate_limit_detected ? "429 Too Many Requests" : "Unthrottled"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Request Repeater */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              Controlled Request Flow Repeater
            </h4>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input 
                type="checkbox" 
                checked={dryRun} 
                onChange={(e) => setDryRun(e.target.checked)} 
                className="rounded border-border"
              />
              Dry-run Mode
            </label>
          </div>
          <div className="flex gap-2">
            <select
              value={flowMethod}
              onChange={(e) => setFlowMethod(e.target.value)}
              className="bg-background border border-border text-xs rounded px-2 text-text-primary font-mono"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
            <Input 
              value={flowTarget}
              onChange={(e) => setFlowTarget(e.target.value)}
              placeholder="http://target.com/api"
              className="text-xs font-mono"
            />
            <Button size="sm" onClick={handleReplayFlow} disabled={replayLoading} className="gap-2 shrink-0 text-xs">
              {replayLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Replay
            </Button>
          </div>

          {replayResult && (
            <div className="bg-background/80 p-3 rounded-lg border border-border/70 text-xs font-mono space-y-1 max-h-36 overflow-y-auto">
              <div className="text-text-muted">
                Status: <span className="text-emerald-400 font-bold">{replayResult.status_code || "Dry Run"}</span> ({replayResult.duration_ms}ms)
              </div>
              {replayResult.response_body_snippet && (
                <div className="text-[11px] text-text-secondary truncate">
                  {replayResult.response_body_snippet}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
