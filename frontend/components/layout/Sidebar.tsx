"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Grid3X3,
  Layers,
  Terminal,
} from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()

  const projects = [
    {
      id: "1",
      name: "UBER H1 AUDIT",
      slug: "uber-audit",
      expanded: true,
      sections: [
        { name: "Programs", href: "/projects/uber-audit/programs", icon: Layers },
        { name: "Kanban", href: "/projects/uber-audit/kanban", icon: Grid3X3 },
        { name: "Timeline", href: "/projects/uber-audit/timeline", icon: LayoutDashboard },
        { name: "Terminal", href: "/projects/uber-audit/notes", icon: Terminal },
      ],
    },
  ]

  const globalSections = [
    { name: "All Findings", href: "/findings", icon: Search },
    { name: "Jobs", href: "/jobs", icon: LayoutDashboard },
  ]

  return (
    <div className="hidden border-r bg-muted/10 md:block w-64 technical-surface">
      <div className="flex h-full flex-col gap-2">
        <div className="flex h-14 items-center border-b px-6 font-mono tracking-tighter">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary" />
            <span className="text-lg font-bold">BOUNTY[OS]</span>
          </Link>
        </div>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <nav className="flex flex-col p-4 gap-6">
              <div className="space-y-1">
                <h3 className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                  Operations
                </h3>
                {projects.map((project) => (
                  <div key={project.id} className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1.5 text-xs font-bold border-l-2 border-primary bg-primary/5">
                      {project.name}
                      <ChevronDown className="h-3 w-3" />
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {project.sections.map((section) => (
                        <Link
                          key={section.href}
                          href={section.href}
                          className={cn(
                            "group flex items-center gap-3 px-3 py-2 text-[13px] transition-colors border border-transparent",
                            pathname === section.href 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border"
                          )}
                        >
                          <section.icon className="h-4 w-4" />
                          <span className="font-medium tracking-tight">{section.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <h3 className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                  Global Data
                </h3>
                {globalSections.map((section) => (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-[13px] transition-colors border border-transparent",
                      pathname === section.href 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border"
                    )}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="font-medium tracking-tight">{section.name}</span>
                  </Link>
                ))}
              </div>
            </nav>
          </ScrollArea>
        </div>
        <div className="p-4 border-t bg-muted/5">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span className="font-medium">System Configuration</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
