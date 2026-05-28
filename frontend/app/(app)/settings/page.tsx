"use client"

import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import {
  Wrench, FileText, Bell, Clock, Key, Shield, Users,
  ChevronRight
} from "lucide-react"

const sections = [
  { key: "tools", label: "Tools", desc: "Configure scanner tools and paths", icon: Wrench, href: "/settings/tools" },
  { key: "wordlists", label: "Wordlists", desc: "Manage wordlist file paths", icon: FileText, href: "/settings/wordlists" },
  { key: "alerts", label: "Alerts", desc: "Configure webhook and email alerts", icon: Bell, href: "/settings/alerts" },
  { key: "schedule", label: "Schedule", desc: "Scan scheduling and quiet hours", icon: Clock, href: "/settings/schedule" },
  { key: "tokens", label: "Tokens", desc: "API token management", icon: Key, href: "/settings/tokens" },
  { key: "security", label: "Security", desc: "Password, 2FA, active sessions", icon: Shield, href: "/settings/security" },
  { key: "hunters", label: "Hunters", desc: "Manage team members", icon: Users, href: "/hunters" },
]

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage your BountyOS configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <Card
            key={section.key}
            className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer flex items-start gap-4"
            onClick={() => router.push(section.href)}
          >
            <div className="w-10 h-10 rounded-lg bg-bg-subtle flex items-center justify-center flex-shrink-0">
              <section.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">{section.label}</h3>
              <p className="text-xs text-text-muted mt-0.5">{section.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 mt-1" />
          </Card>
        ))}
      </div>
    </div>
  )
}
