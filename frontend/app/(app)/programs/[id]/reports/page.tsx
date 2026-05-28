"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, FileText, AlertTriangle, CheckCircle2 } from "lucide-react"

type Report = {
  id: string
  title: string
  template: string
  findings: number
  created: string
  downloaded: boolean
}

const initialReports: Report[] = [
  { id: "r1", title: "Uber Q1 2025 Recon Report", template: "recon_summary", findings: 24, created: "2025-04-01", downloaded: true },
  { id: "r2", title: "Uber Active Scan - April", template: "vulnerability_report", findings: 12, created: "2025-04-10", downloaded: false },
  { id: "r3", title: "Uber Compliance Audit", template: "compliance", findings: 8, created: "2025-04-12", downloaded: false },
]

export default function ProgramReportsPage() {
  const params = useParams()
  const [reports, setReports] = useState(initialReports)
  const [showGenerator, setShowGenerator] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/programs/${params.id}`} className="hover:text-text-primary">Program</a>
        <span>/</span>
        <span className="text-text-primary">Reports</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Reports</h1>
        <Button onClick={() => setShowGenerator(!showGenerator)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      {showGenerator && (
        <Card className="p-5 bg-bg-elevated border border-border space-y-5">
          <h2 className="text-sm font-semibold text-text-primary">New Report</h2>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase">Select Findings</h3>
            <div className="flex flex-wrap gap-2">
              {["Critical (3)", "High (5)", "Medium (8)", "Low (6)", "Info (2)"].map((f) => (
                <button key={f} className="px-3 py-1.5 rounded-md border border-border bg-bg-subtle text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors">
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase">Template</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: "Recon Summary", desc: "Subdomains, ports, URLs", icon: FileText },
                { name: "Vulnerability Report", desc: "Findings with PoC details", icon: AlertTriangle },
                { name: "Compliance", desc: "PCI-DSS / SOC2 mapping", icon: CheckCircle2 },
              ].map((t) => (
                <button key={t.name} className="p-3 rounded-md border border-border bg-bg-subtle text-left hover:border-primary transition-colors">
                  <t.icon className="w-4 h-4 text-text-muted mb-1.5" />
                  <div className="text-sm font-medium text-text-primary">{t.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowGenerator(false)}>Cancel</Button>
            <Button>Generate</Button>
          </div>
        </Card>
      )}

      {reports.map((report) => (
        <Card key={report.id} className="p-4 bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-primary-muted flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{report.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>{report.template.replace("_", " ")}</span>
                  <span>{report.findings} findings</span>
                  <span>{report.created}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {report.downloaded && (
                <span className="text-xs text-accent flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Downloaded
                </span>
              )}
              <Button variant="ghost" size="sm">
                <Eye className="w-3.5 h-3.5 mr-1" /> Preview
              </Button>
              <Button variant="ghost" size="sm">
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
