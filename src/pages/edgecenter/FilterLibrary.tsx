// Filter Library — Step 11.3. Ten preset rule sets (src/lib/filterLibrary.ts)
// with live match counts computed through the same applyRules the tables use,
// a Pitcher/Batter toggle, and Open-in-table navigation that carries the
// rules to the Starters/Batters tab through the registerRules bridge.
//
// The price-alert count joins matched players to the live props board — a
// matched player with a price-alert prop is the "worth acting on" subset.

import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { LibraryBig } from 'lucide-react'
import { LIBRARY_PRESETS, type LibraryPreset } from '@/lib/filterLibrary'
import { applyRules } from '@/lib/filterRules'
import { PITCHER_COLUMNS } from '@/lib/columns/mlbPitchers'
import { BATTER_COLUMNS } from '@/lib/columns/mlbBatters'
import { getStarters } from '@/pages/dashboard/utils'
import { BATTERS } from '@/data/mlbPlayers'
import { PROPS } from '@/data/props'

function priceAlertCount(playerIds: Set<string>): number {
  let n = 0
  for (const p of PROPS) {
    if (p.priceAlert && playerIds.has(p.playerId)) n++
  }
  return n
}

function useCounts() {
  return useMemo(() => {
    const starters = getStarters()
    const batterRows = BATTERS.map((batter) => ({ batter }))
    const out = new Map<string, { matches: number; alerts: number }>()
    for (const preset of LIBRARY_PRESETS) {
      if (preset.side === 'pitcher') {
        const matched = applyRules(preset.rules, PITCHER_COLUMNS, starters)
        out.set(preset.key, {
          matches: matched.length,
          alerts: priceAlertCount(new Set(matched.map((r) => r.pitcher.id))),
        })
      } else {
        const matched = applyRules(preset.rules, BATTER_COLUMNS, batterRows)
        out.set(preset.key, {
          matches: matched.length,
          alerts: priceAlertCount(new Set(matched.map((r) => r.batter.id))),
        })
      }
    }
    return out
  }, [])
}

function PresetCard({
  preset,
  index,
  counts,
}: {
  preset: LibraryPreset
  index: number
  counts: Map<string, { matches: number; alerts: number }>
}) {
  const c = counts.get(preset.key) ?? { matches: 0, alerts: 0 }
  const tab = preset.side === 'pitcher' ? 'starters' : 'batters'
  const rulesParam = encodeURIComponent(JSON.stringify(preset.rules))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
      className="prizm-card flex flex-col p-4"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text-1">{preset.label}</span>
        <span className="data-mono text-[11px] text-text-3">
          {c.matches} match{c.matches === 1 ? '' : 'es'}
          {c.alerts > 0 && <span className="text-sp-amber"> · {c.alerts} price alert{c.alerts === 1 ? '' : 's'}</span>}
        </span>
      </div>
      <p className="mb-3 flex-1 text-[12px] leading-relaxed text-text-3">{preset.description}</p>
      <Link
        to={`/dashboard?tab=${tab}&rules=${rulesParam}`}
        className="data-mono text-[12px] font-medium text-sp-indigo transition-colors hover:text-sp-cyan"
      >
        Open in table →
      </Link>
    </motion.div>
  )
}

export default function FilterLibrary() {
  const [side, setSide] = useState<'pitcher' | 'batter'>('pitcher')
  const counts = useCounts()
  const presets = LIBRARY_PRESETS.filter((p) => p.side === side)

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mb-10"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="overline-caption mb-1 flex items-center gap-1.5 text-text-3">
            <LibraryBig size={13} /> Filter library
          </p>
          <p className="data-mono text-[11px] text-text-3">
            Saved rule sets over the season columns — counts are live against tonight's rows.
          </p>
        </div>
        <div className="flex rounded-md border border-line bg-bg-2 p-0.5">
          {(['pitcher', 'batter'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-sm px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                side === s ? 'bg-bg-1 text-text-1' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {presets.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
          No {side} presets in the library yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p, i) => (
            <PresetCard key={p.key} preset={p} index={i} counts={counts} />
          ))}
        </div>
      )}
    </motion.section>
  )
}
