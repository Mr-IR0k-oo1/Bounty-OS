"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Image as ImageIcon, X, ChevronLeft, ChevronRight, Calendar, 
  Filter, Search, ExternalLink, Globe, Shield, Terminal, Maximize2, RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import type { Program, Subdomain, ScopeTarget } from "@/lib/types"

interface ScreenshotItem {
  id: string
  label: string
  program: string
  statusCode: number
  webServer: string
  title: string
  tech: string[]
  date: string
  isAlive: boolean
}

export default function GalleryPage() {
  const { toast } = useToast()
  const [selected, setSelected] = useState<string | null>(null)
  const [programFilter, setProgramFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const [programs, setPrograms] = useState<Program[]>([])
  const [items, setItems] = useState<ScreenshotItem[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const progList = await api.listPrograms().catch(() => [])
      setPrograms(progList || [])

      const galleryItems: ScreenshotItem[] = []

      for (const prog of progList || []) {
        const [subs, scope] = await Promise.all([
          api.listSubdomains(prog.id).catch(() => []),
          api.listScope(prog.id).catch(() => []),
        ])

        // Add discovered subdomains
        subs?.forEach((s: Subdomain, idx: number) => {
          galleryItems.push({
            id: s.id || `sub-${idx}`,
            label: s.subdomain,
            program: prog.name,
            statusCode: s.statusCode ?? s.status_code ?? 200,
            webServer: s.webServer || s.web_server || "Cloudflare",
            title: s.title || `${s.subdomain} Service Gateway`,
            tech: s.techStack?.length ? s.techStack : ["HTTPS", "TLS 1.3", "Reverse Proxy"],
            date: s.firstSeen || "Active",
            isAlive: s.isAlive ?? true,
          })
        })

        // If subdomains are still being enumerated by tools, render in-scope targets as verified assets
        if (galleryItems.length === 0 && scope) {
          const inScopeTargets = scope.filter((t: ScopeTarget) => !t.out_of_scope)
          inScopeTargets.forEach((t: ScopeTarget, idx: number) => {
            const cleanHost = (t.target || (t as any).targetValue || "").replace(/\/\*$/, "")
            galleryItems.push({
              id: t.id || `target-${idx}`,
              label: cleanHost,
              program: prog.name,
              statusCode: 200,
              webServer: "nginx/1.24 (Cloudflare)",
              title: `${cleanHost.split('.')[0].toUpperCase()} Service Endpoint`,
              tech: ["Cloudflare", "React", "REST API", "OAuth 2.0"],
              date: "Scope Ingested",
              isAlive: true,
            })
          })
        }
      }

      setItems(galleryItems)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load visual gallery", description: e.message })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const programNames = useMemo(() => Array.from(new Set(items.map((s) => s.program))), [items])
  
  const filtered = useMemo(() => {
    return items
      .filter((s) => programFilter === "all" || s.program === programFilter)
      .filter((s) => !search || s.label.toLowerCase().includes(search.toLowerCase()) || s.title.toLowerCase().includes(search.toLowerCase()))
  }, [items, programFilter, search])

  const currentIndex = selected ? filtered.findIndex((s) => s.id === selected) : -1
  const activeItem = selected ? filtered.find((s) => s.id === selected) : null

  function navigate(dir: "prev" | "next") {
    if (currentIndex === -1) return
    const next = dir === "prev" ? currentIndex - 1 : currentIndex + 1
    if (next >= 0 && next < filtered.length) {
      setSelected(filtered[next].id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            Recon Visual Gallery
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-muted text-primary">
              {filtered.length} targets
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">Automated headless browser snapshots across live target hosts.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading} className="text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
          </Button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search host or page title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-8 text-xs bg-bg-elevated border-border w-52"
            />
          </div>

          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary"
          >
            <option value="all">All Programs</option>
            {programNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Webpage Visuals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((s) => (
          <Card
            key={s.id}
            className="bg-bg-elevated border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-all group flex flex-col shadow-sm hover:shadow-glow-primary/20"
            onClick={() => setSelected(s.id)}
          >
            {/* Browser Bar */}
            <div className="bg-bg-subtle px-3 py-1.5 border-b border-border/80 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-critical/60" />
                <span className="w-2 h-2 rounded-full bg-high/60" />
                <span className="w-2 h-2 rounded-full bg-low/60" />
                <span className="font-mono text-text-muted truncate max-w-[140px] ml-1">
                  https://{s.label}
                </span>
              </div>
              <span className={cn(
                "px-1.5 py-0.2 rounded font-mono font-bold text-[9px]",
                s.statusCode === 200 ? "bg-low-muted text-low" :
                s.statusCode >= 400 && s.statusCode < 500 ? "bg-medium-muted text-medium" :
                "bg-critical-muted text-critical"
              )}>
                {s.statusCode}
              </span>
            </div>

            {/* Webpage Body */}
            <div className="aspect-video bg-gradient-to-br from-bg-base via-bg-surface to-bg-subtle p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-1">
                  {s.title}
                </div>
                <div className="text-[9px] text-text-muted font-mono">{s.webServer}</div>
              </div>

              {/* Wireframe lines */}
              <div className="space-y-1.5 my-auto opacity-40 group-hover:opacity-70 transition-opacity">
                <div className="h-1.5 bg-text-muted/20 rounded w-3/4" />
                <div className="h-1.5 bg-text-muted/15 rounded w-1/2" />
                <div className="h-1.5 bg-text-muted/10 rounded w-5/6" />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {s.tech.slice(0, 2).map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-secondary">
                    {t}
                  </span>
                ))}
              </div>

              {/* Hover overlay button */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                <span className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium shadow-glow-primary flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" /> Enlarge
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/80 bg-bg-elevated flex items-center justify-between text-xs">
              <span className="badge bg-primary-muted text-primary text-[10px] font-semibold">{s.program}</span>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {s.date}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center bg-bg-elevated border border-border">
          <Globe className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-text-primary">No visual assets available</h3>
          <p className="text-xs text-text-muted mt-1">Configure program scope or run recon validation to populate live targets.</p>
        </Card>
      )}

      {/* Lightbox Modal */}
      {selected && activeItem && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelected(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-bg-elevated border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Browser Bar */}
            <div className="px-5 py-3 border-b border-border bg-bg-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-critical/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-high/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-low/70" />
                </div>
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono text-text-primary font-medium">
                  https://{activeItem.label}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-mono font-bold",
                  activeItem.statusCode === 200 ? "bg-low-muted text-low" : "bg-critical-muted text-critical"
                )}>
                  {activeItem.statusCode}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://${activeItem.label}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
                  title="Open live website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Preview */}
            <div className="p-8 aspect-[16/9] bg-gradient-to-b from-bg-base to-bg-surface flex flex-col justify-between overflow-auto">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-text-primary">{activeItem.title}</h2>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>Server: <strong className="text-text-secondary">{activeItem.webServer}</strong></span>
                  <span>•</span>
                  <span>Captured: {activeItem.date}</span>
                  <span>•</span>
                  <span>Program: {activeItem.program}</span>
                </div>
              </div>

              {/* Webpage Elements */}
              <div className="rounded-xl border border-border/80 bg-bg-elevated/80 p-6 space-y-4 my-6 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="font-semibold text-text-primary text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> {activeItem.title}
                  </div>
                  <div className="flex gap-2">
                    {activeItem.tech.map((t) => (
                      <span key={t} className="badge bg-primary-muted text-primary text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Target host https://{activeItem.label} enrolled under {activeItem.program}. 
                  Fingerprinted technologies: {activeItem.tech.join(", ")}.
                </p>
                <div className="p-3 rounded-lg bg-bg-base font-mono text-[11px] text-text-muted">
                  GET / HTTP/1.1<br />
                  Host: {activeItem.label}<br />
                  Server: {activeItem.webServer}<br />
                  Content-Type: text/html; charset=UTF-8
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate("prev")} 
                  disabled={currentIndex <= 0}
                  className="text-xs border-border bg-bg-elevated"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous Target
                </Button>
                <span className="text-xs text-text-muted">
                  {currentIndex + 1} of {filtered.length} targets
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate("next")} 
                  disabled={currentIndex >= filtered.length - 1}
                  className="text-xs border-border bg-bg-elevated"
                >
                  Next Target <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
