// Stats & Colors modal — one help surface, available on every dashboard tab.
//
// Three jobs (Step 14):
//   1. Context-aware help: names the tab you are on and describes every
//      sibling in one line.
//   2. The colour contract: what the heat ramp means, the two things Prizm
//      does differently said out loud, and the colourblind palette toggle.
//   3. Per-column definitions for the current tab, deep-linking into
//      /glossary#<key> (Step 7's anchor support).
//
// Nothing here re-states a definition by hand — column text comes from the
// ColumnDefs themselves, the same source the header tooltips and glossary
// read. A definition that reads badly is fixed in the column, not here.

import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import type { ColumnDef } from '@/lib/columns'
import { heatBg } from '@/lib/heat'
import { useHeatPalette, setHeatPalette } from '@/lib/heatPalette'
import { PITCHER_COLUMNS, pitcherWindowColumns } from '@/lib/columns/mlbPitchers'
import { BATTER_COLUMNS, BATTER_ORDER_COLUMN, batterWindowColumns } from '@/lib/columns/mlbBatters'
import { BULLPEN_COLUMNS } from '@/lib/columns/mlbBullpen'
import { teamColumns } from '@/lib/columns/mlbTeams'
import { MLB_WINDOW_KEYS, MLB_WINDOW_LABELS } from '@/data/mlbPlayers'

export type DashboardTabKey =
  | 'gamecenter'
  | 'edgecenter'
  | 'starters'
  | 'teams'
  | 'bullpen'
  | 'batters'
  | 'weather'

const TAB_INFO: { key: DashboardTabKey; label: string; blurb: string }[] = [
  { key: 'gamecenter', label: 'Gamecenter', blurb: 'Per-game matchup reads — probables, official lineups, splits and angles for the slate.' },
  { key: 'edgecenter', label: 'Edgecenter', blurb: 'The daily brief — quick alerts, hot/cold bats, your saved filters and watchlist.' },
  { key: 'starters', label: 'Starters', blurb: 'Probable starters with season, window and split stats, heat-mapped against their own baselines.' },
  { key: 'teams', label: 'Team Stats', blurb: 'Team-level batting, pitching and bullpen aggregates — the context behind the props.' },
  { key: 'bullpen', label: 'Bullpen', blurb: 'Reliever corps by team — form and coverage for the late innings.' },
  { key: 'batters', label: 'Batters', blurb: "Tonight's posted lineups in batting order, with per-batter windows against the opposing starter." },
  { key: 'weather', label: 'Weather', blurb: 'Ballpark Pal park + weather factors for every game on the slate.' },
]

/** Column-driven tabs and their ColumnDef lists (window factories expanded). */
function columnsFor(tab: DashboardTabKey): ColumnDef<any>[] {
  switch (tab) {
    case 'starters':
      return [
        ...PITCHER_COLUMNS,
        ...MLB_WINDOW_KEYS.flatMap((w) => pitcherWindowColumns(w, MLB_WINDOW_LABELS[w])),
      ]
    case 'batters':
      return [
        BATTER_ORDER_COLUMN,
        ...BATTER_COLUMNS,
        ...MLB_WINDOW_KEYS.flatMap((w) => batterWindowColumns(w, MLB_WINDOW_LABELS[w])),
      ]
    case 'bullpen':
      return BULLPEN_COLUMNS
    case 'teams':
      // League means only drive heat baselines; this view reads
      // label/definition/source/markets, so empty means are correct here.
      return teamColumns({})
    default:
      return []
  }
}

/** Sample deltas that land on ramp steps 1–5 for the legend swatches. */
const LEGEND_DELTAS = [3, 7, 14, 21, 30]

