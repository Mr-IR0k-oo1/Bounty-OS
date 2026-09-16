"use client"

import { cn } from "@/lib/utils"
import { Shield, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, Info } from "lucide-react"

export interface TriageBadgeProps {
  findingType: string
  confidence: number // 0.0 – 1.0
  severity: string
  className?: string
  compact?: boolean
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  critical: { label: "Critical", color: "text-danger bg-danger/10 border-danger/30", icon: ShieldAlert },
  high:     { label: "High",     color: "text-warning bg-warning/10 border-warning/30", icon: ShieldAlert },
  medium:   { label: "Medium",   color: "text-info bg-info/10 border-info/30",     icon: Shield },
  low:      { label: "Low",      color: "text-success bg-success/10 border-success/30", icon: ShieldCheck },
  info:     { label: "Info",     color: "text-text-muted bg-bg-overlay border-border",  icon: Info },
  fp:       { label: "False Positive", color: "text-text-subtle bg-bg-overlay border-border", icon: ShieldOff },
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.70) return "text-success"
  if (confidence >= 0.40) return "text-warning"
  return "text-danger"
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.70) return "bg-success"
  if (confidence >= 0.40) return "bg-warning"
  return "bg-danger"
}

export function TriageBadge({ findingType, confidence, severity, className, compact = false }: TriageBadgeProps) {
  const sev = SEVERITY_CONFIG[severity?.toLowerCase()] ?? SEVERITY_CONFIG.info
  const SevIcon = sev.icon
  const confidencePct = Math.round(confidence * 100)
  const clampedPct = Math.max(0, Math.min(100, confidencePct))

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border", sev.color)}>
          <SevIcon className="w-2.5 h-2.5" />
          {sev.label}
        </span>
        <span className={cn("text-[10px] font-medium tabular-nums", getConfidenceColor(confidence))}>
          {clampedPct}%
        </span>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border bg-bg-surface p-3 space-y-3", className)}>
      {/* Finding type + severity row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SevIcon className={cn("w-4 h-4 shrink-0", sev.color.split(" ")[0])} />
          <span className="text-sm font-semibold text-text-primary truncate">{findingType}</span>
        </div>
        <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", sev.color)}>
          {sev.label}
        </span>
      </div>

      {/* Confidence meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">AI Confidence</span>
          <span className={cn("text-[11px] font-semibold tabular-nums", getConfidenceColor(confidence))}>
            {clampedPct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-overlay overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700 ease-out", getConfidenceBg(confidence))}
            style={{ width: `${clampedPct}%` }}
          />
        </div>
        <div className="text-[10px] text-text-subtle">
          {confidence >= 0.70
            ? "High confidence — review recommended"
            : confidence >= 0.40
              ? "Medium confidence — additional evidence needed"
              : "Low confidence — manual investigation required"}
        </div>
      </div>
    </div>
  )
}
