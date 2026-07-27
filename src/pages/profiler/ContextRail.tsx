// Profiler S4 — hit-rate context rail: "Prop context" (top markets with
// L5/L10/L20 mini-bars, tonight's line, Zap badge on value) + "Similar profiles".

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { formatOdds, getPlayerProps } from '@/data/props'
import type { AnyPlayer } from '@/pages/profiler/derive'
import HitRateBars from '@/pages/angles/HitRateBars'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Props {
  player: AnyPlayer
  /** Kept for the Drawer's player-switching API; unused while Similar profiles is removed. */
  onSelectPlayer: (id: string) => void
}

export default function ContextRail({ player }: Props) {
  const props = useMemo(
    () => getPlayerProps(player.id).sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0)).slice(0, 4),
    [player],
  )

  return (
    <div className="space-y-4">
      {/* Prop context */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
        className="prizm-card p-5"
        aria-label="Prop context"
      >
        <h3 className="overline-caption text-text-3">Prop context</h3>
        {props.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-3">No props on the board for this player tonight.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {props.map((prop) => (
              <div key={prop.id}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-1">{prop.market}</span>
                  <span className="data-mono text-[11px] text-text-3">
                    O {prop.line} ({formatOdds(prop.overPrice)}) · {prop.opponent}
                  </span>
                  {prop.priceAlert && (
                    <span
                      className="ml-auto flex items-center gap-1 rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
                      title="Price alert — the number looks wrong vs recent hit rates"
                    >
                      <Zap size={10} /> value
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <HitRateBars rates={prop.hitRates} />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Similar profiles — removed. The old list picked players by array
          offset (every 7th name in the pool), which is not similarity. It
          returns when a real similarity model exists. */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: EASE }}
        className="prizm-card p-5"
        aria-label="Similar profiles"
      >
        <h3 className="overline-caption text-text-3">Similar profiles</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-text-3">
          Removed. The previous picks were neighbouring entries in the player list, not players
          with genuinely similar profiles.
        </p>
      </motion.section>
    </div>
  )
}