function ColourContract() {
  const palette = useHeatPalette()
  return (
    <section>
      <p className="overline-caption mb-3 text-text-3">The colour contract</p>

      {/* Ramp legend — painted live from heat.ts, so it follows the toggle */}
      <div className="mb-3 space-y-2">
        {(['pos', 'neg'] as const).map((side) => (
          <div key={side} className="flex items-center gap-2">
            <span className="data-mono w-24 text-[11px] text-text-3">
              {side === 'pos' ? 'above baseline' : 'below baseline'}
            </span>
            <div className="flex gap-1">
              {LEGEND_DELTAS.map((d) => (
                <span
                  key={d}
                  className="data-mono flex h-6 w-10 items-center justify-center rounded-sm text-[9px] text-text-1"
                  style={{ background: heatBg(side === 'pos' ? d : -d) }}
                  title={`${side === 'pos' ? '+' : '−'}${d}% vs season baseline`}
                >
                  {side === 'pos' ? '+' : '−'}
                  {d}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[12px] leading-relaxed text-text-3">
          A tinted cell means the window number is running that far above or below the player's
          own season baseline. Steps: ±2%, ±5%, ±10%, ±18%, ±25%.
        </p>
      </div>

      {/* The two things Prizm does differently — said out loud */}
      <ul className="mb-4 space-y-1.5 text-[13px] leading-relaxed text-text-2">
        <li>
          <span className="font-semibold text-text-1">The heat renders.</span> On every table,
          every window column — not just on a flagship view.
        </li>
        <li>
          <span className="font-semibold text-text-1">Colour is baseline-relative,</span> not
          league-relative. It answers "is he hot right now", not "is he good" — and for props,
          that is the better question.
        </li>
      </ul>

      {/* Colourblind palette toggle — first-class, persisted */}
      <button
        type="button"
        role="switch"
        aria-checked={palette === 'colourblind'}
        onClick={() => setHeatPalette(palette === 'colourblind' ? 'default' : 'colourblind')}
        className={`flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
          palette === 'colourblind'
            ? 'border-sp-indigo/40 bg-sp-indigo/10 text-sp-indigo'
            : 'border-line bg-bg-2 text-text-2 hover:text-text-1'
        }`}
      >
        <span
          className={`relative h-4 w-7 rounded-full transition-colors ${
            palette === 'colourblind' ? 'bg-sp-indigo' : 'bg-bg-3'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
              palette === 'colourblind' ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </span>
        Colourblind-safe palette (orange / blue)
        <span className="data-mono text-[10px] text-text-3">saved</span>
      </button>
    </section>
  )
}

export default function StatsColorsModal({
  tab,
  onClose,
}: {
  tab: DashboardTabKey
  onClose: () => void
}) {
  const current = TAB_INFO.find((t) => t.key === tab)
  const cols = columnsFor(tab)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-label="Stats and colors help"
        className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-bg-1 p-6 shadow-raised"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-text-1">Stats &amp; Colors</h3>
            <p className="mt-0.5 text-[12px] text-text-3">
              You are on <span className="font-semibold text-text-2">{current?.label ?? tab}</span> —{' '}
              {current?.blurb}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
            aria-label="Close help"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Every sibling tab in one line */}
          <section>
            <p className="overline-caption mb-2 text-text-3">All tabs</p>
            <ul className="space-y-1">
              {TAB_INFO.map((t) => (
                <li key={t.key} className="flex items-baseline gap-2 text-[12px] leading-relaxed">
                  <span
                    className={`data-mono w-24 shrink-0 font-semibold ${
                      t.key === tab ? 'text-sp-indigo' : 'text-text-2'
                    }`}
                  >
                    {t.label}
                    {t.key === tab && ' ←'}
                  </span>
                  <span className="text-text-3">{t.blurb}</span>
                </li>
              ))}
            </ul>
          </section>

          <ColourContract />

          {/* Per-column definitions for this tab */}
          <section>
            <p className="overline-caption mb-2 text-text-3">
              Columns on {current?.label ?? tab}
            </p>
            {cols.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-text-3">
                This tab's tables are not column-driven, so there is no per-column list here. Every
                stat Prizm shows anywhere is defined in the{' '}
                <Link to="/glossary" onClick={onClose} className="text-sp-indigo hover:text-sp-cyan">
                  glossary
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {cols.map((c, i) => (
                  <li key={`${c.key}-${i}`} className="rounded-md border border-line bg-bg-2 px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link
                        to={`/glossary#${c.key}`}
                        onClick={onClose}
                        className="data-mono inline-flex items-center gap-1 text-[12px] font-semibold text-sp-indigo hover:text-sp-cyan"
                        title="Open in glossary"
                      >
                        {c.label}
                        {c.group ? ` · ${c.group}` : ''}
                        <ArrowUpRight size={11} />
                      </Link>
                      {c.markets && c.markets.length > 0 && (
                        <span className="data-mono text-[10px] text-text-3">
                          {c.markets.join(', ')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-text-2">{c.definition}</p>
                    <p className="data-mono mt-0.5 text-[10px] text-text-3">Source: {c.source}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </motion.div>
    </>
  )
}
