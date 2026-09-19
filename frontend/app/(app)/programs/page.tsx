"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Globe, Shield, Clock, Users, Target, Search, X } from "lucide-react"
import { ProgramForm } from "@/components/programs/ProgramForm"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

type Tab = "all" | "active" | "archived"

const initialPrograms = [
  { id: "1", name: "Uber", platform: "HackerOne", status: "active", targets: 142, lastScan: "2m ago", url: "https://hackerone.com/uber" },
  { id: "2", name: "Airbnb", platform: "Bugcrowd", status: "active", targets: 89, lastScan: "15m ago", url: "https://bugcrowd.com/airbnb" },
  { id: "3", name: "Twitter", platform: "HackerOne", status: "active", targets: 203, lastScan: "1h ago", url: "https://hackerone.com/twitter" },
  { id: "4", name: "Dropbox", platform: "Bugcrowd", status: "active", targets: 67, lastScan: "3h ago", url: "https://bugcrowd.com/dropbox" },
  { id: "5", name: "Shopify", platform: "HackerOne", status: "active", targets: 178, lastScan: "30m ago", url: "https://hackerone.com/shopify" },
  { id: "6", name: "Reddit", platform: "HackerOne", status: "archived", targets: 54, lastScan: "2d ago", url: "https://hackerone.com/reddit" },
]

export default function ProgramsPage() {
  const { toast } = useToast()
  const [programsList, setProgramsList] = useState(initialPrograms)
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = programsList
    .filter((p) => activeTab === "all" || p.status === activeTab)
    .filter((p) => platformFilter === "all" || p.platform.toLowerCase() === platformFilter.toLowerCase())
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const handleCreateProgram = async (data: any) => {
    const platformLabel =
      data.platform === "h1" ? "HackerOne" :
      data.platform === "bugcrowd" ? "Bugcrowd" :
      data.platform === "intigriti" ? "Intigriti" :
      data.platform === "synack" ? "Synack" : "Other"

    const newProg = {
      id: String(Date.now()),
      name: data.name,
      platform: platformLabel,
      status: "active",
      targets: 0,
      lastScan: "Just now",
      url: data.programUrl || "#",
    }
    setProgramsList([newProg, ...programsList])
    setShowAddModal(false)
    toast({
      title: "Program registered",
      description: `${data.name} has been enrolled in Bounty-OS.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
            <Target className="w-6 h-6 text-primary" /> Target Programs
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {filtered.length} targets configured for asset enumeration and vulnerability checks
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" /> New Program
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search programs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-xl border border-border">
          {(["all", "active", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all duration-150",
                activeTab === tab
                  ? "bg-bg-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Platform Filter */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-xl border border-border text-xs">
          {["all", "HackerOne", "Bugcrowd", "Intigriti"].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150",
                platformFilter === p
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((program) => (
          <Link key={program.id} href={`/programs/${program.id}`}>
            <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-all duration-200 cursor-pointer group h-full flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-subtle flex items-center justify-center font-bold text-lg text-primary group-hover:scale-105 transition-transform">
                      {program.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary text-base group-hover:text-primary transition-colors">
                        {program.name}
                      </h3>
                      <span className="badge bg-primary-muted text-primary text-[11px] mt-0.5 inline-block">
                        {program.platform}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "badge text-xs capitalize",
                      program.status === "active" ? "bg-accent-muted text-accent" : "bg-bg-subtle text-text-muted"
                    )}
                  >
                    {program.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-text-muted pt-4 border-t border-border mt-3">
                <span className="flex items-center gap-1.5 font-medium">
                  <Globe className="w-3.5 h-3.5 text-text-secondary" /> {program.targets} targets
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-text-secondary" /> {program.lastScan}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <ProgramForm onSubmit={handleCreateProgram} onCancel={() => setShowAddModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
