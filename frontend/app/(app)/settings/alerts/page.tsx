"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Bell, MessageCircle, Mail, Send, CheckCircle2 } from "lucide-react"

const severities = ["critical", "high", "medium", "low", "info"] as const

export default function AlertsSettingsPage() {
  const [discordUrls, setDiscordUrls] = useState<Record<string, string>>({
    critical: "https://discord.com/api/webhooks/.../critical",
    high: "https://discord.com/api/webhooks/.../high",
    medium: "",
    low: "",
    info: "",
  })
  const [slackUrls, setSlackUrls] = useState<Record<string, string>>({
    critical: "",
    high: "",
    medium: "",
    low: "",
    info: "",
  })
  const [smtp, setSmtp] = useState({
    host: "smtp.example.com",
    port: "587",
    user: "alerts@bountyos.local",
    pass: "",
    from: "alerts@bountyos.local",
  })
  const [tested, setTested] = useState<string | null>(null)

  function testAlert(channel: string) {
    setTested(channel)
    setTimeout(() => setTested(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-text-muted mb-1">
          <a href="/settings" className="hover:text-text-primary">Settings</a> / Alerts
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Alert Configuration</h1>
      </div>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Discord Webhooks</h2>
        </div>
        <div className="space-y-3">
          {severities.map((sev) => (
            <div key={sev} className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium text-text-secondary capitalize">{sev}</span>
              <Input
                value={discordUrls[sev]}
                onChange={(e) => setDiscordUrls((prev) => ({ ...prev, [sev]: e.target.value }))}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 font-mono text-xs"
              />
              <Button variant="ghost" size="sm" onClick={() => testAlert(`discord-${sev}`)} className="flex-shrink-0">
                {tested === `discord-${sev}` ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Test
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Slack Webhooks</h2>
        </div>
        <div className="space-y-3">
          {severities.map((sev) => (
            <div key={sev} className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium text-text-secondary capitalize">{sev}</span>
              <Input
                value={slackUrls[sev]}
                onChange={(e) => setSlackUrls((prev) => ({ ...prev, [sev]: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 font-mono text-xs"
              />
              <Button variant="ghost" size="sm" onClick={() => testAlert(`slack-${sev}`)} className="flex-shrink-0">
                {tested === `slack-${sev}` ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Test
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-severity-medium" />
          <h2 className="text-sm font-semibold text-text-primary">Email (SMTP)</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">SMTP Host</label>
            <Input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">Port</label>
            <Input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">Username</label>
            <Input value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">Password</label>
            <Input type="password" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-xs text-text-muted">From Address</label>
            <Input value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={() => testAlert("email")}>
            {tested === "email" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent mr-1" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1" />
            )}
            Test Email
          </Button>
        </div>
      </Card>
    </div>
  )
}
