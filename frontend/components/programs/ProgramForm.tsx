'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Program, Platform } from '@/lib/types'

const platforms: { value: Platform; label: string }[] = [
  { value: 'h1', label: 'HackerOne' },
  { value: 'bugcrowd', label: 'Bugcrowd' },
  { value: 'intigriti', label: 'Intigriti' },
  { value: 'synack', label: 'Synack' },
  { value: 'other', label: 'Other' },
]

interface ProgramFormProps {
  onSubmit: (data: Partial<Program>) => Promise<void>
  onCancel: () => void
  initial?: Partial<Program>
}

export function ProgramForm({ onSubmit, onCancel, initial }: ProgramFormProps) {
  const [name, setName] = useState(initial?.name || '')
  const [platform, setPlatform] = useState<string>(initial?.platform || 'other')
  const [programUrl, setProgramUrl] = useState(initial?.programUrl || '')
  const [bountyRangeLow, setBountyRangeLow] = useState(initial?.bountyRangeLow?.toString() || '')
  const [bountyRangeHigh, setBountyRangeHigh] = useState(initial?.bountyRangeHigh?.toString() || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        platform: platform as Platform,
        programUrl: programUrl || null,
        bountyRangeLow: bountyRangeLow ? Number(bountyRangeLow) : null,
        bountyRangeHigh: bountyRangeHigh ? Number(bountyRangeHigh) : null,
        notes: notes || null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <h3 className="text-lg font-bold text-text-primary">{initial ? 'Edit Program' : 'New Program'}</h3>

      <div className="space-y-2">
        <Label htmlFor="name">Program Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Example VDP" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform">Platform</Label>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">Program URL</Label>
        <Input id="url" value={programUrl} onChange={(e) => setProgramUrl(e.target.value)} placeholder="https://hackerone.com/example" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bountyLow">Bounty Min ($)</Label>
          <Input id="bountyLow" type="number" value={bountyRangeLow} onChange={(e) => setBountyRangeLow(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bountyHigh">Bounty Max ($)</Label>
          <Input id="bountyHigh" type="number" value={bountyRangeHigh} onChange={(e) => setBountyRangeHigh(e.target.value)} placeholder="5000" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={3} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Update Program' : 'Create Program'}
        </Button>
      </div>
    </form>
  )
}
