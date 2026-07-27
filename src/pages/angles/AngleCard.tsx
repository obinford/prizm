// Angle card (design.md §angles S3) — type icon + inline-editable title, live
// source snapshot, inline note editor, editable tags, share/duplicate/delete.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Copy,
  Crosshair,
  Link2,
  PenLine,
  Share2,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import type { Angle, AngleType } from '@/pages/angles/store'
import { deleteAngle, duplicateAngle, updateAngle } from '@/pages/angles/store'
import Snapshot from '@/pages/angles/Snapshot'

const TYPE_ICONS: Record<AngleType, typeof Table2> = {
  table: Table2,
  ai: Sparkles,
  edge: Crosshair,
  note: PenLine,
}

interface Props {
  angle: Angle
  isNew?: boolean
  onToast: (msg: string) => void
  onChanged: () => void
  onPreviewShared: (angle: Angle) => void
}

export default function AngleCard({ angle, isNew, onToast, onChanged, onPreviewShared }: Props) {
  const Icon = TYPE_ICONS[angle.type]
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(angle.title)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(angle.note)
  const [addingTag, setAddingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingNote && noteRef.current) {
      noteRef.current.focus()
      noteRef.current.select()
    }
  }, [editingNote])

  const saveTitle = () => {
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (next && next !== angle.title) {
      updateAngle(angle.id, { title: next })
      onChanged()
    } else {
      setTitleDraft(angle.title)
    }
  }

  const saveNote = () => {
    setEditingNote(false)
    if (noteDraft.trim() !== angle.note) {
      updateAngle(angle.id, { note: noteDraft.trim() })
      onChanged()
      onToast('Note saved')
    }
  }

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, '-')
    setTagDraft('')
    setAddingTag(false)
    if (t && !angle.tags.includes(t)) {
      updateAngle(angle.id, { tags: [...angle.tags, t] })
      onChanged()
    }
  }

  const removeTag = (t: string) => {
    updateAngle(angle.id, { tags: angle.tags.filter((x) => x !== t) })
    onChanged()
  }

  const share = async () => {
    const url = `${window.location.origin}/angles?shared=${angle.id}`
    try {
      await navigator.clipboard.writeText(url)
      onToast('Share link copied')
    } catch {
      onToast(url)
    }
    if (!angle.shared) {
      updateAngle(angle.id, { shared: true })
      onChanged()
    }
  }

  const duplicate = () => {
    duplicateAngle(angle.id)
    onChanged()
    onToast('Angle duplicated')
  }

  const doDelete = () => {
    deleteAngle(angle.id)
    setConfirmDelete(false)
    onChanged()
    onToast('Angle deleted')
  }

  const created = new Date(angle.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <motion.article
      layout="position"
      initial={isNew ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="prizm-card group relative flex flex-col gap-3 p-5 transition-colors hover:border-line-strong"
      style={
        isNew
          ? { boxShadow: '0 0 0 1.5px rgba(99,102,241,0.6), 0 0 32px rgba(99,102,241,0.25)' }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-bg-2 text-sp-indigo">
          <Icon size={14} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') {
                  setTitleDraft(angle.title)
                  setEditingTitle(false)
                }
              }}
              className="w-full rounded-sm border border-sp-indigo bg-bg-2 px-1.5 py-0.5 text-[15px] font-semibold text-text-1 focus:outline-none"
              aria-label="Edit angle title"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleDraft(angle.title)
                setEditingTitle(true)
              }}
              title="Click to rename"
              className="block w-full truncate text-left text-[15px] font-semibold text-text-1 hover:text-sp-indigo"
            >
              {angle.title}
            </button>
          )}
        </div>
        <span className="data-mono shrink-0 rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-2">
          {angle.sport}
        </span>
      </div>

      {/* Source snapshot */}
      <Snapshot snapshot={angle.snapshot} />

      {/* Note area */}
      {editingNote ? (
        <textarea
          ref={noteRef}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setNoteDraft(angle.note)
              setEditingNote(false)
            }
          }}
          rows={3}
          className="w-full resize-none rounded-sm border border-sp-indigo bg-bg-2 px-2 py-1.5 text-sm leading-relaxed text-text-1 focus:outline-none"
          aria-label="Edit note"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNoteDraft(angle.note)
            setEditingNote(true)
          }}
          className="block w-full text-left"
          title="Click to edit note"
        >
          {angle.note ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-text-2">{angle.note}</p>
          ) : (
            <p className="text-sm italic text-text-3">Add a note…</p>
          )}
        </button>
      )}

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {angle.tags.map((t) => (
          <span
            key={t}
            className="data-mono flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] text-text-2"
          >
            #{t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              aria-label={`Remove tag ${t}`}
              className="text-text-3 transition-colors hover:text-danger"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {addingTag ? (
          <input
            autoFocus
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag()
              if (e.key === 'Escape') {
                setTagDraft('')
                setAddingTag(false)
              }
            }}
            placeholder="tag"
            className="data-mono w-20 rounded-sm border border-line bg-bg-2 px-1.5 py-0.5 text-[10px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none"
            aria-label="New tag"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTag(true)}
            className="rounded-sm border border-dashed border-line px-1.5 py-0.5 text-[10px] text-text-3 transition-colors hover:border-line-strong hover:text-text-1"
          >
            + tag
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-1 border-t border-line pt-3">
        <span className="data-mono text-[11px] text-text-3">{created}</span>
        {angle.shared && (
          <button
            type="button"
            onClick={() => onPreviewShared(angle)}
            className="data-mono ml-1 rounded-sm bg-sp-indigo/15 px-1.5 py-0.5 text-[10px] font-semibold text-sp-indigo transition-colors hover:bg-sp-indigo/25"
            title="Preview shared view"
          >
            shared
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={share}
            title="Copy share link"
            aria-label="Share angle"
            className="rounded-sm p-1.5 text-text-3 transition-all hover:bg-bg-2 hover:text-text-1 group-hover:translate-x-0"
          >
            <Share2 size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={duplicate}
            title="Duplicate"
            aria-label="Duplicate angle"
            className="rounded-sm p-1.5 text-text-3 transition-colors hover:bg-bg-2 hover:text-text-1"
          >
            <Copy size={14} strokeWidth={1.5} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setConfirmDelete((v) => !v)}
              title="Delete"
              aria-label="Delete angle"
              className="rounded-sm p-1.5 text-text-3 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {confirmDelete && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full right-0 z-30 mb-2 w-44 rounded-md border border-line bg-bg-2 p-3 shadow-raised"
                >
                  <p className="text-xs font-medium text-text-1">Delete this angle?</p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={doDelete}
                      className="flex-1 rounded-sm bg-danger/15 px-2 py-1.5 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/25"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-sm border border-line bg-bg-1 px-2 py-1.5 text-[11px] font-semibold text-text-2 transition-colors hover:bg-bg-3"
                    >
                      Keep
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* share icon nudge affordance */}
      <Link2 size={12} className="absolute right-4 top-4 text-text-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </motion.article>
  )
}
