'use client'

import { AlertTriangle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApprovalGateBannerProps {
  programId: string
  isApproved: boolean
  onApprove: (id: string) => Promise<void>
}

export function ApprovalGateBanner({ programId, isApproved, onApprove }: ApprovalGateBannerProps) {
  if (isApproved) return null

  return (
    <div className="flex items-start gap-4 p-4 bg-severity-high/5 border border-severity-high/20 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-severity-high flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-severity-high">Active Scanning Not Approved</h4>
        <p className="text-sm text-text-secondary mt-1">
          This program has not been approved for active scanning. Automated reconnaissance and
          vulnerability detection are paused. Approve active scanning to resume pipeline operations.
        </p>
        <Button
          className="mt-3"
          variant="destructive"
          size="sm"
          onClick={() => onApprove(programId)}
        >
          <Shield className="w-4 h-4 mr-1.5" /> Approve Active Scanning
        </Button>
      </div>
    </div>
  )
}
