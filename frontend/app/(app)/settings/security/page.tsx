"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Shield, Key, Smartphone, LogOut, Copy, CheckCircle2, Eye, EyeOff, Check } from "lucide-react"
import { useToast } from "@/hooks/useToast"

const initialSessions = [
  { id: "s1", device: "Chrome on macOS", ip: "192.168.1.100", lastActive: "Now", current: true },
  { id: "s2", device: "Firefox on Linux", ip: "10.0.0.50", lastActive: "2h ago", current: false },
  { id: "s3", device: "Safari on iOS", ip: "203.0.113.42", lastActive: "1d ago", current: false },
]

export default function SecuritySettingsPage() {
  const { toast } = useToast()
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" })
  const [show2faSetup, setShow2faSetup] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
  const [totpCode, setTotpCode] = useState("")
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [sessionsList, setSessionsList] = useState(initialSessions)

  const backupCodes = ["A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2", "M3N4-O5P6", "Q7R8-S9T0", "U1V2-W3X4"]

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1500)
    toast({ title: "Copied", description: `Backup code ${code} copied.` })
  }

  function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordForm.current) {
      toast({ variant: "destructive", title: "Missing field", description: "Please enter your current password." })
      return
    }
    if (passwordForm.newPass.length < 8) {
      toast({ variant: "destructive", title: "Weak password", description: "New password must be at least 8 characters long." })
      return
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast({ variant: "destructive", title: "Passwords mismatch", description: "New passwords do not match." })
      return
    }

    setPasswordForm({ current: "", newPass: "", confirm: "" })
    toast({ title: "Password Changed", description: "Your account password has been updated securely." })
  }

  function handleVerifyTotp() {
    if (totpCode.length !== 6) {
      toast({ variant: "destructive", title: "Invalid Code", description: "Please enter a valid 6-digit TOTP code." })
      return
    }
    setTwoFactorEnabled(true)
    setShow2faSetup(false)
    setTotpCode("")
    toast({ title: "2FA Configured", description: "Two-factor authentication is active on your account." })
  }

  function handleDisable2fa() {
    setTwoFactorEnabled(false)
    toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled." })
  }

  function handleRevokeSession(id: string) {
    const session = sessionsList.find(s => s.id === id)
    setSessionsList(prev => prev.filter(s => s.id !== id))
    toast({ title: "Session Terminated", description: `Session from ${session?.device} (${session?.ip}) was revoked.` })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-muted mb-1">
          <a href="/settings" className="hover:text-text-primary transition-colors">Settings</a> / Security
        </div>
        <h1 className="text-xl font-bold text-text-primary">Security Settings</h1>
        <p className="text-xs text-text-muted mt-0.5">Manage authentication credentials, TOTP hardware tokens, and active devices.</p>
      </div>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
        </div>
        <form onSubmit={handleUpdatePassword} className="max-w-sm space-y-3">
          <Input
            type="password"
            placeholder="Current password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            className="text-xs bg-bg-subtle border-border"
          />
          <Input
            type="password"
            placeholder="New password (min. 8 characters)"
            value={passwordForm.newPass}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
            className="text-xs bg-bg-subtle border-border"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            className="text-xs bg-bg-subtle border-border"
          />
          <Button type="submit" size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs">
            Update Password
          </Button>
        </form>
      </Card>

      <Card className="bg-bg-elevated border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Two-Factor Authentication (TOTP)</h2>
        </div>

        {twoFactorEnabled && !show2faSetup ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-low font-medium">
              <CheckCircle2 className="w-4 h-4" /> Two-factor authentication is currently enabled.
            </div>
            <p className="text-xs text-text-muted">Your account is secured with time-based one-time passwords.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShow2faSetup(true)} className="text-xs border-border bg-bg-subtle">
                Reconfigure Authenticator
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisable2fa} className="text-xs border-critical/30 text-critical hover:bg-critical-muted">
                Disable 2FA
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <div className="flex justify-center p-4 bg-bg-subtle rounded-xl border border-border">
              <div className="w-36 h-36 bg-white rounded-lg flex flex-col items-center justify-center p-2 text-center shadow-inner">
                <div className="w-28 h-28 border-4 border-dashed border-black/30 rounded flex items-center justify-center text-[10px] text-black/60 font-mono">
                  [QR CODE]
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted text-center">
              Scan with Google Authenticator or 1Password, or enter key: <code className="text-primary font-mono font-bold">JBSWY3DPEHPK3PXP</code>
            </p>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter 6-digit code to verify"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="text-center font-mono text-sm bg-bg-subtle border-border"
                maxLength={6}
              />
              <Button onClick={handleVerifyTotp} size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs">
                Verify & Enable
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShow2faSetup(false)} className="text-xs">
                Cancel
              </Button>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="text-xs text-text-muted"
              >
                {showBackupCodes ? "Hide" : "Show"} Backup Recovery Codes
              </Button>
              {showBackupCodes && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {backupCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between p-2 bg-bg-subtle border border-border rounded font-mono text-xs cursor-pointer hover:bg-bg-overlay"
                      onClick={() => copyCode(code)}
                    >
                      <span>{code}</span>
                      {copiedCode === code ? (
                        <Check className="w-3.5 h-3.5 text-low" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-bg-elevated border border-border overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-bg-subtle/50">
          <LogOut className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Authorized Sessions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle/30 text-text-muted uppercase text-[10px] font-bold">
            <tr>
              <th className="px-5 py-2.5 text-left">Device & Browser</th>
              <th className="px-5 py-2.5 text-left">IP Address</th>
              <th className="px-5 py-2.5 text-left">Last Active</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sessionsList.map((s) => (
              <tr key={s.id} className="hover:bg-bg-overlay/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">{s.device}</span>
                    {s.current && <span className="badge bg-accent-muted text-accent text-[10px]">Current Session</span>}
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-text-muted">{s.ip}</td>
                <td className="px-5 py-3 text-xs text-text-muted">{s.lastActive}</td>
                <td className="px-5 py-3 text-right">
                  {!s.current && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleRevokeSession(s.id)}
                      className="text-xs border-critical/30 text-critical hover:bg-critical-muted h-7 px-2"
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

