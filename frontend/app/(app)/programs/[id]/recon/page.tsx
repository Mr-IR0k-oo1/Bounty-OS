"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Globe, Server, Link as LinkIcon, Image as ImageIcon, ExternalLink, AlertCircle, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import type { Subdomain, DiscoveredUrl, Port } from "@/lib/types"

type ReconTab = "subdomains" | "ports" | "urls" | "screenshots"

export default function ProgramReconPage() {
  const params = useParams()
  const programId = params.id as string
  const [activeTab, setActiveTab] = useState<ReconTab>("subdomains")

  const [subdomains, setSubdomains] = useState<Subdomain[]>([])
  const [urls, setUrls] = useState<DiscoveredUrl[]>([])
  const [ports, setPorts] = useState<Port[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subs, urlList, portList] = await Promise.all([
        api.listSubdomains(programId).catch(() => []),
        api.listUrls(programId).catch(() => []),
        api.listProgramPorts(programId).catch(() => []),
      ])
      setSubdomains(subs)
      setUrls(urlList)
      setPorts(portList)
    } catch (e: any) {
      setError(e.message || "Failed to load recon data")
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const tabs: { key: ReconTab; label: string; icon: React.ReactNode }[] = [
    { key: "subdomains", label: `Subdomains (${subdomains.length})`, icon: <Globe className="w-3.5 h-3.5" /> },
    { key: "ports", label: `Ports & Services (${ports.length})`, icon: <Server className="w-3.5 h-3.5" /> },
    { key: "urls", label: `URLs (${urls.length})`, icon: <LinkIcon className="w-3.5 h-3.5" /> },
    { key: "screenshots", label: "Screenshots", icon: <ImageIcon className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <Link href={`/programs/${programId}`} className="hover:text-text-primary">Program</Link>
        <span>/</span>
        <span className="text-text-primary">Recon</span>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load recon data: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchData()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-bg-subtle rounded-md w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium ${
              activeTab === tab.key
                ? "bg-bg-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 bg-bg-elevated border border-border rounded-xl animate-pulse h-64" />
      ) : (
        <>
          {activeTab === "subdomains" && (
            <Card className="bg-bg-elevated border border-border overflow-hidden">
              {subdomains.length === 0 ? (
                <div className="p-12 text-center text-xs text-text-muted">
                  No subdomains discovered yet for this program. Run an enumeration scan to populate assets.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Subdomain</th>
                      <th className="px-4 py-2.5 text-left">IP Address</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">Title</th>
                      <th className="px-4 py-2.5 text-left">Technologies</th>
                      <th className="px-4 py-2.5 text-left">Alive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subdomains.map((s) => {
                      const status = s.statusCode ?? s.status_code ?? 0
                      const ip = s.ipAddress ?? s.ip_address ?? "-"
                      const techList = s.techStack || s.tech || []
                      const alive = s.isAlive !== false && status !== 0

                      return (
                        <tr key={s.id} className="hover:bg-bg-overlay">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary">{s.subdomain}</td>
                          <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{ip}</td>
                          <td className="px-4 py-2.5">
                            {status > 0 ? (
                              <span className={`badge text-xs ${status < 300 ? "bg-accent-muted text-accent" : status < 400 ? "bg-primary-muted text-primary" : "bg-severity-high/10 text-severity-high"}`}>
                                {status}
                              </span>
                            ) : (
                              <span className="badge bg-bg-subtle text-text-muted text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary max-w-[200px] truncate">{s.title || "-"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {techList.map((t) => (
                                <span key={t} className="badge bg-bg-subtle text-text-muted text-xs">{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`w-2 h-2 rounded-full inline-block ${alive ? "bg-accent" : "bg-text-subtle"}`} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {activeTab === "ports" && (
            <Card className="bg-bg-elevated border border-border overflow-hidden">
              {ports.length === 0 ? (
                <div className="p-12 text-center text-xs text-text-muted">
                  No open network ports or services recorded yet for this program.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Port / Protocol</th>
                      <th className="px-4 py-2.5 text-left">Host / IP</th>
                      <th className="px-4 py-2.5 text-left">Service</th>
                      <th className="px-4 py-2.5 text-left">State</th>
                      <th className="px-4 py-2.5 text-left">Banner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ports.map((p) => (
                      <tr key={p.id} className="hover:bg-bg-overlay">
                        <td className="px-4 py-2.5 font-mono text-xs text-primary font-semibold">
                          {p.port} / {p.protocol.toUpperCase()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                          {p.ip || "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="badge bg-primary/10 text-primary text-xs">
                            {p.service || "unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="badge bg-accent-muted text-accent text-xs">
                            {p.state || "open"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs max-w-[280px] truncate">
                          {p.banner || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {activeTab === "urls" && (
            <Card className="bg-bg-elevated border border-border overflow-hidden">
              {urls.length === 0 ? (
                <div className="p-12 text-center text-xs text-text-muted">
                  No endpoint URLs recorded yet for this program.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2.5 text-left">URL</th>
                      <th className="px-4 py-2.5 text-left">Method</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">Source</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {urls.map((u) => {
                      const status = u.statusCode ?? u.status_code ?? 200
                      return (
                        <tr key={u.id} className="hover:bg-bg-overlay">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary max-w-[400px] truncate">{u.url}</td>
                          <td className="px-4 py-2.5">
                            <span className="badge bg-bg-subtle text-text-muted text-xs">{u.method}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`badge text-xs ${status < 300 ? "bg-accent-muted text-accent" : "bg-severity-high/10 text-severity-high"}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-text-muted text-xs">{u.source}</td>
                          <td className="px-4 py-2.5 text-right">
                            <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {activeTab === "screenshots" && (
            <Card className="p-12 text-center bg-bg-elevated border border-border text-xs text-text-muted">
              No live screenshots captured yet.
            </Card>
          )}
        </>
      )}
    </div>
  )
}
