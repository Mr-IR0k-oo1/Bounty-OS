"use client"

import { Bell, Search, Command } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function TopBar() {
  return (
    <div className="border-b bg-background/50 backdrop-blur-md">
      <div className="flex h-14 items-center px-6">
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SYSTEM_OPERATIONAL
          </span>
          <span className="opacity-20">|</span>
          <span>LATENCY: 24ms</span>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="COMMAND SEARCH..."
              className="h-9 w-64 pl-9 text-[11px] font-mono tracking-tight bg-muted/20 border-transparent focus:border-primary transition-all rounded-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 border rounded bg-muted/50 text-[10px] text-muted-foreground font-mono">
              <Command className="w-2.5 h-2.5" />
              K
            </div>
          </div>
          
          <div className="h-4 w-px bg-border mx-1" />
          
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-muted/50 transition-colors">
            <Bell className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-3 pl-2">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold leading-none">OPERATOR_01</span>
              <span className="text-[9px] text-muted-foreground font-mono">ROOT_ACCESS</span>
            </div>
            <Avatar className="h-8 w-8 rounded-none border border-border p-0.5">
              <AvatarImage src="/avatars/01.png" alt="User" className="rounded-none" />
              <AvatarFallback className="rounded-none text-[10px] font-bold">01</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  )
}
