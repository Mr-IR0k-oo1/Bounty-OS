"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ShieldAlert, Check, Copy, ArrowRight } from "lucide-react"

type SetupStep = "account" | "2fa" | "done"

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>("account")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  })

  const steps = [
    { key: "account", label: "Account" },
    { key: "2fa", label: "2FA" },
    { key: "done", label: "Done" },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          display_name: form.displayName,
          password: form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Setup failed")
        return
      }

      setQrCode(data.qr_code_url || "")
      setSecret(data.secret || "")
      setStep("2fa")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleVerify2fa() {
    setStep("done")
  }

  function handleFinish() {
    localStorage.setItem("token", "setup-token")
    router.push("/dashboard")
  }

  function handleCopySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <Card className="w-full max-w-md p-8 bg-bg-elevated border border-border">
        <div className="flex flex-col items-center mb-8">
          <ShieldAlert className="w-10 h-10 text-primary mb-3" />
          <h1 className="text-xl font-bold text-text-primary">BountyOS Setup</h1>
          <p className="text-sm text-text-muted mt-1">Configure your instance</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= currentStepIndex
                    ? "bg-primary text-white"
                    : "bg-bg-subtle text-text-muted"
                }`}
              >
                {i < currentStepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${i <= currentStepIndex ? "text-text-primary" : "text-text-muted"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === "account" && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary" htmlFor="username">Username</label>
              <Input id="username" value={form.username} onChange={(e) => updateField("username", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary" htmlFor="displayName">Display Name</label>
              <Input id="displayName" value={form.displayName} onChange={(e) => updateField("displayName", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary" htmlFor="password">Password</label>
              <Input id="password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary" htmlFor="confirmPassword">Confirm Password</label>
              <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} required />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-severity-high/10 border border-severity-high/30 text-severity-high text-sm">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Admin Account"}
            </Button>
          </form>
        )}

        {step === "2fa" && (
          <div className="space-y-6">
            <p className="text-sm text-text-secondary text-center">
              Scan the QR code below with your authenticator app, then verify.
            </p>

            <div className="flex justify-center">
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border border-border">
                {qrCode ? (
                  <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44" />
                ) : (
                  <div className="w-44 h-44 bg-bg-subtle flex items-center justify-center text-text-muted text-xs">
                    QR Code Placeholder
                  </div>
                )}
              </div>
            </div>

            {secret && (
              <div className="flex items-center gap-2 p-3 bg-bg-subtle rounded-md">
                <code className="text-xs font-mono text-text-secondary flex-1 truncate">{secret}</code>
                <button onClick={handleCopySecret} className="text-text-muted hover:text-text-primary flex-shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            <Button onClick={handleVerify2fa} className="w-full">
              I have scanned the code
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary-muted flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Setup Complete</h2>
            <p className="text-sm text-text-muted">
              Your BountyOS instance is ready. You will be redirected to the dashboard.
            </p>
            <Button onClick={handleFinish} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
