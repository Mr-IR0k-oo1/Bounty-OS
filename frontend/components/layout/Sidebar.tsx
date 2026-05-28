"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FolderKanban, Target, Bug, Images,
  Activity, Radio, Settings, Users, Shield, ChevronRight, PanelLeftClose, PanelLeft, X
} from "lucide-react"
import { cn } from "@/lib/utils"

const navGroups = [
  { section: "Workspace", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/programs", label: "Programs", icon: Target },
    { href: "/findings", label: "Findings", icon: Bug },
    { href: "/gallery", label: "Gallery", icon: Images },
  ]},
  { section: "Pipeline", items: [
    { href: "/jobs", label: "Jobs", icon: Activity },
    { href: "/monitor", label: "Monitor", icon: Radio },
  ]},
]

export default function Sidebar({ collapsed = false, onClose, onToggleCollapse }: { collapsed?: boolean; onClose?: () => void; onToggleCollapse?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <div className={cn(
      "flex flex-col h-full border-r border-border bg-bg-elevated shrink-0",
      collapsed ? "w-[56px]" : "w-full"
    )}>
      {/* Logo */}
      <div className={cn(
        "flex items-center h-12 border-b border-border shrink-0 relative",
        collapsed ? "justify-center" : "gap-2.5 px-4"
      )}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-glow-primary">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <>
            <span className="font-bold text-sm tracking-tight">BountyOS</span>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-auto p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-5">
        {navGroups.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                {group.section}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150 relative",
                      collapsed && "justify-center px-0 mx-1",
                      active
                        ? "bg-primary-muted text-primary font-medium"
                        : "text-text-muted hover:bg-bg-overlay hover:text-text-primary"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-bg-elevated border border-border text-xs text-text-primary shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Links */}
      <div className="p-2 border-t border-border space-y-0.5">
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150 relative",
            collapsed && "justify-center px-0 mx-1",
            pathname.startsWith("/settings")
              ? "bg-primary-muted text-primary font-medium"
              : "text-text-muted hover:bg-bg-overlay hover:text-text-primary"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-bg-elevated border border-border text-xs text-text-primary shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50">
              Settings
            </div>
          )}
        </Link>
        <Link
          href="/hunters"
          onClick={onClose}
          className={cn(
            "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150 relative",
            collapsed && "justify-center px-0 mx-1",
            pathname.startsWith("/hunters")
              ? "bg-primary-muted text-primary font-medium"
              : "text-text-muted hover:bg-bg-overlay hover:text-text-primary"
          )}
          title={collapsed ? "Hunters" : undefined}
        >
          <Users className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Hunters</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-bg-elevated border border-border text-xs text-text-primary shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50">
              Hunters
            </div>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <div className="px-2 py-1.5 border-t border-border">
        <button
          onClick={() => onToggleCollapse?.()}
          className="flex items-center justify-center w-full gap-1.5 py-1 rounded text-[10px] text-text-subtle hover:text-text-muted hover:bg-bg-overlay transition-fast"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft className={cn("w-3 h-3 transition-transform duration-200", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
          {collapsed && <span className="sr-only">Expand</span>}
        </button>
      </div>
    </div>
  )
}
