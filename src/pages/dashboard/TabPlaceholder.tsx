// Honest placeholder for a tab whose data source does not exist yet.
//
// House rule: when a surface is not backed by real data it says so plainly and
// names what is missing. It never renders a plausible-looking table.

import { motion } from 'framer-motion'
import { Construction } from 'lucide-react'

export interface TabPlaceholderProps {
  title: string
  /** One sentence on what this tab will show. */
  summary: string
  /** Exactly what has to exist before it can be built. */
  blockers: string[]
  /** Data that already exists and is not yet wired, if any. */
  available?: string[]
}

export default function TabPlaceholder({
  title,
  summary,
  blockers,
  available,
}: TabPlaceholderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="prizm-card p-8"
    >
      <div className="mb-4 flex items-center gap-3">
        <Construction size={20} strokeWidth={1.5} className="text-sp-amber" />
        <h3 className="font-display text-lg font-semibold text-text-1">{title}</h3>
        <span className="data-mono rounded-sm border border-sp-amber/40 bg-sp-amber/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-widest text-sp-amber">
          Not built
        </span>
      </div>

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-text-2">{summary}</p>

      <p className="overline-caption mb-2 text-text-3">Blocked on</p>
      <ul className="mb-6 space-y-1.5">
        {blockers.map((b) => (
          <li key={b} className="flex gap-2 text-[13px] text-text-3">
            <span aria-hidden className="text-text-3">
              —
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {available && available.length > 0 && (
        <>
          <p className="overline-caption mb-2 text-text-3">Already ingested, not yet wired</p>
          <ul className="space-y-1.5">
            {available.map((a) => (
              <li key={a} className="flex gap-2 text-[13px] text-text-2">
                <span aria-hidden className="text-success">
                  ✓
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.div>
  )
}
