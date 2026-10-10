"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, FileText, AlertTriangle, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import type { Finding } from "@/lib/types"

type Report = {
  id: string
  title: string
  template: string
  findings: number
  created: string
  downloaded: boolean
}

export default function ProgramReportsPage() {
  const params = useParams()
  const programId = params.id as string
  const { toast } = useToast()

  const [reports, setReports] = useState<Report[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("vulnerability_report")

  const fetchProgramData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prog, fList] = await Promise.all([
        api.getProgram(programId),
        api.listProgramFindings(programId),
      ])
      setFindings(fList)
      // Initialize with generated report if findings exist
      if (fList.length > 0) {
        setReports([
          {
            id: `rep-${programId}`,
            title: `${prog.name} Security Assessment Report`,
            template: "vulnerability_report",
            findings: fList.length,
            created: new Date().toLocaleDateString(),
            downloaded: false,
          },
        ])
      }
    } catch (e: any) {
      setError(e.message || "Failed to load program data")
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchProgramData()
  }, [fetchProgramData])

  const criticalCount = findings.filter((f) => (f.severity || "").toLowerCase() === "critical").length
  const highCount = findings.filter((f) => (f.severity || "").toLowerCase() === "high").length
  const medCount = findings.filter((f) => (f.severity || "").toLowerCase() === "medium").length
  const lowCount = findings.filter((f) => (f.severity || "").toLowerCase() === "low").length
  const infoCount = findings.filter((f) => (f.severity || "").toLowerCase() === "info").length

  const handleGenerate = () => {
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      title: `Executive ${selectedTemplate.replace("_", " ")} - ${new Date().toLocaleDateString()}`,
      template: selectedTemplate,
      findings: findings.length,
      created: new Date().toLocaleDateString(),
      downloaded: false,
    }
    setReports((prev) => [newReport, ...prev])
    setShowGenerator(false)
    toast({ title: "Report generated", description: `${newReport.title} compiled successfully.` })
  }

  const handleDownload = (id: string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, downloaded: true } : r)))
    toast({ title: "Download started", description: "Exporting report markdown/PDF." })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <Link href={`/programs/${programId}`} className="hover:text-text-primary">Program</Link>
        <span>/</span>
        <span className="text-text-primary">Reports</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Reports</h1>
        <Button onClick={() => setShowGenerator(!showGenerator)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load reports: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchProgramData()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {showGenerator && (
        <Card className="p-5 bg-bg-elevated border border-border space-y-5">
          <h2 className="text-sm font-semibold text-text-primary">New Report Generator</h2>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase">Findings in Scope</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-severity-critical/20 text-severity-critical font-medium">Critical ({criticalCount})</span>
              <span className="px-2.5 py-1 rounded bg-severity-high/20 text-severity-high font-medium">High ({highCount})</span>
              <span className="px-2.5 py-1 rounded bg-severity-medium/20 text-severity-medium font-medium">Medium ({medCount})</span>
              <span className="px-2.5 py-1 rounded bg-severity-low/20 text-severity-low font-medium">Low ({lowCount})</span>
              <span className="px-2.5 py-1 rounded bg-severity-info/20 text-severity-info font-medium">Info ({infoCount})</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase">Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: "recon_summary", name: "Recon Summary", desc: "Subdomains, ports, URLs", icon: FileText },
                { key: "vulnerability_report", name: "Vulnerability Report", desc: "Findings with PoC details", icon: AlertTriangle },
                { key: "compliance", name: "Compliance Summary", desc: "PCI-DSS / SOC2 alignment", icon: CheckCircle2 },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedTemplate(t.key)}
                  className={`p-3 rounded-md border text-left transition-colors ${
                    selectedTemplate === t.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-bg-subtle hover:border-border-focus"
                  }`}
                >
                  <t.icon className="w-4 h-4 text-text-muted mb-1.5" />
                  <div className="text-sm font-medium text-text-primary">{t.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowGenerator(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate}>Compile & Generate</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="p-8 bg-bg-elevated border border-border rounded-xl animate-pulse h-36" />
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center bg-bg-elevated border border-border text-xs text-text-muted">
          No reports compiled for this program yet. Click &apos;Generate Report&apos; above.
        </Card>
      ) : (
        reports.map((report) => (
          <Card key={report.id} className="p-4 bg-bg-elevated border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-primary-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{report.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span className="capitalize">{report.template.replace("_", " ")}</span>
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
                <Button variant="ghost" size="sm" onClick={() => handleDownload(report.id)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
