"use client"

import { useState, useCallback, useEffect } from "react"
import Sidebar from "@/components/layout/Sidebar"
import TopBar from "@/components/layout/TopBar"
import AssistantPanel from "@/components/layout/AssistantPanel"
import { PanelRight, PanelRightClose, Menu } from "lucide-react"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [assistantWidth, setAssistantWidth] = useState(320)

  // Load saved sidebar state from localStorage so it stays collapsed across page changes & reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bountyos_sidebar_open")
      if (saved !== null) {
        setSidebarOpen(saved === "true")
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem("bountyos_sidebar_open", String(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  // Ctrl+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [toggleSidebar])

  const handleAssistantResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = assistantWidth

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 480)
      setAssistantWidth(newWidth)
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [assistantWidth])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-surface/80 backdrop-blur-[1.5px] text-text-primary">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar collapsed={!sidebarOpen} onToggleCollapse={toggleSidebar} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[260px] animate-in slide-in-from-left duration-300">
            <Sidebar collapsed={false} onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative min-w-0">
        {/* Top Bar */}
        <header className="h-12 border-b border-border bg-bg-elevated/80 backdrop-blur-xl flex-shrink-0 flex items-center px-4 sticky top-0 z-20 gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
          <TopBar />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Assistant Panel */}
      <div
        className={`hidden xl:flex flex-col border-l border-border bg-bg-elevated overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${
          assistantOpen ? "" : "w-0"
        }`}
        style={{ width: assistantOpen ? assistantWidth : 0 }}
      >
        {assistantOpen && (
          <>
            <div
              className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors shrink-0 absolute left-0 top-0 bottom-0 z-10"
              onMouseDown={handleAssistantResize}
            />
            <AssistantPanel onClose={() => setAssistantOpen(false)} />
          </>
        )}
      </div>

      {/* Mobile Assistant Toggle */}
      <button
        onClick={() => setAssistantOpen(!assistantOpen)}
        className="fixed bottom-4 right-4 z-30 xl:hidden p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {assistantOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
      </button>
    </div>
  )
}
