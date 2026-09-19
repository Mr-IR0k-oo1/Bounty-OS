"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Search,
  Command,
  User,
  Settings,
  LogOut,
  Key,
  ChevronDown,
  Shield,
  Gauge,
  FolderKanban,
  Target,
  Bug,
  Activity,
  Image,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  category: "Navigation" | "Programs" | "Findings" | "Actions"
  href?: string
  action?: () => void
  icon: any
}

export default function TopBar() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const [notifications, setNotifications] = useState([
    { id: 1, text: "Stage 3 scan complete on Uber", time: "2m ago", type: "info", read: false },
    { id: 2, text: "Critical finding: SQL injection on api.uber.com", time: "15m ago", type: "critical", read: false },
    { id: 3, text: "Tool health check: nuclei templates updated", time: "1h ago", type: "warning", read: false },
    { id: 4, text: "New program: Twitter added to workspace", time: "3h ago", type: "success", read: true },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
      setSelectedIndex(0)
    }
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
        setSearchOpen((prev) => !prev)
      }
      if (e.key === "Escape") setSearchOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const allItems: SearchItem[] = [
    { id: "nav-dash", title: "Dashboard", category: "Navigation", href: "/dashboard", icon: Gauge },
    { id: "nav-proj", title: "Projects Overview", category: "Navigation", href: "/projects", icon: FolderKanban },
    { id: "nav-prog", title: "Programs Hub", category: "Navigation", href: "/programs", icon: Target },
    { id: "nav-find", title: "All Findings", category: "Navigation", href: "/findings", icon: Bug },
    { id: "nav-jobs", title: "Scan Jobs & Pipeline", category: "Navigation", href: "/jobs", icon: Activity },
    { id: "nav-gal", title: "Screenshot Gallery", category: "Navigation", href: "/gallery", icon: Image },
    { id: "nav-hunt", title: "Hunters Team", category: "Navigation", href: "/hunters", icon: Users },
    { id: "nav-sett", title: "Settings Hub", category: "Navigation", href: "/settings", icon: Settings },
    { id: "nav-tools", title: "Tool Inventory & Probes", category: "Navigation", href: "/settings/tools", icon: Shield },
    { id: "nav-tok", title: "API Tokens", category: "Navigation", href: "/settings/tokens", icon: Key },

    { id: "prog-uber", title: "Uber (HackerOne)", subtitle: "142 targets · In Scope", category: "Programs", href: "/programs/1", icon: Target },
    { id: "prog-air", title: "Airbnb (Bugcrowd)", subtitle: "89 targets · In Scope", category: "Programs", href: "/programs/2", icon: Target },
    { id: "prog-twit", title: "Twitter (HackerOne)", subtitle: "203 targets · In Scope", category: "Programs", href: "/programs/3", icon: Target },

    { id: "find-ssrf", title: "SSRF in api.uber.com/internal/health", subtitle: "Critical · nuclei", category: "Findings", href: "/findings/1", icon: Bug },
    { id: "find-sqli", title: "SQL Injection in checkout.php", subtitle: "High · nuclei", category: "Findings", href: "/findings/2", icon: Bug },
    { id: "find-rce", title: "RCE in file upload handler", subtitle: "Critical · nuclei", category: "Findings", href: "/findings/6", icon: Bug },
    { id: "find-xss", title: "Reflected XSS in search endpoint", subtitle: "Medium · ffuf", category: "Findings", href: "/findings/3", icon: Bug },
  ]

  const filteredItems = searchQuery.trim() === ""
    ? allItems.slice(0, 8)
    : allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )

  const handleSelect = (item: SearchItem) => {
    setSearchOpen(false)
    setSearchQuery("")
    if (item.href) {
      router.push(item.href)
    } else if (item.action) {
      item.action()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex])
      }
    }
  }

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    await logout()
    router.push("/login")
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <>
      <div className="flex items-center justify-between w-full gap-3">
        {/* Left: Search + Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-bg-subtle/50 hover:bg-bg-subtle rounded-lg text-sm border border-border transition-all duration-150 w-full max-w-md group"
          >
            <Search className="w-3.5 h-3.5 text-text-muted shrink-0 group-hover:text-text-secondary transition-colors" />
            <span className="text-text-muted text-xs truncate group-hover:text-text-secondary transition-colors">
              Search projects, programs, findings...
            </span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-muted font-mono">⌘</kbd>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-muted font-mono">K</kbd>
            </div>
          </button>

          {/* System Status */}
          <div className="hidden md:flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-md border border-accent/25 bg-accent/10 text-xs text-accent shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            <span className="hidden sm:inline font-mono uppercase tracking-wider text-[9px]">
              all systems nominal
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-all duration-150"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-critical text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-bg-elevated">
                  {unreadCount}
                </span>
              )}
            </button>
            {notificationOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-bg-elevated shadow-2xl py-1 z-50">
                <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="text-xs font-semibold text-text-primary uppercase tracking-wider">Notifications</div>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-primary-muted text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                  {notifications.map((n) => {
                    const colorMap: Record<string, string> = {
                      critical: "bg-critical",
                      warning: "bg-high",
                      info: "bg-primary",
                      success: "bg-low",
                    }
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                          )
                        }}
                        className={cn(
                          "flex items-start gap-3 px-3.5 py-2.5 hover:bg-bg-overlay transition-fast cursor-pointer",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${colorMap[n.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs leading-snug", n.read ? "text-text-secondary" : "text-text-primary font-medium")}>
                            {n.text}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-3 py-1.5">
                  <button
                    onClick={markAllRead}
                    className="text-xs text-text-muted hover:text-text-primary w-full text-center py-1 transition-fast"
                  >
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
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-bg-overlay border border-transparent hover:border-border transition-all duration-150"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {(user?.displayName || user?.username || "A").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-text-primary leading-tight">
                  {user?.displayName || user?.username || "Admin Hunter"}
                </div>
                <div className="text-[10px] text-text-muted capitalize">
                  {user?.role || "admin"} · online
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg-elevated shadow-2xl py-1.5 z-50">
                <div className="px-3.5 py-2.5 border-b border-border">
                  <div className="text-xs font-bold text-text-primary">
                    {user?.displayName || "Admin Hunter"}
                  </div>
                  <div className="text-[11px] text-text-muted font-mono">
                    @{user?.username || "admin"}
                  </div>
                </div>
                <div className="py-1">
                  <a
                    href="/settings/security"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast"
                  >
                    <Key className="w-3.5 h-3.5 text-text-muted" /> Security & 2FA
                  </a>
                  <a
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast"
                  >
                    <Settings className="w-3.5 h-3.5 text-text-muted" /> Settings
                  </a>
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-critical hover:bg-critical/10 w-full transition-fast text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Command Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-bg-elevated shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-bg-base/60">
              <Search className="w-4 h-4 text-primary shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Type a command, program, finding, or route..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[10px] text-text-subtle bg-bg-subtle px-2 py-1 rounded font-mono border border-border"
              >
                ESC
              </button>
            </div>

            <div className="p-2 max-h-[380px] overflow-y-auto custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-text-muted">
                  No matching results for &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.icon
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100",
                        isSelected ? "bg-primary/15 text-primary border border-primary/30" : "hover:bg-bg-overlay text-text-secondary"
                      )}
                    >
                      <div className={cn("p-1.5 rounded-lg shrink-0", isSelected ? "bg-primary text-white" : "bg-bg-subtle text-text-muted")}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                          <span className="truncate">{item.title}</span>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted px-1.5 py-0.5 rounded bg-bg-subtle shrink-0">
                            {item.category}
                          </span>
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-text-muted truncate mt-0.5">{item.subtitle}</div>
                        )}
                      </div>
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border bg-bg-base/70 flex items-center justify-between text-[11px] text-text-subtle">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-[10px] font-mono mr-1">↑↓</kbd>
                  to navigate
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-[10px] font-mono mr-1">↵</kbd>
                  to select
                </span>
              </div>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-[10px] font-mono mr-1">ESC</kbd>
                to close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
