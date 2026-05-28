"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Globe, Server, Link, Image, Radio, ExternalLink } from "lucide-react"

type ReconTab = "subdomains" | "ports" | "urls" | "screenshots"

const subdomains = [
  { subdomain: "www.uber.com", ip: "104.16.99.52", status: 200, title: "Uber - Get a Ride", tech: ["React", "Cloudflare"], alive: true },
  { subdomain: "api.uber.com", ip: "104.16.98.52", status: 403, title: "403 Forbidden", tech: ["nginx"], alive: true },
  { subdomain: "auth.uber.com", ip: "104.16.97.52", status: 200, title: "Sign In - Uber", tech: ["React", "Auth0"], alive: true },
  { subdomain: "developers.uber.com", ip: "104.16.96.52", status: 200, title: "Uber Developers", tech: ["Next.js", "Vercel"], alive: true },
  { subdomain: "staging.uber.com", ip: "10.0.1.52", status: 502, title: "Bad Gateway", tech: [], alive: false },
]

const ports = [
  { host: "104.16.99.52", port: 80, service: "http", version: "nginx 1.24", status: "open" },
  { host: "104.16.99.52", port: 443, service: "https", version: "nginx 1.24", status: "open" },
  { host: "104.16.99.52", port: 22, service: "ssh", version: "OpenSSH 8.9", status: "open" },
  { host: "104.16.98.52", port: 443, service: "https", version: "nginx 1.24", status: "open" },
  { host: "104.16.98.52", port: 8080, service: "http-proxy", version: "", status: "filtered" },
]

const urls = [
  { url: "https://www.uber.com/", method: "GET", status: 200, source: "wayback" },
  { url: "https://www.uber.com/login", method: "GET", status: 200, source: "crawl" },
  { url: "https://api.uber.com/v1/users", method: "POST", status: 403, source: "discovery" },
  { url: "https://auth.uber.com/oauth/token", method: "POST", status: 401, source: "discovery" },
  { url: "https://www.uber.com/api/ride-estimate", method: "GET", status: 200, source: "crawl" },
]

export default function ProgramReconPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState<ReconTab>("subdomains")

  const tabs: { key: ReconTab; label: string; icon: React.ReactNode }[] = [
    { key: "subdomains", label: "Subdomains", icon: <Globe className="w-3.5 h-3.5" /> },
    { key: "ports", label: "Ports", icon: <Server className="w-3.5 h-3.5" /> },
    { key: "urls", label: "URLs", icon: <Link className="w-3.5 h-3.5" /> },
    { key: "screenshots", label: "Screenshots", icon: <Image className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/programs/${params.id}`} className="hover:text-text-primary">Program</a>
        <span>/</span>
        <span className="text-text-primary">Recon</span>
      </div>

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

      {activeTab === "subdomains" && (
        <Card className="bg-bg-elevated border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left">Subdomain</th>
                <th className="px-4 py-2.5 text-left">IP</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Title</th>
                <th className="px-4 py-2.5 text-left">Tech</th>
                <th className="px-4 py-2.5 text-left">Alive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subdomains.map((s, i) => (
                <tr key={i} className="hover:bg-bg-overlay">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{s.subdomain}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{s.ip}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-xs ${s.status < 300 ? "bg-accent-muted text-accent" : s.status < 400 ? "bg-primary-muted text-primary" : "bg-severity-high/10 text-severity-high"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary max-w-[200px] truncate">{s.title}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {s.tech.map((t) => (
                        <span key={t} className="badge bg-bg-subtle text-text-muted text-xs">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${s.alive ? "bg-accent" : "bg-text-subtle"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "ports" && (
        <div className="space-y-4">
          {Array.from(new Set(ports.map((p) => p.host))).map((host) => (
            <Card key={host} className="bg-bg-elevated border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-subtle border-b border-border">
                <Server className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-sm font-mono text-text-primary">{host}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-text-muted uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">Port</th>
                    <th className="px-4 py-2 text-left">Service</th>
                    <th className="px-4 py-2 text-left">Version</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ports.filter((p) => p.host === host).map((p, i) => (
                    <tr key={i} className="hover:bg-bg-overlay">
                      <td className="px-4 py-2 font-mono text-xs">{p.port}</td>
                      <td className="px-4 py-2 text-text-secondary">{p.service}</td>
                      <td className="px-4 py-2 text-text-muted">{p.version || "-"}</td>
                      <td className="px-4 py-2">
                        <span className={`badge text-xs ${p.status === "open" ? "bg-severity-high/10 text-severity-high" : "bg-bg-subtle text-text-muted"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "urls" && (
        <Card className="bg-bg-elevated border border-border overflow-hidden">
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
              {urls.map((u, i) => (
                <tr key={i} className="hover:bg-bg-overlay">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary max-w-[400px] truncate">{u.url}</td>
                  <td className="px-4 py-2.5">
                    <span className="badge bg-bg-subtle text-text-muted text-xs">{u.method}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-xs ${u.status < 300 ? "bg-accent-muted text-accent" : "bg-severity-high/10 text-severity-high"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{u.source}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "screenshots" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "www.uber.com", url: "https://www.uber.com" },
            { label: "auth.uber.com", url: "https://auth.uber.com" },
            { label: "api.uber.com", url: "https://api.uber.com" },
            { label: "developers.uber.com", url: "https://developers.uber.com" },
          ].map((s) => (
            <Card key={s.label} className="bg-bg-elevated border border-border overflow-hidden">
              <div className="aspect-video bg-bg-subtle flex items-center justify-center text-text-muted">
                <Image className="w-8 h-8" />
              </div>
              <div className="p-2.5 text-xs text-text-secondary truncate">{s.label}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
