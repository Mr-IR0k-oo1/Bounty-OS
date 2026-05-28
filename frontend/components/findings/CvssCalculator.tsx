'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield } from 'lucide-react'

interface Metric {
  id: string
  label: string
  description: string
  options: { value: string; label: string; score: number }[]
}

const metrics: Metric[] = [
  {
    id: 'AV',
    label: 'Attack Vector',
    description: 'How the attacker exploits the vulnerability',
    options: [
      { value: 'N', label: 'Network', score: 0.85 },
      { value: 'A', label: 'Adjacent', score: 0.62 },
      { value: 'L', label: 'Local', score: 0.55 },
      { value: 'P', label: 'Physical', score: 0.2 },
    ],
  },
  {
    id: 'AC',
    label: 'Attack Complexity',
    description: 'Conditions beyond the attacker\'s control',
    options: [
      { value: 'L', label: 'Low', score: 0.77 },
      { value: 'H', label: 'High', score: 0.44 },
    ],
  },
  {
    id: 'PR',
    label: 'Privileges Required',
    description: 'Level of privileges needed',
    options: [
      { value: 'N', label: 'None', score: 0.85 },
      { value: 'L', label: 'Low', score: 0.62 },
      { value: 'H', label: 'High', score: 0.27 },
    ],
  },
  {
    id: 'UI',
    label: 'User Interaction',
    description: 'Whether user interaction is required',
    options: [
      { value: 'N', label: 'None', score: 0.85 },
      { value: 'R', label: 'Required', score: 0.62 },
    ],
  },
  {
    id: 'S',
    label: 'Scope',
    description: 'Does the vulnerability affect other components',
    options: [
      { value: 'U', label: 'Unchanged', score: 0 },
      { value: 'C', label: 'Changed', score: 1 },
    ],
  },
  {
    id: 'C',
    label: 'Confidentiality',
    description: 'Impact on confidentiality',
    options: [
      { value: 'H', label: 'High', score: 0.56 },
      { value: 'L', label: 'Low', score: 0.22 },
      { value: 'N', label: 'None', score: 0 },
    ],
  },
  {
    id: 'I',
    label: 'Integrity',
    description: 'Impact on integrity',
    options: [
      { value: 'H', label: 'High', score: 0.56 },
      { value: 'L', label: 'Low', score: 0.22 },
      { value: 'N', label: 'None', score: 0 },
    ],
  },
  {
    id: 'A',
    label: 'Availability',
    description: 'Impact on availability',
    options: [
      { value: 'H', label: 'High', score: 0.56 },
      { value: 'L', label: 'Low', score: 0.22 },
      { value: 'N', label: 'None', score: 0 },
    ],
  },
]

function calculateCvss(values: Record<string, string>): { score: number; severity: string; color: string } {
  const getScore = (id: string) => {
    const metric = metrics.find((m) => m.id === id)
    const opt = metric?.options.find((o) => o.value === values[id])
    return opt?.score || 0
  }

  const av = getScore('AV')
  const ac = getScore('AC')
  const pr = getScore('PR')
  const ui = getScore('UI')
  const s = getScore('S')
  const c = getScore('C')
  const i = getScore('I')
  const a = getScore('A')

  const scopeChanged = values['S'] === 'C'
  const impact = 1 - (1 - c) * (1 - i) * (1 - a)

  let exploitability = 8.22 * av * ac * pr * ui
  let impactScore: number
  if (scopeChanged) {
    impactScore = 1.08 * (impact)
  } else {
    impactScore = impact
  }

  let score: number
  if (impactScore <= 0) {
    score = 0
  } else if (scopeChanged) {
    score = Math.min(1.08 * (impact + exploitability), 10)
  } else {
    score = Math.min(impactScore + exploitability, 10)
  }

  score = Math.round(score * 10) / 10

  let severity: string
  let color: string
  if (score >= 9) { severity = 'Critical'; color = 'text-severity-critical' }
  else if (score >= 7) { severity = 'High'; color = 'text-severity-high' }
  else if (score >= 4) { severity = 'Medium'; color = 'text-severity-medium' }
  else if (score >= 0.1) { severity = 'Low'; color = 'text-severity-low' }
  else { severity = 'None'; color = 'text-text-muted' }

  return { score, severity, color }
}

interface CvssCalculatorProps {
  onApply?: (cvssScore: number) => void
  initialValues?: Record<string, string>
}

export function CvssCalculator({ onApply, initialValues }: CvssCalculatorProps) {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues || { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' }
  )

  const result = useMemo(() => calculateCvss(values), [values])
  const vector = `CVSS:3.1/${metrics.map((m) => `${m.id}:${values[m.id] || ''}`).join('/')}`

  function handleChange(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  const severityColors: Record<string, string> = {
    Critical: 'bg-severity-critical',
    High: 'bg-severity-high',
    Medium: 'bg-severity-medium',
    Low: 'bg-severity-low',
    None: 'bg-bg-subtle',
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Shield className="w-5 h-5" /> CVSS v3.1 Calculator
        </h3>
      </div>

      <div className={`p-6 rounded-lg text-center ${result.severity === 'None' ? 'bg-bg-surface' : `${severityColors[result.severity]}/10`}`}>
        <div className={`text-5xl font-black font-mono ${result.color}`}>{result.score.toFixed(1)}</div>
        <div className={`text-lg font-bold mt-1 ${result.color}`}>{result.severity}</div>
        <div className="text-[10px] font-mono text-text-muted mt-2 break-all">{vector}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="space-y-2">
            <Label className="text-xs font-semibold">
              {metric.id}
              <span className="block text-[10px] font-normal text-text-muted">{metric.label}</span>
            </Label>
            <Select value={values[metric.id]} onValueChange={(v) => handleChange(metric.id, v)}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metric.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label} ({opt.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {onApply && (
        <div className="flex justify-end">
          <Button onClick={() => onApply(result.score)}>
            Apply to Finding ({result.score.toFixed(1)})
          </Button>
        </div>
      )}
    </div>
  )
}
