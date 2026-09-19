"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Key, Plus, Copy, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/useToast"

type ApiToken = {
  id: string
  name: string
  created: string
  lastUsed: string
  expires: string
  active: boolean
}

const initialTokens: ApiToken[] = [
  { id: "t1", name: "CI/CD Pipeline", created: "2025-01-15", lastUsed: "2h ago", expires: "2026-01-15", active: true },
  { id: "t2", name: "Automation Script", created: "2025-02-20", lastUsed: "1d ago", expires: "2026-02-20", active: true },
  { id: "t3", name: "Legacy Integration", created: "2024-06-01", lastUsed: "30d ago", expires: "2025-06-01", active: false },
]

export default function TokensSettingsPage() {
  const { toast } = useToast()
  const [tokens, setTokens] = useState(initialTokens)
  const [showGenerate, setShowGenerate] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showToken, setShowToken] = useState(false)

  function generateToken() {
    const fakeToken = "bos_" + Array.from({ length: 48 }, () => Math.random().toString(36)[2]).join("")
    setGeneratedToken(fakeToken)

    const newTokenItem: ApiToken = {
      id: "t" + Date.now(),
      name: newTokenName || "API Token",
      created: "Today",
      lastUsed: "Never",
      expires: "1 Year",
      active: true
    }
    setTokens(prev => [newTokenItem, ...prev])
    toast({ title: "Token Generated", description: `API token "${newTokenItem.name}" is now active.` })
  }

  function copyToken() {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copied", description: "API token copied to clipboard." })
    }
  }

  function revokeToken(id: string) {
    const token = tokens.find(t => t.id === id)
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, active: false } : t)))
    toast({ title: "Token Revoked", description: `Token "${token?.name || id}" has been revoked.` })
  }

  function closeGenerator() {
    setShowGenerate(false)
    setGeneratedToken(null)
    setNewTokenName("")
    setCopied(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary">Settings</a> / Tokens
          </div>
          <h1 className="text-2xl font-bold text-text-primary">API Tokens</h1>
        </div>
        <Button onClick={() => setShowGenerate(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Generate New Token
        </Button>
      </div>

      <Card className="bg-bg-elevated border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Last Used</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tokens.map((t) => (
              <tr key={t.id} className="hover:bg-bg-overlay">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-text-muted" />
                    <span className="text-text-primary">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted text-xs">{t.created}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{t.lastUsed}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{t.expires}</td>
                <td className="px-4 py-3">
                  {t.active ? (
                    <span className="flex items-center gap-1.5 text-xs text-accent">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-text-muted">
                      <XCircle className="w-3.5 h-3.5" /> Revoked
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.active && (
                    <Button variant="ghost" size="sm" onClick={() => revokeToken(t.id)} className="text-severity-high hover:text-severity-high">
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showGenerate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={closeGenerator}>
          <Card className="w-full max-w-md p-6 bg-bg-elevated border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Generate New Token</h2>

            {!generatedToken ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-text-secondary">Token Name</label>
                  <Input
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g., CI/CD Pipeline"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={closeGenerator}>Cancel</Button>
                  <Button onClick={generateToken} disabled={!newTokenName}>Generate</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-severity-high bg-severity-high/10 border border-severity-high/30 rounded-md p-3">
                  Make sure to copy your token now. You won&apos;t be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={generatedToken}
                      readOnly
                      type={showToken ? "text" : "password"}
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={copyToken}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button onClick={closeGenerator}>Done</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
