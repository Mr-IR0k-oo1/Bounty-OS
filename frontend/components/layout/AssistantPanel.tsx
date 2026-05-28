"use client"

import { useState } from "react"
import { PanelRightClose, FileText, Target, AlertTriangle, Braces, Wrench, Search, Download, ChevronDown, Copy, Save, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  { icon: FileText, label: "Draft Full Report", primary: true, desc: "Generate a complete security report" },
  { icon: Target, label: "Write Impact Statement", desc: "Describe business impact and risk" },
  { icon: AlertTriangle, label: "Reproduction Steps", desc: "Step-by-step PoC walkthrough" },
  { icon: Braces, label: "CVSS Calculator", desc: "Calculate severity score" },
  { icon: Wrench, label: "Remediation Suggestion", desc: "How to fix the vulnerability" },
  { icon: Search, label: "Similar in DB", desc: "Find similar past findings" },
  { icon: Download, label: "Export for Platform", desc: "Format for H1, Bugcrowd, etc." },
]

const platforms = ["HackerOne", "Bugcrowd", "Intigriti", "Synack", "Generic"]

export default function AssistantPanel({ onClose }: { onClose?: () => void }) {
  const [selectedPlatform, setSelectedPlatform] = useState(0)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<number | null>(null)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-text-primary">Assistant</span>
          <span className="text-[10px] text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded-full">context-aware</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        <div>
          <div className="text-xs text-text-muted font-medium mb-1">Report Builder</div>
          <div className="text-xs text-text-secondary mb-3 leading-relaxed">
            Select a finding to generate platform-specific reports, impact statements, and remediation guides.
          </div>

          {/* Platform Selector */}
          <div className="relative mb-3">
            <button
              onClick={() => setPlatformOpen(!platformOpen)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border bg-bg-overlay text-sm text-text-primary hover:border-primary/30 transition-fast"
            >
              {platforms[selectedPlatform]}
              <ChevronDown className={cn("w-3.5 h-3.5 text-text-muted transition-transform duration-200", platformOpen && "rotate-180")} />
            </button>
            {platformOpen && (
              <div className="absolute top-full mt-1 w-full rounded-lg border border-border bg-bg-elevated shadow-lg py-1 z-10 animate-in fade-in slide-in-from-top-1 duration-150">
                {platforms.map((p, i) => (
                  <button
                    key={p}
                    onClick={() => { setSelectedPlatform(i); setPlatformOpen(false) }}
                    className={cn(
                      "w-full px-3 py-1.5 text-sm text-left hover:bg-bg-overlay transition-fast",
                      i === selectedPlatform ? "text-primary font-medium" : "text-text-secondary"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5">
            {actions.map((action, i) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => setActiveAction(activeAction === i ? null : i)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                    activeAction === i
                      ? "bg-primary-muted text-primary border border-primary/30"
                      : action.primary
                        ? "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
                        : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary border border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <div>{action.label}</div>
                    {activeAction === i && (
                      <div className="text-[10px] text-text-muted mt-0.5">{action.desc}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Output Area */}
        <div className="rounded-lg border border-border bg-bg-base overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-subtle/50">
            <span className="text-xs font-medium text-text-muted">Output</span>
            <div className="flex items-center gap-0.5">
              <button className="p-1 rounded text-text-subtle hover:text-text-muted hover:bg-bg-overlay transition-fast" title="Copy">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 rounded text-text-subtle hover:text-text-muted hover:bg-bg-overlay transition-fast" title="Save">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="px-3 py-3 text-xs text-text-muted leading-relaxed min-h-[100px] font-mono">
            {activeAction !== null ? (
              <span className="text-text-secondary animate-in fade-in duration-200">
                Generating {actions[activeAction].label.toLowerCase()} for {platforms[selectedPlatform]}...
              </span>
            ) : (
              <span className="text-text-subtle italic">
                Select a template action above to generate content...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Context */}
      <div className="p-3 border-t border-border shrink-0 bg-bg-base/50">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1.5">
            {["#f85149", "#e8912d", "#58a6ff", "#3fb950"].map((color, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2 border-bg-elevated"
                style={{ background: color }}
              />
            ))}
          </div>
          <div>
            <div className="text-xs text-text-muted">
              <span className="font-medium text-text-primary">4</span> findings selected
            </div>
            <div className="text-[10px] text-text-subtle">Uber, Airbnb, Twitter + 1</div>
          </div>
        </div>
      </div>
    </div>
  )
}
