"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FileText, FolderOpen, Eye, Save, X } from "lucide-react"
import { useToast } from "@/hooks/useToast"

type Wordlist = {
  id: string
  name: string
  category: string
  path: string
  lines: string
  size: string
  sample: string[]
}

const initialWordlists: Wordlist[] = [
  { 
    id: "w1", 
    name: "subdomains-top1mil.txt", 
    category: "Subdomain Enumeration", 
    path: "/opt/wordlists/subdomains.txt", 
    lines: "1,024,000", 
    size: "12.4 MB",
    sample: ["api", "dev", "admin", "auth", "vpn", "staging", "internal", "mail", "corp", "portal", "test", "v1", "v2", "graphql", "gateway"]
  },
  { 
    id: "w2", 
    name: "resolvers-trusted.txt", 
    category: "DNS Resolvers", 
    path: "/opt/wordlists/dns-all.txt", 
    lines: "2,500,000", 
    size: "28.1 MB",
    sample: ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9", "149.112.112.112", "208.67.222.222"]
  },
  { 
    id: "w3", 
    name: "burp-parameter-names.txt", 
    category: "Parameters", 
    path: "/opt/wordlists/params.txt", 
    lines: "12,500", 
    size: "156 KB",
    sample: ["id", "user", "username", "token", "redirect_uri", "url", "callback", "action", "cmd", "file", "path", "query", "debug", "admin", "role"]
  },
  { 
    id: "w4", 
    name: "seclists-common-passwords.txt", 
    category: "Passwords & Brute", 
    path: "/opt/wordlists/passwords.txt", 
    lines: "500,000", 
    size: "6.2 MB",
    sample: ["admin", "password", "123456", "root", "toor", "guest", "operator", "letmein", "welcome", "changeme"]
  },
]

export default function WordlistsSettingsPage() {
  const { toast } = useToast()
  const [wordlists, setWordlists] = useState(initialWordlists)
  const [previewingWl, setPreviewingWl] = useState<Wordlist | null>(null)

  function updatePath(id: string, path: string) {
    setWordlists((prev) => prev.map((w) => (w.id === id ? { ...w, path } : w)))
  }

  function handleSaveAll() {
    toast({ title: "Wordlist Paths Saved", description: "Updated wordlist paths for scanning engines." })
  }

  function handleBrowse() {
    toast({ title: "File Browser", description: "Browsing host volume: /opt/wordlists/" })
  }

  const categories = Array.from(new Set(wordlists.map((w) => w.category)))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary transition-colors">Settings</a> / Wordlists
          </div>
          <h1 className="text-xl font-bold text-text-primary">Discovery Wordlists</h1>
          <p className="text-xs text-text-muted mt-0.5">Configure dictionary dictionaries, DNS resolvers, and parameter wordlists.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleBrowse}
            variant="outline"
            size="sm"
            className="text-xs border-border bg-bg-elevated"
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Browse Filesystem
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

      {categories.map((category) => (
        <Card key={category} className="bg-bg-elevated border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-bg-subtle/70 border-b border-border">
            <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{category}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-text-muted uppercase text-[10px] font-bold border-b border-border/40">
              <tr>
                <th className="px-4 py-2.5 text-left">Dictionary Filename</th>
                <th className="px-4 py-2.5 text-left">Container Mount Path</th>
                <th className="px-4 py-2.5 text-left">Line Count</th>
                <th className="px-4 py-2.5 text-left">File Size</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {wordlists
                .filter((w) => w.category === category)
                .map((wl) => (
                  <tr key={wl.id} className="hover:bg-bg-overlay/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-mono text-xs text-text-primary font-medium">{wl.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        value={wl.path}
                        onChange={(e) => updatePath(wl.id, e.target.value)}
                        className="font-mono text-xs h-7 bg-bg-subtle border-border max-w-sm"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{wl.lines}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{wl.size}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewingWl(wl)}
                        className="text-xs border-border bg-bg-subtle hover:bg-bg-overlay h-7"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Preview Lines
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ))}

      {/* Preview Modal */}
      {previewingWl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-lg bg-bg-elevated border border-border shadow-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary font-mono">{previewingWl.name}</h3>
                <span className="badge bg-primary-muted text-primary text-[10px]">{previewingWl.lines} lines</span>
              </div>
              <button
                onClick={() => setPreviewingWl(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-text-muted">First 15 entries sampled from {previewingWl.path}:</div>
              <pre className="p-4 rounded-xl bg-bg-base border border-border font-mono text-xs text-text-secondary max-h-60 overflow-y-auto leading-relaxed">
                {previewingWl.sample.join("\n")}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <Button size="sm" onClick={() => setPreviewingWl(null)} className="text-xs">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

