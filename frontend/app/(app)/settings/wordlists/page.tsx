"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FileText, FolderOpen, Eye } from "lucide-react"

type Wordlist = {
  id: string
  name: string
  category: string
  path: string
  lines: string
  size: string
}

const initialWordlists: Wordlist[] = [
  { id: "w1", name: "subdomains.txt", category: "Content Discovery", path: "/opt/wordlists/subdomains.txt", lines: "1,024,000", size: "12.4 MB" },
  { id: "w2", name: "dns-all.txt", category: "DNS", path: "/opt/wordlists/dns-all.txt", lines: "2,500,000", size: "28.1 MB" },
  { id: "w3", name: "params.txt", category: "Parameters", path: "/opt/wordlists/params.txt", lines: "12,500", size: "156 KB" },
  { id: "w4", name: "passwords.txt", category: "Passwords", path: "/opt/wordlists/passwords.txt", lines: "500,000", size: "6.2 MB" },
]

export default function WordlistsSettingsPage() {
  const [wordlists, setWordlists] = useState(initialWordlists)

  function updatePath(id: string, path: string) {
    setWordlists((prev) => prev.map((w) => (w.id === id ? { ...w, path } : w)))
  }

  const categories = Array.from(new Set(wordlists.map((w) => w.category)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary">Settings</a> / Wordlists
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Wordlist Paths</h1>
        </div>
        <Button variant="ghost" className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Browse...
        </Button>
      </div>

      {categories.map((category) => (
        <Card key={category} className="bg-bg-elevated border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-bg-subtle border-b border-border">
            <h2 className="text-xs font-semibold text-text-muted uppercase">{category}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-text-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-4 py-2.5 text-left">Path</th>
                <th className="px-4 py-2.5 text-left">Lines</th>
                <th className="px-4 py-2.5 text-left">Size</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wordlists
                .filter((w) => w.category === category)
                .map((wl) => (
                  <tr key={wl.id} className="hover:bg-bg-overlay">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-text-muted" />
                        <span className="font-mono text-xs text-text-primary">{wl.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        value={wl.path}
                        onChange={(e) => updatePath(wl.id, e.target.value)}
                        className="font-mono text-xs h-8"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{wl.lines}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{wl.size}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}
