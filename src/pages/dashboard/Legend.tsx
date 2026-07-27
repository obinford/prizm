// Color legend strip (dashboard.md §S4): blue→neutral→red gradient with the
// "Color = your edge" explainer tooltip.

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'

export default function LegendStrip() {
  const [tipOpen, setTipOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="data-mono text-[11px] text-text-3">Worse than baseline</span>
      <div
        className="h-1.5 w-[120px] rounded-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(59,130,246,0.64) 0%, rgba(59,130,246,0.18) 30%, rgba(148,163,184,0.10) 50%, rgba(239,68,68,0.18) 70%, rgba(239,68,68,0.64) 100%)',
        }}
      />
      <span className="data-mono text-[11px] text-text-3">Better than baseline</span>
      <div className="relative">
        <button
          type="button"
          aria-label="How heat colors work"
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
          onFocus={() => setTipOpen(true)}
          onBlur={() => setTipOpen(false)}
          className="-m-3 flex min-h-10 min-w-10 items-center justify-center text-text-3 transition-colors hover:text-text-1"
        >
          <Info size={13} />
        </button>
        <AnimatePresence>
          {tipOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-md border border-line bg-bg-2 p-3 shadow-raised"
            >
              <p className="text-xs leading-relaxed text-text-2">
                Every cell compares the rolling window to the player's season baseline.{' '}
                <span className="text-[#FCA5A5]">Red = edge for your angle</span>,{' '}
                <span className="text-[#93C5FD]">blue = fade</span>. Δ shown under each value.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="ml-auto hidden text-[11px] text-text-3 sm:block">Color = your edge</span>
    </div>
  )
}
