"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Globe, Shield, Clock, Users } from "lucide-react"
import Link from "next/link"

type Tab = "all" | "active" | "archived"

const programs = [
  { id: "1", name: "Uber", platform: "HackerOne", status: "active", targets: 142, lastScan: "2m ago" },
  { id: "2", name: "Airbnb", platform: "Bugcrowd", status: "active", targets: 89, lastScan: "15m ago" },
  { id: "3", name: "Twitter", platform: "HackerOne", status: "active", targets: 203, lastScan: "1h ago" },
  { id: "4", name: "Dropbox", platform: "Bugcrowd", status: "active", targets: 67, lastScan: "3h ago" },
  { id: "5", name: "Shopify", platform: "HackerOne", status: "active", targets: 178, lastScan: "30m ago" },
  { id: "6", name: "Reddit", platform: "HackerOne", status: "archived", targets: 54, lastScan: "2d ago" },
]

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all")

  const filtered = activeTab === "all" ? programs : programs.filter((p) => p.status === activeTab)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Programs</h1>
        <Button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Program
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-bg-subtle rounded-md w-fit">
        {(["all", "active", "archived"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize ${
              activeTab === tab ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((program) => (
          <Link key={program.id} href={`/programs/${program.id}`}>
            <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-text-primary">{program.name}</h3>
                  <span className="badge bg-primary-muted text-primary text-xs mt-1 inline-block">{program.platform}</span>
                </div>
                <span
                  className={`badge text-xs ${
                    program.status === "active"
                      ? "bg-accent-muted text-accent"
                      : "bg-bg-subtle text-text-muted"
                  }`}
                >
                  {program.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {program.targets} targets</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {program.lastScan}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
