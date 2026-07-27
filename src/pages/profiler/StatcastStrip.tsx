// Profiler — Statcast strip (MLB only): real Baseball Savant season metrics
// (xBA / xSLG / xwOBA / Barrel% / Hard-Hit% / Whiff% / avg EV), heat-tinted vs
// league-average constants on the standard ramp. Omitted cleanly for NHL
// players and MLB players without sv coverage.

import { motion } from 'framer-motion'
import { deltaPct, heatCell } from '@/lib/heat'
import { LEAGUE_AVG, fmtEv, fmtRate, fmtSvPct, hasSavant } from '@/lib/savant'
import type { AnyPlayer } from '@/pages/profiler/derive'

interface Metric {
  label: string
  value: string
  /** heat delta vs league average (null → neutral cell, e.g. xBA/xSLG) */
  dPct: number | null
}

export default function StatcastStrip({ player }: { player: AnyPlayer }) {
  if (player.sport !== 'mlb' || !hasSavant(player)) return null

  const pitcher = player.kind === 'pitcher'
  // Direction: for pitchers, suppression stats (xwoba/barrel/HH/EV) are better
  // BELOW league average — invert so "good for the player" tints red. Whiff%
  // is good-high for pitchers, good-low for batters.
  const sign = (goodHigh: boolean) => (goodHigh ? 1 : -1)
  const vs = (value: number, avg: number, goodHigh: boolean) =>
    deltaPct(value, avg) * sign(goodHigh)

  const xwoba = player.xwobaReal ?? (player.kind === 'pitcher' ? player.xwoba : null)

  const metrics: Metric[] = [
    ...(player.xba != null ? [{ label: 'xBA', value: fmtRate(player.xba), dPct: null }] : []),
    ...(player.xslg != null ? [{ label: 'xSLG', value: fmtRate(player.xslg), dPct: null }] : []),
    ...(xwoba != null
      ? [{ label: 'xwOBA', value: fmtRate(xwoba), dPct: vs(xwoba, LEAGUE_AVG.xwoba, !pitcher) }]
      : []),
    ...(player.barrelPct != null
      ? [{ label: 'Barrel%', value: fmtSvPct(player.barrelPct), dPct: vs(player.barrelPct, LEAGUE_AVG.barrelPct, !pitcher) }]
      : []),
    ...(player.hardHitPct != null
      ? [{ label: 'Hard-Hit%', value: fmtSvPct(player.hardHitPct), dPct: vs(player.hardHitPct, LEAGUE_AVG.hardHitPct, !pitcher) }]
      : []),
    ...(player.whiffPct != null
      ? [{ label: 'Whiff%', value: fmtSvPct(player.whiffPct), dPct: vs(player.whiffPct, LEAGUE_AVG.whiffPct, pitcher) }]
      : []),
    ...(player.avgEv != null
      ? [{ label: 'Avg EV', value: fmtEv(player.avgEv), dPct: vs(player.avgEv, LEAGUE_AVG.avgEv, !pitcher) }]
      : []),
  ]

  if (metrics.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="prizm-card px-5 py-4"
      aria-label="Statcast metrics"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="overline-caption text-text-3">Statcast</p>
        <span className="data-mono rounded-sm border border-sp-cyan/40 bg-sp-cyan/10 px-1 py-px text-[8px] font-bold tracking-widest text-sp-cyan">
          STCAST
        </span>
        <span className="data-mono text-[10px] text-text-3">
          real Baseball Savant metrics · tinted vs league average
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {metrics.map((m, i) => {
          const { background, textClass } = m.dPct == null ? { background: 'rgba(148,163,184,0.05)', textClass: 'text-text-1' } : heatCell(m.dPct)
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="rounded-md px-3 py-2.5"
              style={{ backgroundColor: background }}
              title={m.dPct == null ? undefined : `${m.dPct > 0 ? '+' : ''}${m.dPct.toFixed(1)}% vs league average`}
            >
              <span className="overline-caption block text-text-3">{m.label}</span>
              <span className={`data-mono text-lg font-semibold ${textClass}`}>{m.value}</span>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}
