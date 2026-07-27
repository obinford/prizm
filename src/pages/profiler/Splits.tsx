// Profiler S3b — Splits: 2×3 grid of split cards. Big mono value, delta chip
// vs baseline, mini heat strip across the 4 rolling windows (tooltips on squares).

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { splitCards, type AnyPlayer } from '@/pages/profiler/derive'
import { deltaTextClass, formatDelta, heatBg } from '@/lib/heat'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function Splits({ player }: { player: AnyPlayer }) {
  const cards = useMemo(() => splitCards(player), [player])

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
            <span
              className={`data-mono rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
                // polarity-adjust chip color: invert stats flip sign for "good"
                (card.invert ? -card.deltaPct : card.deltaPct) >= 0
                  ? 'bg-pos/15 text-[#FCA5A5]'
                  : 'bg-neg/15 text-[#93C5FD]'
              }`}
              title={`${formatDelta(card.deltaPct)}% vs season baseline`}
            >
              {formatDelta(card.deltaPct)}%
            </span>
          </div>
          {/* Mini heat strip — 4 rolling windows */}
          <div className="mt-3 flex gap-1.5">
            {card.windows.map((d, wi) => {
              const polarity = card.invert ? -d : d
              return (
                <motion.span
                  key={card.windowLabels[wi]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.06 + wi * 0.05 }}
                  className="data-mono flex h-8 flex-1 items-center justify-center rounded-sm text-[10px] font-semibold"
                  style={{ background: heatBg(polarity) }}
                  title={`${card.windowLabels[wi]}: ${formatDelta(d)}% vs baseline`}
                >
                  <span className={deltaTextClass(polarity)}>{card.windowLabels[wi]}</span>
                </motion.span>
              )
            })}
          </div>
          <p className="data-mono mt-2 text-[10px] text-text-3">vs season baseline · 4 windows</p>
        </motion.div>
      ))}
    </div>
  )
}
