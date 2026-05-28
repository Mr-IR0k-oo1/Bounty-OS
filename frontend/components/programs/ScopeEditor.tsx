'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ScopeTarget, ScopeType } from '@/lib/types'

const scopeTypes: { value: ScopeType; label: string }[] = [
  { value: 'domain', label: 'Domain' },
  { value: 'ip', label: 'IP' },
  { value: 'cidr', label: 'CIDR' },
  { value: 'wildcard', label: 'Wildcard' },
  { value: 'apk', label: 'APK' },
  { value: 'url', label: 'URL' },
]

interface ScopeEditorProps {
  targets: ScopeTarget[]
  onAdd: (target: { targetType: ScopeType; targetValue: string; inScope: boolean; notes?: string }) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function ScopeEditor({ targets, onAdd, onRemove }: ScopeEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [targetType, setTargetType] = useState<ScopeType>('domain')
  const [targetValue, setTargetValue] = useState('')
  const [inScope, setInScope] = useState(true)
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const inScopeTargets = targets.filter((t) => t.inScope)
  const outOfScopeTargets = targets.filter((t) => !t.inScope)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      await onAdd({ targetType, targetValue, inScope, notes: notes || undefined })
      setTargetValue('')
      setNotes('')
      setShowForm(false)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-primary">Scope Targets</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Add Target
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card bg-bg-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as ScopeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="*.example.com" required />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={inScope} onChange={(e) => setInScope(e.target.checked)} className="rounded border-border" />
              In Scope
            </label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="flex-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={adding || !targetValue}>
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-severity-low" /> In Scope ({inScopeTargets.length})
          </h4>
          <div className="space-y-1">
            {inScopeTargets.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-bg-surface rounded text-sm group">
                <div>
                  <span className="text-[10px] font-mono text-text-muted mr-2">{t.targetType}</span>
                  <span className="text-text-primary font-mono">{t.targetValue}</span>
                </div>
                <button onClick={() => onRemove(t.id)} className="text-text-muted hover:text-severity-critical opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {inScopeTargets.length === 0 && (
              <div className="text-sm text-text-muted text-center py-4">No in-scope targets</div>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <X className="w-4 h-4 text-severity-high" /> Out of Scope ({outOfScopeTargets.length})
          </h4>
          <div className="space-y-1">
            {outOfScopeTargets.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-bg-surface rounded text-sm group">
                <div>
                  <span className="text-[10px] font-mono text-text-muted mr-2">{t.targetType}</span>
                  <span className="text-text-primary font-mono">{t.targetValue}</span>
                </div>
                <button onClick={() => onRemove(t.id)} className="text-text-muted hover:text-severity-critical opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {outOfScopeTargets.length === 0 && (
              <div className="text-sm text-text-muted text-center py-4">No out-of-scope targets</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
