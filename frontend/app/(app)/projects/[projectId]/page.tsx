"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FolderKanban, Globe, Bug, Users, FileText, Clock, TrendingUp, Activity } from "lucide-react"

export default function ProjectOverviewPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [activeTab, setActiveTab] = useState("overview")

  const tabs = ["Overview", "Programs", "Notes", "Timeline", "Team"]

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-muted mb-1">
            <a href="/projects" className="hover:text-text-primary">Projects</a>
            <span className="mx-2">/</span>
            <span className="text-text-primary">Q1 2025 Engagements</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-primary" />
            Q1 2025 Engagements
            <span className="badge bg-accent-muted text-accent text-xs">Active</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost">Edit</Button>
          <Button className="btn-primary">Archive Project</Button>
        </div>
      </header>

      <div className="flex gap-1 p-1 bg-bg-subtle rounded-md w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              activeTab === tab.toLowerCase()
                ? "bg-bg-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 grid grid-cols-5 gap-4">
          {[
            { label: "Programs", value: "3", icon: Globe },
            { label: "Total Findings", value: "47", icon: Bug },
            { label: "Hunters", value: "4", icon: Users },
            { label: "Submitted", value: "12", icon: FileText },
            { label: "Bounties Earned", value: "$8,500", icon: TrendingUp },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 bg-bg-elevated border border-border">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-text-muted" />
                <span className="text-xs text-text-muted">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
            </Card>
          ))}
        </div>

        <div className="col-span-8 space-y-6">
          <Card className="p-5 bg-bg-elevated border border-border">
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-4">Finding Funnel</h2>
            <div className="space-y-3">
              {[
                { label: "Total Discovered", count: 189, pct: 100 },
                { label: "Validated", count: 47, pct: 25 },
                { label: "Submitted", count: 12, pct: 6 },
                { label: "Accepted", count: 8, pct: 4 },
                { label: "Bounty Paid", count: 5, pct: 3 },
              ].map((stage) => (
                <div key={stage.label} className="flex items-center gap-4">
                  <span className="w-32 text-xs text-text-secondary">{stage.label}</span>
                  <div className="flex-1 h-3 bg-bg-subtle rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${stage.pct}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs font-mono text-text-primary">{stage.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 bg-bg-elevated border border-border">
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-4">Top Unsubmitted Findings</h2>
            <div className="space-y-3">
              {[
                { title: "SSRF in api.uber.com", severity: "critical", hunter: "hunter1" },
                { title: "SQLi in /rides/search", severity: "high", hunter: "hunter2" },
                { title: "XSS in /profile", severity: "medium", hunter: "hunter1" },
                { title: "IDOR in /orders", severity: "high", hunter: "hunter3" },
              ].map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-md bg-bg-subtle">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      f.severity === "critical" ? "bg-severity-critical" :
                      f.severity === "high" ? "bg-severity-high" : "bg-severity-medium"
                    }`} />
                    <span className="text-sm text-text-primary">{f.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge bg-bg-elevated text-text-muted text-xs">{f.hunter}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Submit</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-4 space-y-4">
          <Card className="p-5 bg-bg-elevated border border-border">
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {[
                { icon: Activity, text: "nuclei scan completed on Uber", time: "5m ago", color: "text-accent" },
                { icon: Bug, text: "Critical finding discovered in Uber", time: "15m ago", color: "text-severity-critical" },
                { icon: Globe, text: "Airbnb program added to project", time: "1h ago", color: "text-primary" },
                { icon: TrendingUp, text: "Bounty received: $500 — XSS", time: "3h ago", color: "text-accent" },
                { icon: Users, text: "hunter3 joined the project", time: "1d ago", color: "text-text-muted" },
              ].map((event, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <event.icon className={`w-4 h-4 mt-0.5 ${event.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-secondary text-xs">{event.text}</p>
                    <p className="text-text-muted text-[10px] mt-0.5">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 bg-bg-elevated border border-border">
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Button className="w-full justify-start" variant="ghost" size="sm">
                <Globe className="w-3.5 h-3.5 mr-2" /> Add Program
              </Button>
              <Button className="w-full justify-start" variant="ghost" size="sm">
                <FileText className="w-3.5 h-3.5 mr-2" /> Generate Report
              </Button>
              <Button className="w-full justify-start" variant="ghost" size="sm">
                <Users className="w-3.5 h-3.5 mr-2" /> Invite Hunter
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
