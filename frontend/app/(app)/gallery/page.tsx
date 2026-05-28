"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Image, X, ChevronLeft, ChevronRight, Calendar, Filter } from "lucide-react"

const screenshots = [
  { id: "s1", label: "www.uber.com", program: "Uber", date: "2025-04-10", url: "#" },
  { id: "s2", label: "auth.uber.com/login", program: "Uber", date: "2025-04-10", url: "#" },
  { id: "s3", label: "api.uber.com/docs", program: "Uber", date: "2025-04-09", url: "#" },
  { id: "s4", label: "developers.uber.com", program: "Uber", date: "2025-04-09", url: "#" },
  { id: "s5", label: "www.airbnb.com", program: "Airbnb", date: "2025-04-08", url: "#" },
  { id: "s6", label: "api.airbnb.com", program: "Airbnb", date: "2025-04-08", url: "#" },
  { id: "s7", label: "www.twitter.com", program: "Twitter", date: "2025-04-07", url: "#" },
  { id: "s8", label: "developer.twitter.com", program: "Twitter", date: "2025-04-07", url: "#" },
  { id: "s9", label: "www.shopify.com", program: "Shopify", date: "2025-04-06", url: "#" },
  { id: "s10", label: "admin.shopify.com", program: "Shopify", date: "2025-04-06", url: "#" },
  { id: "s11", label: "www.dropbox.com", program: "Dropbox", date: "2025-04-05", url: "#" },
  { id: "s12", label: "api.dropbox.com", program: "Dropbox", date: "2025-04-05", url: "#" },
]

export default function GalleryPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [programFilter, setProgramFilter] = useState("all")

  const programs = Array.from(new Set(screenshots.map((s) => s.program)))
  const filtered = programFilter === "all" ? screenshots : screenshots.filter((s) => s.program === programFilter)

  const currentIndex = selected ? filtered.findIndex((s) => s.id === selected) : -1

  function navigate(dir: "prev" | "next") {
    if (currentIndex === -1) return
    const next = dir === "prev" ? currentIndex - 1 : currentIndex + 1
    if (next >= 0 && next < filtered.length) {
      setSelected(filtered[next].id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Screenshot Gallery</h1>
        <div className="flex items-center gap-3">
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm"><Filter className="w-3.5 h-3.5 mr-1" /> More Filters</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((s) => (
          <Card
            key={s.id}
            className="bg-bg-elevated border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelected(s.id)}
          >
            <div className="aspect-video bg-bg-subtle flex items-center justify-center text-text-muted relative group">
              <Image className="w-10 h-10 opacity-40" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">View</span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm text-text-primary truncate">{s.label}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="badge bg-primary-muted text-primary text-xs">{s.program}</span>
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {s.date}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-video bg-bg-elevated rounded-lg border border-border flex items-center justify-center">
              <Image className="w-20 h-20 text-text-muted opacity-30" />
            </div>

            <div className="flex items-center justify-between mt-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("prev")} disabled={currentIndex <= 0}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-white/70">
                {currentIndex + 1} / {filtered.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate("next")} disabled={currentIndex >= filtered.length - 1}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {selected && (
              <p className="text-sm text-white/60 text-center mt-2">
                {filtered.find((s) => s.id === selected)?.label}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
