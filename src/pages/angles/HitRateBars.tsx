// Hit-rate mini bars (design.md §7.11): 4px track bg-3, fill gradient
// gray→indigo, ≥70% switches to pos-red gradient. Shared by Profiler rail
// and My Angles snapshots.

import { motion } from 'framer-motion'
import type { HitWindow } from '@/data/props'

const WINDOWS: { key: HitWindow; label: string }[] = [
  { key: 'L5', label: 'L5' },
  { key: 'L10', label: 'L10' },
  { key: 'L20', label: 'L20' },
]

export default function HitRateBars({
  rates,
  compact = false,
}: {
  rates: Record<HitWindow, number>
  compact?: boolean
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {WINDOWS.map((w, i) => {
        const pct = Math.round(rates[w.key] * 100)
        const hot = rates[w.key] >= 0.7
        return (
          <div key={w.key} className="flex items-center gap-2">
            <span className="data-mono w-6 shrink-0 text-[10px] text-text-3">{w.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-3">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{
                  background: hot
                    ? 'linear-gradient(90deg, rgba(239,68,68,0.5), #EF4444)'
                    : 'linear-gradient(90deg, var(--text-3), var(--sp-indigo))',
                }}
              />
            </div>
            <span
              className={`data-mono w-8 shrink-0 text-right text-[10px] font-semibold ${
                hot ? 'text-[#FCA5A5]' : 'text-text-2'
              }`}
            >
              {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
