"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Image as ImageIcon, X, ChevronLeft, ChevronRight, Calendar, 
  Filter, Search, ExternalLink, Globe, Shield, Terminal, Maximize2
} from "lucide-react"
import { cn } from "@/lib/utils"

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

const screenshots: ScreenshotItem[] = [
  { id: "s1", label: "auth.uber.com", program: "Uber", statusCode: 200, webServer: "Cloudflare", title: "Uber Single Sign-On", tech: ["OAuth", "React", "Cloudflare"], date: "Today", isAlive: true },
  { id: "s2", label: "internal-metrics.staging.uber.com", program: "Uber", statusCode: 401, webServer: "nginx/1.22.1", title: "Prometheus Monitoring Hub", tech: ["Prometheus", "Grafana"], date: "Today", isAlive: true },
  { id: "s3", label: "api.uber.com/docs", program: "Uber", statusCode: 403, webServer: "Envoy Proxy", title: "403 Forbidden - Access Denied", tech: ["Envoy", "gRPC"], date: "Yesterday", isAlive: true },
  { id: "s4", label: "restaurant-portal.ubereats.com", program: "Uber", statusCode: 200, webServer: "Fastly", title: "Uber Eats Partner Management", tech: ["React", "Fastly", "GraphQL"], date: "2d ago", isAlive: true },
  { id: "s5", label: "login.airbnb.com", program: "Airbnb", statusCode: 200, webServer: "AWS CloudFront", title: "Sign in to Airbnb", tech: ["React", "Java", "CloudFront"], date: "3d ago", isAlive: true },
  { id: "s6", label: "api.airbnb.com/v2/listings", program: "Airbnb", statusCode: 404, webServer: "Kong Gateway", title: "404 Not Found", tech: ["Kong", "Node.js"], date: "3d ago", isAlive: true },
  { id: "s7", label: "developer.twitter.com", program: "Twitter", statusCode: 200, webServer: "Twitter-GWS", title: "Twitter Developer Platform", tech: ["TypeScript", "Next.js"], date: "4d ago", isAlive: true },
  { id: "s8", label: "admin.shopify.com", program: "Shopify", statusCode: 200, webServer: "Cloudflare", title: "Shopify Merchant Admin", tech: ["Ruby", "React", "Cloudflare"], date: "5d ago", isAlive: true },
  { id: "s9", label: "checkout.shopify.com", program: "Shopify", statusCode: 200, webServer: "Cloudflare", title: "Shopify Checkout Engine", tech: ["Cloudflare", "React"], date: "5d ago", isAlive: true },
  { id: "s10", label: "api.dropbox.com", program: "Dropbox", statusCode: 400, webServer: "nginx", title: "API Invalid Request", tech: ["Python", "Nginx"], date: "1w ago", isAlive: true },
  { id: "s11", label: "paper.dropbox.com", program: "Dropbox", statusCode: 200, webServer: "nginx", title: "Dropbox Paper Collaborative Workspace", tech: ["React", "Nginx"], date: "1w ago", isAlive: true },
  { id: "s12", label: "dev-cluster01.corp.uber.com", program: "Uber", statusCode: 502, webServer: "Cloudflare", title: "502 Bad Gateway", tech: ["Cloudflare"], date: "1w ago", isAlive: false },
]

export default function GalleryPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [programFilter, setProgramFilter] = useState("all")
  const [search, setSearch] = useState("")

  const programs = Array.from(new Set(screenshots.map((s) => s.program)))
  
  const filtered = screenshots
    .filter((s) => programFilter === "all" || s.program === programFilter)
    .filter((s) => !search || s.label.toLowerCase().includes(search.toLowerCase()) || s.title.toLowerCase().includes(search.toLowerCase()))

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
              {filtered.length} captured
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">Automated headless browser snapshots across live target hosts.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
            {programs.map((p) => (
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
            {/* Simulated Browser Bar */}
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

            {/* Simulated Webpage Body */}
            <div className="aspect-video bg-gradient-to-br from-bg-base via-bg-surface to-bg-subtle p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-1">
                  {s.title}
                </div>
                <div className="text-[9px] text-text-muted font-mono">{s.webServer}</div>
              </div>

              {/* Mock skeleton UI lines representing content */}
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

              {/* Webpage Mockup Elements */}
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
                  Headless Chromium captured HTTP status {activeItem.statusCode} at endpoint https://{activeItem.label}. 
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
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous Snapshot
                </Button>
                <span className="text-xs text-text-muted">
                  {currentIndex + 1} of {filtered.length} snapshots
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate("next")} 
                  disabled={currentIndex >= filtered.length - 1}
                  className="text-xs border-border bg-bg-elevated"
                >
                  Next Snapshot <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

