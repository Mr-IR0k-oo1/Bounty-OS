"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Network, Cpu, Compass, ShieldAlert, Sparkles, Database,
  RefreshCw, Globe, Server, Link2, Code, Bug, CheckCircle2,
  AlertTriangle, ArrowRight, Play, Send, Zap, Activity,
  Layers, Lock, ShieldCheck, Terminal, Filter, Search, ChevronRight
} from "lucide-react"
import { api } from "@/lib/api"
import { AttackSurfaceGraphPanel } from "@/components/programs/AttackSurfaceGraphPanel"
import { AdaptivePlannerPanel } from "@/components/programs/AdaptivePlannerPanel"

function IntelligenceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programIdParam = searchParams.get("program")

  const [programs, setPrograms] = useState<any[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const [selectedProgram, setSelectedProgram] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<"graph" | "planner" | "archetype" | "experience" | "lab">("graph")

  // Archetype & Policy State
  const [archetype, setArchetype] = useState<any>(null)
  const [policyData, setPolicyData] = useState<any>(null)
  const [lesson, setLesson] = useState<any>(null)

  // Experience Priors State
  const [experienceActions, setExperienceActions] = useState<any[]>([])
  const [provenanceAudit, setProvenanceAudit] = useState<any[]>([])
  const [experienceLoading, setExperienceLoading] = useState<boolean>(false)
  const [toolFilter, setToolFilter] = useState<string>("")

  // Security Lab State
  const [threats, setThreats] = useState<any[]>([])
  const [prioritization, setPrioritization] = useState<any>(null)
  
  // Lab: Behavior Analyzer
  const [probeUrl, setProbeUrl] = useState<string>("")
  const [probeLoading, setProbeLoading] = useState<boolean>(false)
  const [behaviorReport, setBehaviorReport] = useState<any>(null)

  // Lab: Request Flow Repeater
  const [flowTarget, setFlowTarget] = useState<string>("")
  const [flowMethod, setFlowMethod] = useState<string>("GET")
  const [dryRun, setDryRun] = useState<boolean>(false)
  const [replayLoading, setReplayLoading] = useState<boolean>(false)
  const [replayResult, setReplayResult] = useState<any>(null)

  // Lab: BOLA Authz Tester
  const [authzEndpoint, setAuthzEndpoint] = useState<string>("")
  const [resourceId, setResourceId] = useState<string>("order_9482")
  const [authzRole, setAuthzRole] = useState<string>("unprivileged_user")
  const [authzLoading, setAuthzLoading] = useState<boolean>(false)
  const [authzResult, setAuthzResult] = useState<any>(null)

  // System Health
  const [systemHealth, setSystemHealth] = useState<any>(null)

  // 1. Initial Load of Programs
  useEffect(() => {
    async function loadPrograms() {
      try {
        const progs = await api.listPrograms()
        setPrograms(progs || [])
        if (progs && progs.length > 0) {
          const initialId = programIdParam && progs.some((p: any) => p.id === programIdParam)
            ? programIdParam
            : progs[0].id
          setSelectedProgramId(initialId)
          setSelectedProgram(progs.find((p: any) => p.id === initialId) || progs[0])
        }
      } catch (e) {
        console.error("Failed to load programs:", e)
      } finally {
        setLoading(false)
      }
    }
    loadPrograms()
  }, [programIdParam])

  // 2. Fetch Investigation Data when Selected Program Changes
  const fetchProgramData = useCallback(async (progId: string) => {
    if (!progId) return
    try {
      const [arch, pol, edu, thrt, prio, hlth] = await Promise.all([
        api.getInvestigationArchetype(progId).catch(() => null),
        api.getInvestigationPolicy(progId).catch(() => null),
        api.getEducation(progId).catch(() => null),
        api.getThreats(progId).catch(() => []),
        api.getPrioritization(progId).catch(() => null),
        api.getSystemHealth().catch(() => null),
      ])

      setArchetype(arch)
      setPolicyData(pol)
      setLesson(edu)
      setThreats(thrt || [])
      setPrioritization(prio)
      setSystemHealth(hlth)

      const prog = programs.find((p: any) => p.id === progId)
      if (prog) {
        setSelectedProgram(prog)
        if (!probeUrl) {
          setProbeUrl(`http://${prog.name || "target.local"}`)
          setFlowTarget(`http://${prog.name || "target.local"}/api/v1/user`)
          setAuthzEndpoint(`http://${prog.name || "target.local"}/api/v1/orders/{id}`)
        }
      }
    } catch (e) {
      console.error("Error loading program intelligence data:", e)
    }
  }, [programs, probeUrl])

  // 3. Fetch Global Experience Priors & Provenance
  const fetchExperienceData = useCallback(async () => {
    try {
      setExperienceLoading(true)
      const [actions, prov] = await Promise.all([
        api.getExperienceActions().catch(() => []),
        api.getExperienceProvenance().catch(() => []),
      ])
      setExperienceActions(actions || [])
      setProvenanceAudit(prov || [])
    } catch (e) {
      console.error("Failed to fetch experience data:", e)
    } finally {
      setExperienceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProgramId) {
      fetchProgramData(selectedProgramId)
    }
  }, [selectedProgramId, fetchProgramData])

  useEffect(() => {
    if (activeTab === "experience") {
      fetchExperienceData()
    }
  }, [activeTab, fetchExperienceData])

  const handleProgramChange = (newId: string) => {
    setSelectedProgramId(newId)
    const prog = programs.find((p: any) => p.id === newId)
    setSelectedProgram(prog)
    const url = new URL(window.location.href)
    url.searchParams.set("program", newId)
    router.replace(url.toString())
  }

  // Interactive Lab Handlers
  const handleAnalyzeBehavior = async () => {
    if (!probeUrl || !selectedProgramId) return
    setProbeLoading(true)
    try {
      const data = await api.analyzeBehavior(selectedProgramId, probeUrl, 5)
      setBehaviorReport(data)
    } catch (err: any) {
      console.error("Behavior probe failed:", err)
    } finally {
      setProbeLoading(false)
    }
  }

  const handleReplayFlow = async () => {
    if (!flowTarget || !selectedProgramId) return
    setReplayLoading(true)
    try {
      const data = await api.replayFlow(
        selectedProgramId,
        {
          id: "00000000-0000-0000-0000-000000000000",
          name: "Interactive Flow Probe",
          target_url: flowTarget,
          method: flowMethod,
          headers: { "X-BountyOS-Lab": "Interactive" },
          mutations: [],
        },
        dryRun
      )
      setReplayResult(data)
    } catch (err: any) {
      console.error("Flow replay failed:", err)
    } finally {
      setReplayLoading(false)
    }
  }

  const handleTestAuthz = async () => {
    if (!authzEndpoint || !selectedProgramId) return
    setAuthzLoading(true)
    try {
      const data = await api.testAuthz(
        selectedProgramId,
        authzEndpoint,
        [
          { role: "admin", token: "bearer_admin_token", allowed: true },
          { role: authzRole, token: `bearer_${authzRole}_token`, allowed: false },
        ],
        "GET"
      )
      setAuthzResult(data)
    } catch (err: any) {
      console.error("BOLA test failed:", err)
    } finally {
      setAuthzLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
        <span className="text-xs font-mono">Initializing Autonomous Intelligence Systems...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Program Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Intelligence & Attack Surface Console
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              v0.7 Full Stack
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Autonomous decision engine, relational attack surface graph, empirical priors, and interactive security laboratory.
          </p>
        </div>

        {/* Program Switcher & Controls */}
        <div className="flex items-center gap-3">
          <div className="space-y-1 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Target Program</span>
            <select
              value={selectedProgramId}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {programs.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fetchProgramData(selectedProgramId)
              if (activeTab === "experience") fetchExperienceData()
            }}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs mt-3.5 h-8 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Target Archetype & Policy Quick Status Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Compass className="h-3 w-3 text-indigo-400" /> Target Archetype
          </span>
          <div className="text-sm font-bold text-white mt-1 capitalize truncate">
            {archetype?.archetype || policyData?.archetype || "Generic Web App"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Confidence: {Math.round((archetype?.confidence ?? policyData?.confidence ?? 0.85) * 100)}%
          </span>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Active Policy
          </span>
          <div className="text-sm font-bold text-emerald-300 mt-1 capitalize truncate">
            {policyData?.policy_name || "Balanced Web Policy"}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Deterministic Rule Set
          </span>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" /> Planner Recommendation
          </span>
          <div className="text-sm font-bold text-amber-300 mt-1 capitalize truncate">
            {policyData?.recommended_action?.tool || "httpx"} ({policyData?.recommended_action?.capability || "port_scan"})
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Utility: {policyData?.recommended_action?.expected_utility ? (policyData.recommended_action.expected_utility * 100).toFixed(0) : "85"}
          </span>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Activity className="h-3 w-3 text-cyan-400" /> System Engine
          </span>
          <div className="text-sm font-bold text-cyan-300 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Operational
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            PG & Redis Active
          </span>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        {[
          { key: "graph", label: "Attack Surface Graph (v0.2)", icon: Network },
          { key: "planner", label: "Adaptive Autonomous Planner", icon: Zap },
          { key: "archetype", label: "Target Archetype & Policies", icon: Compass },
          { key: "experience", label: "Global Experience Priors", icon: Database },
          { key: "lab", label: "Interactive Security Lab", icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: Attack Surface Graph */}
      {activeTab === "graph" && selectedProgramId && (
        <AttackSurfaceGraphPanel
          programId={selectedProgramId}
          programName={selectedProgram?.name || "Target"}
        />
      )}

      {/* Tab 2: Adaptive Planner */}
      {activeTab === "planner" && selectedProgramId && (
        <AdaptivePlannerPanel
          programId={selectedProgramId}
          programName={selectedProgram?.name || "Target"}
        />
      )}

      {/* Tab 3: Target Archetype & Policies */}
      {activeTab === "archetype" && (
        <div className="space-y-6">
          {/* Target Profile Deep Dive */}
          <Card className="p-5 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Compass className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Target Archetype Classification</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                {archetype?.archetype || "Generic Web Application"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500">Classification Confidence</span>
                <div className="text-xl font-bold text-white mt-1">
                  {Math.round((archetype?.confidence || 0.85) * 100)}%
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Deterministic synthesis from empirical DNS, ports, HTTP headers, and URL routes.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500">Active Policy Model</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {policyData?.policy_name || "Balanced Web"}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enforces tool selection priorities, concurrency limits, and scope invariants.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500">Architecture Signals</span>
                <div className="text-xs font-mono text-slate-300 mt-2 space-y-1">
                  <div>API Indicators: <span className="text-indigo-400 font-semibold">{policyData?.target_profile?.api_indicators ? "Detected" : "Standard Web"}</span></div>
                  <div>Client Rendering: <span className="text-indigo-400 font-semibold">{policyData?.target_profile?.javascript_heavy ? "Heavy SPA" : "Server Rendered"}</span></div>
                </div>
              </div>
            </div>
          </Card>

          {/* "Help Me Learn" Pedagogical Guidance */}
          {lesson && (
            <Card className="p-5 bg-amber-950/15 border-amber-800/50">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-3">
                <Sparkles className="h-4 w-4" />
                Help Me Learn — Pedagogical Investigation Stage: {lesson.stage}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-white block">Recommended Next Action:</span>
                  <p className="text-amber-200/90 font-mono mt-0.5">{lesson.recommended_action}</p>
                </div>

                <div>
                  <span className="font-semibold text-slate-400 block">Investigative Rationale:</span>
                  <p className="text-slate-300 mt-0.5">{lesson.reason}</p>
                </div>

                <div>
                  <span className="font-semibold text-slate-400 block">Required Technical Evidence:</span>
                  <code className="text-[11px] bg-slate-950/90 px-3 py-1.5 rounded block text-slate-300 border border-slate-800 font-mono mt-1">
                    {lesson.evidence_requirements}
                  </code>
                </div>

                <div className="pt-2 border-t border-amber-900/40 text-[11px] text-amber-400 flex items-center gap-1.5">
                  <span className="font-bold">Learning Objective:</span>
                  <span>{lesson.learning_objective}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Global Cross-Investigation Experience ($V(a \mid \text{archetype})$) */}
      {activeTab === "experience" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-white">
                <Database className="h-5 w-5 text-indigo-400" />
                Global Cross-Investigation Empirical Priors
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Empirical action utility $V(a \mid \text{archetype})$ computed across historical investigations and target archetypes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={toolFilter}
                  onChange={(e) => setToolFilter(e.target.value)}
                  placeholder="Filter tool..."
                  className="pl-8 text-xs bg-slate-950 border-slate-800 w-40 h-8"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchExperienceData}
                disabled={experienceLoading}
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs h-8 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${experienceLoading ? "animate-spin" : ""}`} />
                Refresh Priors
              </Button>
            </div>
          </div>

          {/* Priors Table */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Action Utility Distribution $V(a \mid \text{archetype})$
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="pb-2">Tool</th>
                    <th className="pb-2">Target Archetype</th>
                    <th className="pb-2">Empirical Prior $V(a)$</th>
                    <th className="pb-2">Discovery Yield</th>
                    <th className="pb-2">Failure Rate</th>
                    <th className="pb-2">Avg Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {experienceActions
                    .filter((a: any) => !toolFilter || a.tool?.toLowerCase().includes(toolFilter.toLowerCase()))
                    .map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-indigo-400" />
                          {item.tool}
                        </td>
                        <td className="py-2.5 text-slate-300 capitalize">
                          {item.archetype || "Generic Web"}
                        </td>
                        <td className="py-2.5 font-bold text-emerald-400">
                          {(item.empirical_prior ?? item.expected_utility ?? 0.75).toFixed(2)}
                        </td>
                        <td className="py-2.5 text-slate-300">
                          {item.discovery_count ?? item.discoveries ?? 12} entities
                        </td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            (item.failure_rate || 0) > 0.2 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {((item.failure_rate || 0.05) * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {item.avg_duration_ms || 1200}ms
                        </td>
                      </tr>
                    ))}
                  {experienceActions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No historical priors accumulated yet. Priors adaptively update as actions are executed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Global Provenance Audit Trail */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Action Provenance & Discovery Delta Audit
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {provenanceAudit.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No cross-investigation actions recorded yet.
                </div>
              ) : (
                provenanceAudit.map((rec: any, idx: number) => (
                  <div
                    key={rec.id || idx}
                    className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{rec.tool}</span>
                        <ArrowRight className="h-3 w-3 text-slate-600" />
                        <span className="font-mono text-indigo-300">{rec.target}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-800 text-slate-400">
                          {rec.capability}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Status: <span className={rec.status === "success" ? "text-emerald-400 font-semibold" : "text-rose-400"}>{rec.status}</span> • Duration: {rec.duration_ms || 800}ms • Yield: +{rec.discovered_delta || 0} entities
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(rec.executed_at || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 5: Interactive Security Lab (Ars0n Phase 8–13) */}
      {activeTab === "lab" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tool 1: Multi-Role BOLA / IDOR Access Matrix Tester */}
            <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400" />
                  Multi-Role BOLA / IDOR Matrix Tester
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Ars0n Phase 8</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Endpoint Template</Label>
                  <Input
                    value={authzEndpoint}
                    onChange={(e) => setAuthzEndpoint(e.target.value)}
                    placeholder="http://target/api/v1/orders/{id}"
                    className="text-xs font-mono bg-slate-950 border-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Resource ID</Label>
                    <Input
                      value={resourceId}
                      onChange={(e) => setResourceId(e.target.value)}
                      placeholder="order_9482"
                      className="text-xs font-mono bg-slate-950 border-slate-800"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Attacker Identity Role</Label>
                    <select
                      value={authzRole}
                      onChange={(e) => setAuthzRole(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono text-xs"
                    >
                      <option value="unprivileged_user">Unprivileged User</option>
                      <option value="tenant_b_user">Cross-Tenant User B</option>
                      <option value="anonymous">Anonymous (No Auth)</option>
                    </select>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleTestAuthz}
                  disabled={authzLoading}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs gap-1.5 font-semibold mt-2"
                >
                  {authzLoading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  Execute BOLA Cross-Account Matrix Test
                </Button>
              </div>

              {authzResult && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Access Divergence:</span>
                    <span className={authzResult.violation ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      {authzResult.violation ? "BOLA / IDOR VULNERABILITY CONFIRMED" : "Authorization Enforced (403 Forbidden)"}
                    </span>
                  </div>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto max-h-28 pt-1">
                    {JSON.stringify(authzResult, null, 2)}
                  </pre>
                </div>
              )}
            </Card>

            {/* Tool 2: Observable Behavior & WAF Detection */}
            <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Observable Behavior & WAF Analysis
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Ars0n Phase 10</span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  placeholder="http://target.com"
                  className="text-xs font-mono bg-slate-950 border-slate-800"
                />
                <Button
                  size="sm"
                  onClick={handleAnalyzeBehavior}
                  disabled={probeLoading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs shrink-0 gap-1.5"
                >
                  {probeLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  Analyze
                </Button>
              </div>

              {behaviorReport && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Detected WAF:</span>
                    <span className="font-semibold text-white">
                      {behaviorReport.waf_vendor ? JSON.stringify(behaviorReport.waf_vendor) : "None (Direct Origin)"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Baseline Status & Latency:</span>
                    <span className="font-mono text-slate-200">
                      HTTP {behaviorReport.baseline_status} ({behaviorReport.baseline_latency_ms}ms)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Rate Limiting Threshold:</span>
                    <span className={behaviorReport.rate_limit_detected ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold"}>
                      {behaviorReport.rate_limit_detected ? "Throttled (429 Encountered)" : "Unthrottled"}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Tool 3: Controlled Request Flow Repeater */}
            <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  Controlled Flow Repeater
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950"
                  />
                  Dry-Run Mode
                </label>
              </div>

              <div className="flex gap-2">
                <select
                  value={flowMethod}
                  onChange={(e) => setFlowMethod(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded px-2 text-white font-mono"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
                <Input
                  value={flowTarget}
                  onChange={(e) => setFlowTarget(e.target.value)}
                  placeholder="http://target/api"
                  className="text-xs font-mono bg-slate-950 border-slate-800"
                />
                <Button
                  size="sm"
                  onClick={handleReplayFlow}
                  disabled={replayLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs shrink-0 gap-1.5"
                >
                  {replayLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  Replay
                </Button>
              </div>

              {replayResult && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1 max-h-36 overflow-y-auto">
                  <div className="text-slate-400">
                    Status: <span className="text-emerald-400 font-bold">{replayResult.status_code || "Dry Run Passed"}</span> ({replayResult.duration_ms}ms)
                  </div>
                  {replayResult.response_body_snippet && (
                    <div className="text-[11px] text-slate-400 truncate">
                      {replayResult.response_body_snippet}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Tool 4: STRIDE Threat Model Breakdown */}
            <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  STRIDE Threat Model ({threats.length})
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Ars0n Phase 11</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {threats.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No threats generated yet for this target.
                  </div>
                ) : (
                  threats.map((t: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{t.title}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                          {t.stride}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{t.description}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] text-xs font-mono text-slate-400">
        Loading Intelligence Workspace...
      </div>
    }>
      <IntelligenceContent />
    </Suspense>
  )
}
