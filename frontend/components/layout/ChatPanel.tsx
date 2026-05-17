"use client"

import { useState } from "react"
import { Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

// This is the chat panel component that will be used to display and interact with the chat assistant
// It includes a message input, send button, and message display area

export function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! How can I help you with your bounty hunting today?",
      sender: "assistant",
    },
  ])
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const handleSend = () => {
    if (input.trim()) {
      setMessages([
        ...messages,
        { id: messages.length + 1, text: input, sender: "user" },
      ])
      setInput("")
      // Here you would typically call an API to get the assistant's response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            text: "I'm processing your request. Please hold on...",
            sender: "assistant",
          },
        ])
      }, 1000)
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg transition-all ${
        isOpen ? "h-[400px]" : "h-16"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-medium">Template Assistant</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {isOpen && (
          <div className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-[280px] pr-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div className="mt-4 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
              />
              <Button onClick={handleSend} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
