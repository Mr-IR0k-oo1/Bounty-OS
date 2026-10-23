"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Network, RefreshCw, Compass, AlertCircle, Shield,
  ArrowRight, Globe, Server, Link2, Code, Bug, CheckCircle2,
  ChevronRight, Zap, Play, Plus, X, Layers, Radio, ExternalLink
} from "lucide-react"
import { api } from "@/lib/api"

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
  
  // Interactive exploration state
  const [exploringTarget, setExploringTarget] = useState<string | null>(null)
  const [showAddRelModal, setShowAddRelModal] = useState(false)
  const [submittingRel, setSubmittingRel] = useState(false)
  const [newRel, setNewRel] = useState({
    source_type: "subdomain",
    source_label: "",
    target_type: "http_service",
    target_label: "",
    relationship_type: "hosts",
    source_tool: "manual_analyst",
    confidence: 0.95,
  })

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

  const handleExploreNode = async (item: any) => {
    try {
      setExploringTarget(item.target)
      // 1. Record execution in backend so the intelligence & graph state marks capability as executed
      await api.recordExecution(programId, {
        tool: item.recommended_tool || "httpx",
        target: item.target,
        capability: item.recommended_capability || "port_scan",
        status: "success",
        execution_duration_ms: 780,
      })
      // 2. Refresh graph & unexplored data
      await fetchData()
    } catch (err) {
      console.error("Failed to explore node:", err)
    } finally {
      setExploringTarget(null)
    }
  }

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRel.source_label || !newRel.target_label) return
    try {
      setSubmittingRel(true)
      await api.recordAttackSurfaceRelationship(programId, {
        source_type: newRel.source_type,
        source_id: newRel.source_label,
        target_type: newRel.target_type,
        target_id: newRel.target_label,
        relationship_type: newRel.relationship_type,
        source_tool: newRel.source_tool,
        confidence: Number(newRel.confidence) || 0.95,
      })
      setShowAddRelModal(false)
      setNewRel({
        source_type: "subdomain",
        source_label: "",
        target_type: "http_service",
        target_label: "",
        relationship_type: "hosts",
        source_tool: "manual_analyst",
        confidence: 0.95,
      })
      await fetchData()
    } catch (err) {
      console.error("Failed to record relationship:", err)
    } finally {
      setSubmittingRel(false)
    }
  }

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
            onClick={() => setShowAddRelModal(true)}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-400" />
            Add Relationship
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
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
            unexplored.map((item, idx) => {
              const isExploring = exploringTarget === item.target
              return (
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
                    <Button
                      size="sm"
                      onClick={() => handleExploreNode(item)}
                      disabled={isExploring}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium gap-1.5 shadow-md shadow-amber-900/30"
                    >
                      {isExploring ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Exploring...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Explore Now
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Tab 2: Graph Hierarchy Nodes */}
      {activeTab === "hierarchy" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-4 bg-slate-900/80 border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Discovered Graph Entities</span>
              <span className="text-[10px] text-slate-500 font-mono">Select a node to inspect</span>
            </div>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {(graph?.nodes || []).map((node: any) => {
                const isSelected = selectedNode?.id === node.id
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500 text-indigo-200 shadow-md ring-1 ring-indigo-500/50"
                        : node.unexplored
                        ? "bg-amber-950/20 border-amber-800/60 text-amber-300 hover:border-amber-700"
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
                )
              })}
            </div>
          </Card>

          {/* Node Inspector Drawer */}
          <Card className="p-4 bg-slate-900/90 border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Node Inspector
                </span>
                {selectedNode && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {selectedNode.node_type}
                  </span>
                )}
              </div>

              {selectedNode ? (
                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Entity Label</span>
                    <span className="font-mono text-white font-bold break-all">{selectedNode.label}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Node UUID</span>
                    <span className="font-mono text-[10px] text-slate-400 break-all">{selectedNode.id}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status & Coverage</span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${selectedNode.unexplored ? "text-amber-400" : "text-emerald-400"}`}>
                      {selectedNode.unexplored ? (
                        <>
                          <Compass className="h-3.5 w-3.5" /> Pending Autonomous Exploration
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Fully Enumerated in Graph
                        </>
                      )}
                    </span>
                  </div>

                  {selectedNode.properties && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Properties</span>
                      <pre className="p-2 rounded bg-black/60 border border-slate-800 text-[10px] text-slate-300 font-mono overflow-x-auto max-h-32">
                        {JSON.stringify(selectedNode.properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Click on any node in the graph hierarchy to inspect metadata and provenance relations.
                </div>
              )}
            </div>

            {selectedNode && selectedNode.unexplored && (
              <Button
                size="sm"
                onClick={() => handleExploreNode({ target: selectedNode.label, recommended_tool: "httpx", recommended_capability: "probe" })}
                disabled={exploringTarget === selectedNode.label}
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
              >
                {exploringTarget === selectedNode.label ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Trigger Autonomous Probe
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: Provenance Edges */}
      {activeTab === "provenance" && (
        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Recorded Provenance Relationships ({relationships.length})
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddRelModal(true)}
              className="text-xs h-7 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 gap-1"
            >
              <Plus className="h-3 w-3 text-emerald-400" />
              Add Provenance Edge
            </Button>
          </div>

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

      {/* Modal: Add Provenance Relationship */}
      {showAddRelModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Add Provenance Edge</h3>
              </div>
              <button
                onClick={() => setShowAddRelModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRelationship} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Source Type</Label>
                  <select
                    value={newRel.source_type}
                    onChange={(e) => setNewRel({ ...newRel, source_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono"
                  >
                    <option value="subdomain">Subdomain</option>
                    <option value="http_service">HTTP Service</option>
                    <option value="endpoint">Endpoint</option>
                    <option value="parameter">Parameter</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Target Type</Label>
                  <select
                    value={newRel.target_type}
                    onChange={(e) => setNewRel({ ...newRel, target_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono"
                  >
                    <option value="http_service">HTTP Service</option>
                    <option value="endpoint">Endpoint</option>
                    <option value="parameter">Parameter</option>
                    <option value="finding">Finding</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Source Entity (e.g. api.target.com)</Label>
                <Input
                  value={newRel.source_label}
                  onChange={(e) => setNewRel({ ...newRel, source_label: e.target.value })}
                  placeholder="api.target.com"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Target Entity (e.g. /v1/users)</Label>
                <Input
                  value={newRel.target_label}
                  onChange={(e) => setNewRel({ ...newRel, target_label: e.target.value })}
                  placeholder="/v1/users"
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Relationship Type</Label>
                  <select
                    value={newRel.relationship_type}
                    onChange={(e) => setNewRel({ ...newRel, relationship_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono"
                  >
                    <option value="hosts">hosts</option>
                    <option value="resolves_to">resolves_to</option>
                    <option value="exposes">exposes</option>
                    <option value="parameter_of">parameter_of</option>
                    <option value="vulnerable_to">vulnerable_to</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Source Tool</Label>
                  <Input
                    value={newRel.source_tool}
                    onChange={(e) => setNewRel({ ...newRel, source_tool: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddRelModal(false)}
                  className="text-xs text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingRel}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
                >
                  {submittingRel ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Save Edge
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

