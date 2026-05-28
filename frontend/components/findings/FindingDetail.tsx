'use client'

import { useState } from 'react'
import { Calendar, User, Link as LinkIcon, FileText, MessageSquare, Clock, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import { EvidenceViewer } from './EvidenceViewer'
import type { Finding } from '@/lib/types'

interface FindingDetailProps {
  finding: Finding
  onClaim?: (id: string) => Promise<void>
  onValidate?: (id: string) => Promise<void>
}

export function FindingDetail({ finding, onClaim, onValidate }: FindingDetailProps) {
  const [tab, setTab] = useState<'details' | 'evidence' | 'notes' | 'history'>('details')

  const tabs = [
    { id: 'details' as const, label: 'Details', icon: FileText },
    { id: 'evidence' as const, label: 'Evidence', icon: LinkIcon },
    { id: 'notes' as const, label: 'Notes', icon: MessageSquare },
    { id: 'history' as const, label: 'History', icon: Clock },
  ]

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={finding.severity} size="lg" />
              <StatusBadge status={finding.status} />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">{finding.title}</h2>
            {finding.cveId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-subtle text-text-secondary text-xs font-mono rounded">
                {finding.cveId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!finding.assignedTo && onClaim && (
              <Button variant="outline" size="sm" onClick={() => onClaim(finding.id)}>
                <User className="w-4 h-4 mr-1" /> Claim
              </Button>
            )}
            {finding.status === 'triaged' && onValidate && (
              <Button size="sm" onClick={() => onValidate(finding.id)}>
                Validate
              </Button>
            )}
          </div>
        </div>

        {finding.description && (
          <p className="text-sm text-text-secondary mb-4 whitespace-pre-wrap">{finding.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Tool</div>
            <div className="text-text-primary font-mono text-xs">{finding.tool || 'Manual'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Assigned To</div>
            <div className="text-text-primary">{finding.assignedTo?.username || 'Unassigned'}</div>
          </div>
          {finding.cvssScore != null && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">CVSS Score</div>
              <div className="text-text-primary font-mono">{finding.cvssScore.toFixed(1)}</div>
            </div>
          )}
          {finding.bountyAmount != null && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Bounty</div>
              <div className="text-text-primary font-mono flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {finding.bountyAmount}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Found At</div>
            <div className="text-text-primary font-mono text-xs">{new Date(finding.foundAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab-item flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id ? 'text-text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'details' && (
          <div className="card p-6 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">Description</h4>
              <p className="text-sm text-text-secondary">{finding.description || 'No description provided.'}</p>
            </div>
            {finding.subdomain && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">Affected Host</h4>
                <p className="text-sm font-mono text-text-primary">{finding.subdomain.subdomain}</p>
              </div>
            )}
            {finding.templateName && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2">Template</h4>
                <p className="text-sm text-text-secondary">{finding.templateName}</p>
              </div>
            )}
          </div>
        )}
        {tab === 'evidence' && (
          <EvidenceViewer request={finding.request} response={finding.response} curlCommand={finding.curlCommand} />
        )}
        {tab === 'notes' && (
          <div className="card p-6">
            {finding.notes ? (
              <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">{finding.notes}</pre>
            ) : (
              <p className="text-sm text-text-muted">No notes attached to this finding.</p>
            )}
          </div>
        )}
        {tab === 'history' && (
          <div className="card p-6 space-y-3">
            {[
              { label: 'Found', value: finding.foundAt },
              { label: 'Triaged', value: finding.triagedAt },
              { label: 'Validated', value: finding.validatedAt },
              { label: 'Submitted', value: finding.submittedAt },
            ].map(
              (h) =>
                h.value && (
                  <div key={h.label} className="flex items-center gap-3 text-sm">
                    <span className="text-text-muted w-20 text-[10px] font-bold uppercase tracking-wider">{h.label}</span>
                    <span className="text-text-primary font-mono text-xs">{new Date(h.value).toLocaleString()}</span>
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
