// Profiler S3b — Splits: grid of split cards from the real sv warehouse
// (vs L/R, home/away, season level). Big mono xwOBA value, delta chip vs the
// season baseline, sample size underneath. The old 4-window heat strip was
// removed: sv splits are season-level only, so there is no split-by-window
// data to display. NHL players have no split source and see a note instead.

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { splitCards, type AnyPlayer } from '@/pages/profiler/derive'
import { formatDelta } from '@/lib/heat'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function Splits({ player }: { player: AnyPlayer }) {
  const cards = useMemo(() => splitCards(player), [player])

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-bg-1 px-6 py-10 text-center">
        <p className="text-sm font-medium text-text-2">No splits for NHL players yet.</p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-text-3">
          The split warehouse covers MLB only (vs L/R, home/away). An NHL split source isn&apos;t
          connected.
        </p>
      </div>
    )
  }

  const sampleUnit = player.kind === 'pitcher' ? 'TBF' : 'PA'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
          className="rounded-lg border border-line bg-bg-1 p-4 transition-colors hover:border-line-strong"
        >
          <p className="text-[13px] font-semibold text-text-2">{card.title}</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="data-mono text-2xl font-bold text-text-1">{card.value}</span>
            {card.deltaPct !== null && (
              <span
                className={`data-mono rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
                  // polarity-adjust chip color: invert stats flip sign for "good"
                  (card.invert ? -card.deltaPct : card.deltaPct) >= 0
                    ? 'bg-pos/15 text-[#FCA5A5]'
                    : 'bg-neg/15 text-[#93C5FD]'
                }`}
                title={`${formatDelta(card.deltaPct)}% vs season xwOBA baseline`}
              >
                {formatDelta(card.deltaPct)}%
              </span>
            )}
          </div>
          <p className="data-mono mt-2 text-[10px] text-text-3">
            {card.sample == null ? 'no coverage' : `n=${card.sample} ${sampleUnit}`} · season split · xwOBA
          </p>
        </motion.div>
      ))}
    </div>
  )
}
