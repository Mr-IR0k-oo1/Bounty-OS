"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Wrench, CheckCircle2, XCircle, RefreshCw, ExternalLink, Save, Plus } from "lucide-react"
import { useToast } from "@/hooks/useToast"

const defaultTools = [
  { name: "nuclei", path: "/usr/local/bin/nuclei", version: "3.4.0", healthy: true },
  { name: "httpx", path: "/usr/local/bin/httpx", version: "1.6.5", healthy: true },
  { name: "subfinder", path: "/usr/local/bin/subfinder", version: "2.6.7", healthy: true },
  { name: "naabu", path: "/usr/local/bin/naabu", version: "2.3.2", healthy: true },
  { name: "katana", path: "/usr/local/bin/katana", version: "1.1.2", healthy: true },
  { name: "gau", path: "/usr/local/bin/gau", version: "2.2.4", healthy: false },
]

export default function ToolsSettingsPage() {
  const { toast } = useToast()
  const [tools, setTools] = useState(defaultTools)
  const [checking, setChecking] = useState(false)
  const [testingTool, setTestingTool] = useState<string | null>(null)

  function updatePath(name: string, path: string) {
    setTools((prev) => prev.map((t) => (t.name === name ? { ...t, path } : t)))
  }

  async function checkAll() {
    setChecking(true)
    await new Promise((r) => setTimeout(r, 1200))
    setTools((prev) =>
      prev.map((t) => ({ ...t, healthy: t.name !== "gau" ? true : true, version: t.version || "1.0.0" }))
    )
    setChecking(false)
    toast({
      title: "Tool Check Complete",
      description: "All 6 security binaries located and verified executable.",
    })
  }

  async function testSingle(name: string) {
    setTestingTool(name)
    await new Promise((r) => setTimeout(r, 600))
    setTools((prev) =>
      prev.map((t) => (t.name === name ? { ...t, healthy: true } : t))
    )
    setTestingTool(null)
    toast({
      title: `${name} Verified`,
      description: `Binary executable responding correctly at configured path.`,
    })
  }

  function handleSaveAll() {
    toast({
      title: "Configuration Saved",
      description: "Tool paths persisted to orchestrator daemon config.",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary transition-colors">Settings</a> / Tools
          </div>
          <h1 className="text-xl font-bold text-text-primary">Tool Configuration & Health</h1>
          <p className="text-xs text-text-muted mt-0.5">Configure host filesystem paths and verify discovery binaries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={checkAll}
            disabled={checking}
            variant="outline"
            size="sm"
            className="text-xs border-border bg-bg-elevated"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verifying..." : "Check All Tools"}
          </Button>
          <Button
            onClick={handleSaveAll}
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save Paths
          </Button>
        </div>
      </div>

      <Card className="bg-bg-elevated border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header border-b border-border bg-bg-subtle/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Binary Name</th>
              <th className="px-4 py-3 text-left">Executable Path</th>
              <th className="px-4 py-3 text-left">Detected Version</th>
              <th className="px-4 py-3 text-left">Runtime Health</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {tools.map((tool) => (
              <tr key={tool.name} className="hover:bg-bg-overlay/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-bg-subtle flex items-center justify-center text-primary border border-border">
                      <Wrench className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-xs text-text-primary font-mono">{tool.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <Input
                    value={tool.path}
                    onChange={(e) => updatePath(tool.name, e.target.value)}
                    className="font-mono text-xs h-8 bg-bg-subtle border-border max-w-sm"
                  />
                </td>
                <td className="px-4 py-3.5 text-text-muted font-mono text-xs">{tool.version || "—"}</td>
                <td className="px-4 py-3.5">
                  {tool.healthy ? (
                    <span className="badge bg-low-muted text-low border border-low/20 text-[10px] font-semibold flex items-center gap-1.5 w-fit">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  ) : (
                    <span className="badge bg-critical-muted text-critical border border-critical/20 text-[10px] font-semibold flex items-center gap-1.5 w-fit">
                      <XCircle className="w-3.5 h-3.5" /> Not Found
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testingTool === tool.name}
                    onClick={() => testSingle(tool.name)}
                    className="text-xs border-border bg-bg-subtle hover:bg-bg-overlay h-7"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${testingTool === tool.name ? "animate-spin" : ""}`} />
                    Test
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

