// New angle modal (design.md §angles S6) — title, sport select, note, tag input
// (Enter to add), Attach row (pick from recent saves), Create → animates into grid.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  addAngle,
  attachOptions,
  textSnapshot,
  type Sport,
  type Angle,
} from '@/pages/angles/store'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Props {
  onClose: () => void
  onCreated: (angle: Angle) => void
}

const FIELD_CLS =
  'h-11 w-full rounded-sm border border-line bg-bg-2 px-3 text-[15px] text-text-1 placeholder:text-text-3 transition-colors focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-sp-indigo/25'

export default function NewAngleModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState<Sport>('mlb')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [attachId, setAttachId] = useState('')
  const options = useMemo(() => attachOptions(), [])

  const commitTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, '-')
    setTagDraft('')
    if (t && !tags.includes(t)) setTags([...tags, t])
  }

  const create = () => {
    const attach = options.find((o) => o.id === attachId)
    const angle = addAngle({
      title: title.trim() || attach?.title || 'Untitled angle',
      sport: attach?.sport ?? sport,
      type: attach?.type ?? 'note',
      note: note.trim(),
      tags,
      shared: false,
      snapshot:
        attach?.snapshot ??
        textSnapshot(note.trim() || 'Free-form research note.', `My Angles · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`),
    })
    onCreated(angle)
  }

  const fieldMotion = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: 0.06 + i * 0.04, ease: EASE },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,5,12,0.7)] p-4 backdrop-blur-[8px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New angle"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-xl border border-line bg-bg-1 p-6 shadow-raised"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-text-1">New angle</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm p-1.5 text-text-3 transition-colors hover:bg-bg-2 hover:text-text-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <motion.div {...fieldMotion(0)}>
            <label htmlFor="angle-title" className="overline-caption mb-1.5 block text-text-3">
              Title
            </label>
            <input
              id="angle-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Judge XBH over at Fenway"
              className={FIELD_CLS}
            />
          </motion.div>

          <motion.div {...fieldMotion(1)}>
            <label htmlFor="angle-sport" className="overline-caption mb-1.5 block text-text-3">
              Sport
            </label>
            <select
              id="angle-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className={FIELD_CLS}
            >
              <option value="mlb">MLB</option>
              <option value="nhl">NHL</option>
            </select>
          </motion.div>

          <motion.div {...fieldMotion(2)}>
            <label htmlFor="angle-note" className="overline-caption mb-1.5 block text-text-3">
              Note
            </label>
            <textarea
              id="angle-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What's the angle? Windows, matchup, price…"
              className="w-full resize-none rounded-sm border border-line bg-bg-2 px-3 py-2.5 text-[15px] leading-relaxed text-text-1 placeholder:text-text-3 transition-colors focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-sp-indigo/25"
            />
          </motion.div>

          <motion.div {...fieldMotion(3)}>
            <label htmlFor="angle-tags" className="overline-caption mb-1.5 block text-text-3">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-2">
              {tags.map((t) => (
                <span key={t} className="data-mono flex items-center gap-1 rounded-sm bg-bg-3 px-1.5 py-0.5 text-[11px] text-text-2">
                  #{t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Remove tag ${t}`}
                    className="text-text-3 hover:text-danger"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                id="angle-tags"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTag()
                  }
                }}
                onBlur={commitTag}
                placeholder="Type + Enter"
                className="data-mono min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-[12px] text-text-1 placeholder:text-text-3 focus:outline-none"
              />
            </div>
          </motion.div>

          <motion.div {...fieldMotion(4)}>
            <label htmlFor="angle-attach" className="overline-caption mb-1.5 block text-text-3">
              Attach
            </label>
            <select
              id="angle-attach"
              value={attachId}
              onChange={(e) => setAttachId(e.target.value)}
              className={FIELD_CLS}
            >
              <option value="">None — plain note</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-3">Pick from recent tables, props and AI answers.</p>
          </motion.div>

          <motion.div {...fieldMotion(5)} className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-semibold text-text-1 transition-colors hover:bg-bg-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              className="flex-1 rounded-md bg-sp-indigo px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            >
              Create angle
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
