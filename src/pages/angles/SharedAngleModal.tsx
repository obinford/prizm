// Shared angle view (design.md §angles S5) — read-only presentation card with
// spectrum border, full-opacity snapshot, note, author line, trial CTA.

import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Angle } from '@/pages/angles/store'
import Snapshot from '@/pages/angles/Snapshot'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function SharedAngleModal({ angle, onClose }: { angle: Angle; onClose: () => void }) {
  const { user } = useAuth()
  const author = user?.name ?? 'Prizm user'
  const created = new Date(angle.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  // Note-type angles store the note inside a text snapshot too — render it
  // once (as the full note below), not twice.
  const noteInSnapshot =
    Boolean(angle.note) && angle.snapshot?.kind === 'text' && angle.snapshot.text === angle.note
  const snapshot = noteInSnapshot ? { ...angle.snapshot, text: undefined } : angle.snapshot
  const tags = Array.isArray(angle.tags) ? angle.tags : []

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,5,12,0.7)] p-4 backdrop-blur-[8px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Shared angle"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-xl p-[1.5px]"
        style={{ background: 'var(--gradient-spectrum)' }}
      >
        <div className="rounded-[22.5px] bg-bg-1 p-7">
          <div className="flex items-center justify-between">
            <p className="overline-caption text-sp-indigo">Shared angle</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-sm p-1.5 text-text-3 transition-colors hover:bg-bg-2 hover:text-text-1"
            >
              <X size={16} />
            </button>
          </div>

          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-text-1">
            {angle.title}
          </h3>
          <p className="data-mono mt-1 text-[11px] uppercase tracking-wider text-text-3">
            {angle.sport} · {created}
          </p>

          {/* Full snapshot at 100% opacity */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mt-5"
          >
            <Snapshot snapshot={snapshot} muted={false} />
          </motion.div>

          {angle.note && <p className="mt-4 text-sm leading-relaxed text-text-2">{angle.note}</p>}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="data-mono rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] text-text-2">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <p className="mt-5 text-[13px] text-text-3">
            via <span className="font-medium text-text-1">{author}</span> · Prizm
          </p>

          <div className="mt-5 border-t border-line pt-5">
            <Link
              to="/register"
              className="block rounded-md bg-sp-indigo px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ boxShadow: '0 0 32px rgba(99,102,241,0.35)' }}
            >
              Make your own — start a 7-day free trial
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
