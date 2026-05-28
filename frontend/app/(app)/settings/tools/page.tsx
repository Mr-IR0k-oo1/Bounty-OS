"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Wrench, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react"

const defaultTools = [
  { name: "nuclei", path: "/usr/local/bin/nuclei", version: "3.4.0", healthy: true },
  { name: "httpx", path: "/usr/local/bin/httpx", version: "1.6.5", healthy: true },
  { name: "subfinder", path: "/usr/local/bin/subfinder", version: "2.6.7", healthy: true },
  { name: "naabu", path: "/usr/local/bin/naabu", version: "2.3.2", healthy: true },
  { name: "katana", path: "/usr/local/bin/katana", version: "1.1.2", healthy: true },
  { name: "gau", path: "/usr/local/bin/gau", version: "2.2.4", healthy: false },
]

export default function ToolsSettingsPage() {
  const [tools, setTools] = useState(defaultTools)
  const [checking, setChecking] = useState(false)

  function updatePath(name: string, path: string) {
    setTools((prev) => prev.map((t) => (t.name === name ? { ...t, path } : t)))
  }

  async function checkAll() {
    setChecking(true)
    await new Promise((r) => setTimeout(r, 1500))
    setChecking(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary">Settings</a> / Tools
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Tool Configuration</h1>
        </div>
        <Button onClick={checkAll} disabled={checking} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check All Tools"}
        </Button>
      </div>

      <Card className="bg-bg-elevated border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Tool</th>
              <th className="px-4 py-3 text-left">Path</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Health</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tools.map((tool) => (
              <tr key={tool.name} className="hover:bg-bg-overlay">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-text-muted" />
                    <span className="font-medium text-text-primary">{tool.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={tool.path}
                    onChange={(e) => updatePath(tool.name, e.target.value)}
                    className="font-mono text-xs h-8"
                  />
                </td>
                <td className="px-4 py-3 text-text-muted font-mono text-xs">{tool.version || "-"}</td>
                <td className="px-4 py-3">
                  {tool.healthy ? (
                    <span className="flex items-center gap-1.5 text-xs text-accent">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-severity-high">
                      <XCircle className="w-3.5 h-3.5" /> Unhealthy
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Test
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
