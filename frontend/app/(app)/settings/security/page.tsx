"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Shield, Key, Smartphone, LogOut, Copy, CheckCircle2, Eye, EyeOff } from "lucide-react"

const sessions = [
  { id: "s1", device: "Chrome on macOS", ip: "192.168.1.100", lastActive: "Now", current: true },
  { id: "s2", device: "Firefox on Linux", ip: "10.0.0.50", lastActive: "2h ago", current: false },
  { id: "s3", device: "Safari on iOS", ip: "203.0.113.42", lastActive: "1d ago", current: false },
]

export default function SecuritySettingsPage() {
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" })
  const [show2faSetup, setShow2faSetup] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const backupCodes = ["A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2", "M3N4-O5P6", "Q7R8-S9T0", "U1V2-W3X4"]

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-text-muted mb-1">
          <a href="/settings" className="hover:text-text-primary">Settings</a> / Security
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Security Settings</h1>
      </div>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
        </div>
        <div className="max-w-sm space-y-3">
          <Input
            type="password"
            placeholder="Current password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
          />
          <Input
            type="password"
            placeholder="New password"
            value={passwordForm.newPass}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          />
          <Button>Update Password</Button>
        </div>
      </Card>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Two-Factor Authentication</h2>
        </div>

        {!show2faSetup ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Two-factor authentication is currently enabled.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShow2faSetup(true)}>Reconfigure 2FA</Button>
              <Button variant="destructive">Disable 2FA</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-40 h-40 bg-white rounded-lg flex items-center justify-center border border-border">
                <div className="text-xs text-text-muted text-center p-4">
                  QR Code Placeholder
                  <br />
                  Scan with authenticator
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted text-center">Or enter this key manually: <code className="text-text-primary">JBSWY3DPEHPK3PXP</code></p>

            <div className="flex items-center gap-2">
              <Input placeholder="Enter 6-digit code to verify" className="text-center font-mono" maxLength={6} />
              <Button>Verify</Button>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBackupCodes(!showBackupCodes)}
              >
                {showBackupCodes ? "Hide" : "Show"} Backup Codes
              </Button>
              {showBackupCodes && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {backupCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between p-2 bg-bg-subtle rounded font-mono text-xs cursor-pointer hover:bg-bg-overlay"
                      onClick={() => copyCode(code)}
                    >
                      <span>{code}</span>
                      {copiedCode === code ? (
                        <CheckCircle2 className="w-3 h-3 text-accent" />
                      ) : (
                        <Copy className="w-3 h-3 text-text-muted" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-bg-elevated border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <LogOut className="w-4 h-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Active Sessions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
            <tr>
              <th className="px-5 py-2.5 text-left">Device</th>
              <th className="px-5 py-2.5 text-left">IP</th>
              <th className="px-5 py-2.5 text-left">Last Active</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-bg-overlay">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary">{s.device}</span>
                    {s.current && <span className="badge bg-accent-muted text-accent text-xs">Current</span>}
                  </div>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs text-text-muted">{s.ip}</td>
                <td className="px-5 py-2.5 text-text-muted">{s.lastActive}</td>
                <td className="px-5 py-2.5 text-right">
                  {!s.current && <Button variant="ghost" size="sm">Revoke</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
