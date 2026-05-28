"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, FileText, Trash2, Save } from "lucide-react"

type Note = {
  id: string
  title: string
  content: string
  tag: string
  lastEdited: string
}

const tags = ["methodology", "scope", "findings", "recon", "misc"]

const initialNotes: Note[] = [
  { id: "n1", title: "Recon Strategy", content: "## Recon Strategy\n\nUse subfinder for passive subdomain enumeration, then httpx for probing.", tag: "methodology", lastEdited: "2h ago" },
  { id: "n2", title: "Scope Notes", content: "Uber: *.uber.com in scope. Exclude corp.uber.com.", tag: "scope", lastEdited: "1d ago" },
  { id: "n3", title: "Interesting Endpoints", content: "/internal/* endpoints return interesting debug data on api.uber.com", tag: "findings", lastEdited: "3d ago" },
  { id: "n4", title: "DNS Notes", content: "Discovered 1200+ subdomains via subfinder. 189 alive.", tag: "recon", lastEdited: "5d ago" },
]

export default function ProjectNotesPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [notes, setNotes] = useState(initialNotes)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const filtered = activeTag ? notes.filter((n) => n.tag === activeTag) : notes
  const activeNote = notes.find((n) => n.id === activeNoteId)

  function selectNote(note: Note) {
    setActiveNoteId(note.id)
    setEditingContent(note.content)
  }

  function addNote() {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "Untitled Note",
      content: "",
      tag: "misc",
      lastEdited: "just now",
    }
    setNotes((prev) => [newNote, ...prev])
    selectNote(newNote)
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNoteId === id) {
      setActiveNoteId(null)
      setEditingContent("")
    }
  }

  function updateNote(field: "title" | "tag", value: string) {
    if (!activeNoteId) return
    setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? { ...n, [field]: value } : n)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/projects/${projectId}`} className="hover:text-text-primary">Project</a>
        <span>/</span>
        <span className="text-text-primary">Notes</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Project Notes</h1>
        <Button onClick={addNote} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Note
        </Button>
      </div>

      <div className="flex gap-6">
        <aside className="w-[260px] flex-shrink-0 space-y-4">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                !activeTag ? "bg-primary text-white" : "bg-bg-subtle text-text-muted hover:text-text-primary"
              }`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
                  activeTag === tag ? "bg-primary text-white" : "bg-bg-subtle text-text-muted hover:text-text-primary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {filtered.map((note) => (
              <button
                key={note.id}
                onClick={() => selectNote(note)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  activeNoteId === note.id
                    ? "bg-bg-overlay border border-primary/30"
                    : "bg-bg-elevated border border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-sm text-text-primary truncate">{note.title}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-text-muted hover:text-severity-high flex-shrink-0 ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="badge bg-bg-subtle text-text-muted text-[10px] capitalize">{note.tag}</span>
                  <span className="text-[10px] text-text-muted">{note.lastEdited}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1">
          {activeNote ? (
            <Card className="bg-bg-elevated border border-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <input
                  value={activeNote.title}
                  onChange={(e) => updateNote("title", e.target.value)}
                  className="flex-1 text-lg font-semibold text-text-primary bg-transparent border-none outline-none"
                  placeholder="Note title..."
                />
                <select
                  value={activeNote.tag}
                  onChange={(e) => updateNote("tag", e.target.value)}
                  className="input-base h-8 rounded-md border border-border bg-bg-subtle px-2 text-xs capitalize"
                >
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="min-h-[400px] w-full font-mono text-sm"
                placeholder="Write your notes here (Markdown supported)..."
              />

              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-text-muted">Auto-save enabled</span>
                <Button size="sm" className="flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="bg-bg-elevated border border-border p-12 text-center">
              <FileText className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-text-muted text-sm">Select a note or create a new one</p>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
