// Save-to-angle popover + shared toast UI (design.md §7.10).
// Storage + toast state live in ./angleStore.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Plus } from 'lucide-react'
import type { Angle } from './angleStore'
import { getAngles } from './angleStore'

// ---------------------------------------------------------------------------
// Toast (bottom-right, spectrum bar, auto-dismiss handled by useToast)
// ---------------------------------------------------------------------------

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-4 pr-5 shadow-raised"
          role="status"
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--gradient-spectrum)' }} />
          <span className="text-sm text-text-1">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Save-to-angle popover (pick existing angle or create new)
// ---------------------------------------------------------------------------

export interface AnglePopoverProps {
  onPick: (angleId: string | null, newName?: string) => void
  onClose: () => void
}

export function AnglePopover({ onPick, onClose }: AnglePopoverProps) {
  const [angles] = useState<Angle[]>(() => getAngles())
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-md border border-line bg-bg-2 p-1.5 shadow-raised"
      role="menu"
      aria-label="Save to angle"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="overline-caption px-2.5 pb-1.5 pt-1 text-text-3">Save to angle</p>
      <div className="max-h-44 overflow-y-auto">
        {angles.length === 0 && (
          <p className="px-2.5 py-2 text-[13px] text-text-3">No angles yet — create one below.</p>
        )}
        {angles.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <Bookmark size={12} className="shrink-0 text-sp-magenta" />
            <span className="flex-1 truncate">{a.title}</span>
            <span className="data-mono text-[10px] text-text-3">
              {Array.isArray(a.items) ? a.items.length : 0}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1.5 border-t border-line p-1.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) onPick(null, newName)
          }}
          placeholder="New angle name…"
          className="h-8 min-w-0 flex-1 rounded-sm border border-line bg-bg-1 px-2 text-[13px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none"
        />
        <button
          type="button"
          disabled={!newName.trim()}
          onClick={() => onPick(null, newName)}
          aria-label="Create angle"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-sp-indigo text-white transition-all hover:brightness-110 disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>
    </motion.div>
  )
}
