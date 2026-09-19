"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Clock, SlidersHorizontal, Moon, Sun, Save, Check, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/useToast"

const defaultPrograms = [
  { id: "p1", name: "Uber", interval: 24, override: true },
  { id: "p2", name: "Airbnb", interval: 48, override: false },
  { id: "p3", name: "Twitter", interval: 12, override: true },
  { id: "p4", name: "Dropbox", interval: 72, override: false },
  { id: "p5", name: "Shopify", interval: 24, override: true },
]

export default function ScheduleSettingsPage() {
  const { toast } = useToast()
  const [globalInterval, setGlobalInterval] = useState(24)
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("07:00")
  const [programOverrides, setProgramOverrides] = useState(defaultPrograms)
  const [isSaved, setIsSaved] = useState(false)

  function toggleOverride(id: string) {
    setProgramOverrides((prev) => prev.map((p) => (p.id === id ? { ...p, override: !p.override } : p)))
  }

  function updateInterval(id: string, interval: number) {
    setProgramOverrides((prev) => prev.map((p) => (p.id === id ? { ...p, interval } : p)))
  }

  function handleSave() {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
    toast({
      title: "Schedule Saved",
      description: `Global rescan: ${globalInterval}h. Quiet hours: ${quietStart} - ${quietEnd}. ${programOverrides.filter(p => p.override).length} overrides active.`,
    })
  }

  function handleReset() {
    setGlobalInterval(24)
    setQuietStart("22:00")
    setQuietEnd("07:00")
    setProgramOverrides(defaultPrograms)
    toast({
      title: "Schedule Reset",
      description: "Default cron schedules and quiet hours restored.",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-muted mb-1">
            <a href="/settings" className="hover:text-text-primary">Settings</a> / Schedule
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Scan Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="border-border text-text-muted hover:text-text-primary">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary-hover text-bg font-semibold">
            {isSaved ? (
              <>
                <Check className="w-4 h-4 mr-1.5 text-bg" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save Schedule
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Global Rescan Interval</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <input
              type="range"
              min={1}
              max={72}
              value={globalInterval}
              onChange={(e) => setGlobalInterval(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-sm font-mono text-text-primary w-16 text-right">{globalInterval}h</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <span>1h</span>
            <span>12h</span>
            <span>24h</span>
            <span>48h</span>
            <span>72h</span>
          </div>
        </div>
      </Card>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-4 h-4 text-severity-medium" />
          <h2 className="text-sm font-semibold text-text-primary">Quiet Hours</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">Start</label>
            <Input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="w-32 font-mono text-xs"
            />
          </div>
          <span className="text-text-muted">to</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">End</label>
            <Input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="w-32 font-mono text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3">No scans will be started during quiet hours. Running scans will continue.</p>
      </Card>

      <Card className="bg-bg-elevated border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-bg-subtle border-b border-border">
          <h2 className="text-xs font-semibold text-text-muted uppercase">Per-Program Overrides</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-text-muted uppercase text-xs">
            <tr>
              <th className="px-4 py-2.5 text-left">Program</th>
              <th className="px-4 py-2.5 text-left">Interval</th>
              <th className="px-4 py-2.5 text-left">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {programOverrides.map((p) => (
              <tr key={p.id} className="hover:bg-bg-overlay">
                <td className="px-4 py-2.5 text-text-primary">{p.name}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={72}
                      value={p.interval}
                      onChange={(e) => updateInterval(p.id, Number(e.target.value))}
                      disabled={!p.override}
                      className="w-32 accent-primary"
                    />
                    <span className="text-xs font-mono text-text-primary w-12">{p.interval}h</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleOverride(p.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.override ? "bg-primary" : "bg-bg-subtle"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${p.override ? "translate-x-4.5" : "translate-x-1"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
