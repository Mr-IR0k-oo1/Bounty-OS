"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, Search, Command, User, Settings, LogOut, Key, ChevronDown, Shield, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"

export default function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationOpen, setNotificationOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === "Escape") setSearchOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const recentSearches = ["api.uber.com", "critical SSRF", "stage 2 scan results", "*.uber.com"]

  const notifications = [
    { id: 1, text: "Stage 3 scan complete on Uber", time: "2m ago", type: "info" },
    { id: 2, text: "Critical finding: SQL injection on api.uber.com", time: "15m ago", type: "critical" },
    { id: 3, text: "Tool health check: gau unhealthy", time: "1h ago", type: "warning" },
    { id: 4, text: "New program: Twitter added to workspace", time: "3h ago", type: "success" },
  ]

  return (
    <>
      <div className="flex items-center justify-between w-full gap-3">
        {/* Left: Search + Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-bg-subtle/50 hover:bg-bg-subtle rounded-lg text-sm border border-border transition-all duration-150 w-full max-w-md"
          >
            <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-xs truncate">Search projects, programs, findings...</span>
            <div className="ml-auto flex items-center gap-0.5 text-[10px] text-text-subtle bg-bg-overlay rounded px-1 py-0.5 shrink-0">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </button>

          {/* System Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-muted/30 text-xs text-accent shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="hidden sm:inline">All systems</span>
            <span>nominal</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-all duration-150"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-critical ring-2 ring-bg-elevated" />
            </button>
            {notificationOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 rounded-xl border border-border bg-bg-elevated shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-sm font-semibold text-text-primary">Notifications</div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((n) => {
                    const colorMap: Record<string, string> = {
                      critical: "bg-critical",
                      warning: "bg-medium",
                      info: "bg-primary",
                      success: "bg-low",
                    }
                    return (
                      <div key={n.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-bg-overlay transition-fast cursor-pointer">
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${colorMap[n.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-primary">{n.text}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-3 py-1.5">
                  <button className="text-xs text-text-muted hover:text-text-primary w-full text-center transition-fast">
                    Mark all as read
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-overlay transition-all duration-150"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                A
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-text-primary leading-tight">Admin</div>
                <div className="text-[10px] text-text-muted">admin@bountyos</div>
              </div>
              <ChevronDown className="w-3 h-3 text-text-muted hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-bg-elevated shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-sm font-medium text-text-primary">Admin</div>
                  <div className="text-xs text-text-muted">admin@bountyos</div>
                </div>
                <a href="/settings/security" className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast">
                  <Key className="w-4 h-4" /> Security
                </a>
                <a href="/settings" className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast">
                  <Settings className="w-4 h-4" /> Settings
                </a>
                <div className="border-t border-border mt-1 pt-1">
                  <button className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary w-full transition-fast">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-bg-elevated shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search projects, programs, findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[10px] text-text-subtle bg-bg-subtle px-1.5 py-0.5 rounded"
              >
                ESC
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {searchQuery.length === 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    Recent
                  </div>
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      className="flex items-center gap-3 w-full px-2 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast"
                    >
                      <Search className="w-3 h-3 text-text-subtle" />
                      {s}
                    </button>
                  ))}
                </>
              )}
              {searchQuery.length > 0 && (
                <div className="px-2 py-4 text-center text-xs text-text-muted">
                  No results found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border bg-bg-base flex items-center gap-4 text-[10px] text-text-subtle">
              <span><Command className="w-2.5 h-2.5 inline" />K to search</span>
              <span><span className="border border-border rounded px-0.5">↑</span><span className="border border-border rounded px-0.5 ml-0.5">↓</span> to navigate</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
