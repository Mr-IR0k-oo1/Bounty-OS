"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Network, RefreshCw, Compass, AlertCircle, Shield,
  ArrowRight, Globe, Server, Link2, Code, Bug, CheckCircle2,
  ChevronDown, ChevronRight, Zap
} from "lucide-react"

interface AttackSurfaceGraphPanelProps {
  programId: string
  programName: string
}

export function AttackSurfaceGraphPanel({ programId, programName }: AttackSurfaceGraphPanelProps) {
  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [unexplored, setUnexplored] = useState<any[]>([])
  const [relationships, setRelationships] = useState<any[]>([])
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"unexplored" | "hierarchy" | "provenance">("unexplored")

  const fetchData = async () => {
    try {
      setLoading(true)
      const [gRes, sRes, uRes, rRes] = await Promise.all([
        fetch(`/api/investigations/${programId}/graph`),
        fetch(`/api/investigations/${programId}/graph/summary`),
        fetch(`/api/investigations/${programId}/graph/unexplored`),
        fetch(`/api/investigations/${programId}/graph/relationships`),
      ])

      if (gRes.ok) setGraph(await gRes.json())
      if (sRes.ok) setSummary(await sRes.json())
      if (uRes.ok) setUnexplored(await uRes.json())
      if (rRes.ok) setRelationships(await rRes.json())
    } catch (e) {
      console.error("Failed to load attack surface graph:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [programId])

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Network className="h-5 w-5 text-indigo-400" />
            Attack Surface Graph v0.2
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Normalized relational model & provenance tracking across assets, endpoints, parameters, and findings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Graph
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Globe className="h-3 w-3 text-cyan-400" /> Assets
          </span>
          <div className="text-xl font-black text-white mt-1">
            {summary?.asset_count ?? 0}
          </div>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Server className="h-3 w-3 text-emerald-400" /> HTTP Services
          </span>
          <div className="text-xl font-black text-white mt-1">
            {summary?.http_service_count ?? 0}
          </div>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Link2 className="h-3 w-3 text-blue-400" /> Endpoints
          </span>
          <div className="text-xl font-black text-white mt-1">
            {summary?.endpoint_count ?? 0}
          </div>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Code className="h-3 w-3 text-purple-400" /> Parameters
          </span>
          <div className="text-xl font-black text-white mt-1">
            {summary?.parameter_count ?? 0}
          </div>
        </Card>

        <Card className="p-3 bg-slate-900/80 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <Bug className="h-3 w-3 text-amber-400" /> Findings
          </span>
          <div className="text-xl font-black text-white mt-1">
            {summary?.finding_count ?? 0}
          </div>
        </Card>

        <Card className="p-3 bg-amber-950/20 border-amber-900/50">
          <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
            <Compass className="h-3 w-3 text-amber-400" /> Unexplored
          </span>
          <div className="text-xl font-black text-amber-300 mt-1">
            {summary?.unexplored_count ?? unexplored.length}
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab("unexplored")}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "unexplored"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Compass className="h-4 w-4" />
          Unexplored Surface ({unexplored.length})
        </button>
        <button
          onClick={() => setActiveTab("hierarchy")}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "hierarchy"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Network className="h-4 w-4" />
          Graph Hierarchy ({graph?.nodes?.length ?? 0} Nodes)
        </button>
        <button
          onClick={() => setActiveTab("provenance")}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "provenance"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Shield className="h-4 w-4" />
          Provenance Edges ({relationships.length})
        </button>
      </div>

      {/* Tab 1: Unexplored Attack Surface */}
      {activeTab === "unexplored" && (
        <div className="space-y-3">
          {unexplored.length === 0 ? (
            <Card className="p-8 text-center bg-slate-900/40 border-slate-800">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <h4 className="font-semibold text-white">Full Attack Surface Explored</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No unexplored subdomains, live web applications, or reflected parameters currently awaiting coverage.
              </p>
            </Card>
          ) : (
            unexplored.map((item, idx) => (
              <Card
                key={item.id || idx}
                className="p-4 bg-slate-900/80 border-slate-800 hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {item.category}
                    </span>
                    <span className="text-xs font-mono font-semibold text-white">
                      {item.target}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Score: {(item.priority_score * 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {item.reason}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Recommended</div>
                    <div className="text-xs font-mono font-bold text-indigo-400">
                      {item.recommended_tool} ({item.recommended_capability})
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Graph Hierarchy Nodes */}
      {activeTab === "hierarchy" && (
        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="space-y-2">
            {(graph?.nodes || []).map((node: any) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between cursor-pointer transition-colors ${
                  node.unexplored
                    ? "bg-amber-950/20 border-amber-800/60 text-amber-300"
                    : "bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-800 text-slate-400">
                    {node.node_type}
                  </span>
                  <span className="font-semibold">{node.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {node.unexplored && (
                    <span className="text-[10px] text-amber-400 font-sans font-medium flex items-center gap-1">
                      <Compass className="h-3 w-3" /> Unexplored
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: Provenance Edges */}
      {activeTab === "provenance" && (
        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="space-y-2">
            {relationships.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No provenance relationships explicitly recorded yet.
              </p>
            ) : (
              relationships.map((rel: any, idx: number) => (
                <div
                  key={rel.id || idx}
                  className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{rel.source_label}</span>
                      <ArrowRight className="h-3 w-3 text-slate-500" />
                      <span className="font-semibold text-indigo-300">{rel.target_label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        {rel.relationship_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Discovered by tool <span className="font-mono text-slate-400">{rel.source_tool}</span> with confidence {(rel.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(rel.last_seen || rel.first_seen).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
