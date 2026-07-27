// Profiler S4 — hit-rate context rail: "Prop context" (top markets with
// L5/L10/L20 mini-bars, tonight's line, Zap badge on value) + "Similar profiles".

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { formatOdds, getPlayerProps } from '@/data/props'
import { initials, similarPlayers, type AnyPlayer } from '@/pages/profiler/derive'
import HitRateBars from '@/pages/angles/HitRateBars'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Props {
  player: AnyPlayer
  onSelectPlayer: (id: string) => void
}

export default function ContextRail({ player, onSelectPlayer }: Props) {
  const props = useMemo(
    () => getPlayerProps(player.id).sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0)).slice(0, 4),
    [player],
  )
  const similar = useMemo(() => similarPlayers(player), [player])

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

      {/* Similar profiles */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: EASE }}
        className="prizm-card p-5"
        aria-label="Similar profiles"
      >
        <h3 className="overline-caption text-text-3">Similar profiles</h3>
        <div className="mt-3 space-y-1.5">
          {similar.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectPlayer(s.id)}
              className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-bg-2"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-text-1"
                style={{
                  background:
                    'linear-gradient(var(--bg-3), var(--bg-3)) padding-box, var(--gradient-spectrum) border-box',
                  border: '1.5px solid transparent',
                }}
              >
                {initials(s.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-1">{s.name}</span>
                <span className="data-mono block text-[10px] text-text-3">
                  {s.team} · {s.pos} · {s.sport.toUpperCase()}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
