'use client'

import { useState } from 'react'
import { Plus, Save, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ProjectNote } from '@/lib/types'

interface ProjectNotesProps {
  notes: ProjectNote[]
  onSave: (note: Partial<ProjectNote>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ProjectNotes({ notes, onSave, onDelete }: ProjectNotesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id || null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = notes.find((n) => n.id === selectedId)

  function handleSelect(id: string) {
    const note = notes.find((n) => n.id === id)
    if (note) {
      setSelectedId(id)
      setTitle(note.title)
      setContent(note.content || '')
      setTags(note.tags)
    }
  }

  function handleNew() {
    setSelectedId(null)
    setTitle('')
    setContent('')
    setTags([])
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ title, content, tags })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-4 h-[500px]">
      <div className="w-64 flex-shrink-0 bg-bg-surface rounded-lg border border-border overflow-y-auto">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Notes</span>
          <Button variant="ghost" size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {notes.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-muted">No notes yet</div>
        ) : (
          notes.map((note) => (
            <button
              key={note.id}
              onClick={() => handleSelect(note.id)}
              className={`w-full text-left px-3 py-2 border-b border-border text-sm transition-colors ${
                selectedId === note.id ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-subtle'
              }`}
            >
              <div className="font-medium truncate">{note.title}</div>
              <div className="text-xs text-text-muted mt-0.5">{note.tags.slice(0, 2).join(', ')}</div>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <Input placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Write your notes in markdown..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[300px]"
        />
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-text-muted" />
          <div className="flex flex-wrap gap-1 flex-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-subtle text-text-secondary text-xs rounded-full"
              >
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-text-primary">
                  &times;
                </button>
              </span>
            ))}
            <input
              className="text-sm bg-transparent border-none outline-none text-text-secondary w-20"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {selectedId && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(selectedId)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
