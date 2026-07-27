// Pitchers tab — the signature rolling split table (dashboard.md §S5).
// Extends the shared SplitTable's visual contract (sticky player column,
// indigo season group, heat cells + delta chips, hover tooltips, skeleton,
// mobile cards) with the pitcher-specific Edge column, sortable headers and
// per-row "+ Angle" action required by the design. Built page-locally because
// the shared SplitTable component (which the Lineups tab uses) has a fixed
// column model that cannot express these.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, BookmarkPlus, Flame, Gem } from 'lucide-react'
import type { MlbWindowKey } from '@/data/mlbPlayers'
import { MLB_WINDOW_LABELS } from '@/data/mlbPlayers'
import { deltaPct, deltaTextClass, formatDelta, heatCell } from '@/lib/heat'
import { fmtSvPct, hasSavant } from '@/lib/savant'
import type { SplitKey, StarterEntry } from './utils'
import { edgeScore, fmtEra, fmtPct, fmtWhip, fmtXwoba, splitFactor } from './utils'
import { AnglePopover, Toast } from './angles'
import { addToAngle, useToast } from './angleStore'
import PitcherDrawer from './PitcherDrawer'
import LegendStrip from './Legend'

export type StatKey = 'era' | 'whip' | 'kPct' | 'bbPct' | 'xwoba'

const STAT_META: Record<
  StatKey,
  { label: string; invert: boolean; fmt: (v: number) => string; deltaDec: number; toDisplay: (v: number) => number }
> = {
  era: { label: 'ERA', invert: true, fmt: fmtEra, deltaDec: 2, toDisplay: (v) => v },
  whip: { label: 'WHIP', invert: true, fmt: fmtWhip, deltaDec: 2, toDisplay: (v) => v },
  kPct: { label: 'K%', invert: false, fmt: fmtPct, deltaDec: 1, toDisplay: (v) => v * 100 },
  bbPct: { label: 'BB%', invert: true, fmt: fmtPct, deltaDec: 1, toDisplay: (v) => v * 100 },
  xwoba: { label: 'xwOBA', invert: true, fmt: fmtXwoba, deltaDec: 3, toDisplay: (v) => v },
}

const SEASON_STATS: StatKey[] = ['era', 'whip', 'kPct', 'bbPct', 'xwoba']

/** Market filter → stat focus for the window groups (default: K% + ERA). */
function focusStats(market: string | undefined): StatKey[] {
  switch (market) {
    case 'ks':
      return ['kPct']
    case 'hits':
      return ['whip']
    case 'er':
      return ['era']
    case 'outs':
      return ['xwoba']
    default:
      return ['kPct', 'era']
  }
}

interface Row {
  entry: StarterEntry
  season: Record<StatKey, number>
  windows: Record<MlbWindowKey, Record<StatKey, number> & { bf: number }>
  edge: number
}

type SortKey = 'edge' | StatKey | `w:${MlbWindowKey}`

interface SortState {
  key: SortKey
  dir: 1 | -1
}

export interface PitcherTableProps {
  entries: StarterEntry[]
  loading: boolean
  market: string | undefined
  windows: MlbWindowKey[]
  split: SplitKey | undefined
  /** bump on any filter change to replay the re-tint sweep + row restagger */
  filterSig: string
  onResetFilters: () => void
}

interface HoverCell {
  id: string
  w: MlbWindowKey
  stat: StatKey
}

export default function PitcherTable({
  entries,
  loading,
  market,
  windows,
  split,
  filterSig,
  onResetFilters,
}: PitcherTableProps) {
  const [hover, setHover] = useState<HoverCell | null>(null)
  const [selected, setSelected] = useState<StarterEntry | null>(null)
  const [angleFor, setAngleFor] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'edge', dir: -1 })
  const [toast, showToast] = useToast()

  const stats = focusStats(market)

  const rows = useMemo<Row[]>(() => {
    return entries.map((entry) => {
      const p = entry.pitcher
      const season = {} as Record<StatKey, number>
      for (const s of SEASON_STATS) season[s] = p[s] * splitFactor(p.id, split, s)
      const wins = {} as Row['windows']
      for (const w of windows) {
        const src = p.windows[w]
        const adj = { bf: src.bf } as Record<StatKey, number> & { bf: number }
        for (const s of SEASON_STATS) adj[s] = src[s] * splitFactor(p.id, split, s)
        wins[w] = adj
      }
      return { entry, season, windows: wins, edge: edgeScore(p) }
    })
  }, [entries, windows, split])

  const sorted = useMemo(() => {
    const primary = stats[0]
    const arr = [...rows]
    const val = (r: Row): number => {
      if (sort.key === 'edge') return r.edge
      if (sort.key.startsWith('w:')) {
        const w = sort.key.slice(2) as MlbWindowKey
        const meta = STAT_META[primary]
        let d = deltaPct(r.windows[w][primary], r.season[primary])
        if (meta.invert) d = -d
        return d
      }
      return r.season[sort.key as StatKey]
    }
    arr.sort((a, b) => (val(a) - val(b)) * (sort.dir === 1 ? 1 : -1))
    return arr
  }, [rows, sort, stats])

  const clickSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 1 ? -1 : 1 }
      const defaultDir: 1 | -1 =
        key !== 'edge' && !key.startsWith('w:') && STAT_META[key as StatKey].invert ? 1 : -1
      return { key, dir: defaultDir }
    })
  }

  const sortArrow = (key: SortKey) =>
    sort.key === key ? (
      <ArrowDown
        size={11}
        className={`inline transition-transform duration-200 ${sort.dir === 1 ? 'rotate-180' : ''}`}
      />
    ) : null

  const saveAngle = (entry: StarterEntry) => (angleId: string | null, newName?: string) => {
    addToAngle(angleId, newName, {
      id: entry.pitcher.id,
      kind: 'mlb-pitcher',
      label: entry.pitcher.name,
      meta: `${entry.pitcher.team} · ${entry.pitcher.throws}HP vs ${entry.opp}`,
    })
    setAngleFor(null)
    showToast('Added to angle')
  }

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => i), [])

  return (
    <div className="prizm-card overflow-hidden">
      {/* S4 legend */}
      <div className="border-b border-line px-5 py-3">
        <LegendStrip />
      </div>

      {loading && (
        <div className="p-5" aria-label="Loading">
          {skeletonRows.map((i) => (
            <div key={i} className="mb-3 h-12 animate-pulse rounded-md bg-bg-2" />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <Gem size={36} strokeWidth={1.5} className="text-text-3" />
          <p className="text-sm text-text-2">No players match these filters</p>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            Reset filters
          </button>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-bg-2">
                  <th
                    scope="col"
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[220px] border-b border-line bg-bg-2 px-4 py-2 text-left overline-caption text-text-3"
                  >
                    Player
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={SEASON_STATS.length}
                    className="border-b border-l border-line px-2 py-2 text-center overline-caption text-sp-indigo"
                    style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
                  >
                    Season
                  </th>
                  {windows.map((w) => (
                    <th
                      key={w}
                      scope="colgroup"
                      colSpan={stats.length}
                      className="border-b border-l border-line px-2 py-2 text-center"
                    >
                      <button
                        type="button"
                        onClick={() => clickSort(`w:${w}`)}
                        className="overline-caption text-text-2 transition-colors hover:text-text-1"
                      >
                        {MLB_WINDOW_LABELS[w]} {sortArrow(`w:${w}`)}
                      </button>
                    </th>
                  ))}
                  <th
                    scope="col"
                    rowSpan={2}
                    className="border-b border-l border-line px-3 py-2 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => clickSort('edge')}
                      className="overline-caption text-text-2 transition-colors hover:text-text-1"
                    >
                      Edge {sortArrow('edge')}
                    </button>
                  </th>
                  <th scope="col" rowSpan={2} className="w-12 border-b border-l border-line" aria-label="Actions" />
                </tr>
                <tr className="bg-bg-2">
                  {SEASON_STATS.map((s) => (
                    <th
                      key={`season-${s}`}
                      scope="col"
                      className="border-b border-l border-line px-3 py-2 text-center"
                      style={{ backgroundColor: 'rgba(99,102,241,0.05)' }}
                    >
                      <button
                        type="button"
                        onClick={() => clickSort(s)}
                        className="data-mono text-[11px] font-medium uppercase tracking-wider text-text-3 transition-colors hover:text-text-1"
                      >
                        {STAT_META[s].label} {sortArrow(s)}
                        {s === 'xwoba' && (
                          <span
                            className="data-mono ml-1 rounded-sm border border-sp-cyan/40 bg-sp-cyan/10 px-1 py-px text-[8px] font-bold tracking-widest text-sp-cyan"
                            title="Real Statcast xwOBA"
                          >
                            STCAST
                          </span>
                        )}
                      </button>
                    </th>
                  ))}
                  {windows.map((w) =>
                    stats.map((s) => (
                      <th
                        key={`${w}-${s}`}
                        scope="col"
                        className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                      >
                        {STAT_META[s].label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody key={filterSig}>
                {sorted.map((row, rowIdx) => {
                  const p = row.entry.pitcher
                  return (
                    <motion.tr
                      key={p.id}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: rowIdx * 0.02 }}
                      onClick={() => setSelected(row.entry)}
                      className="group cursor-pointer transition-colors hover:bg-bg-3"
                    >
                      {/* Sticky player cell */}
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-line bg-bg-1 px-4 py-3 text-left font-normal group-hover:bg-bg-3"
                      >
                        <span className="block text-sm font-semibold text-text-1">{p.name}</span>
                        <span className="data-mono block text-[11px] text-text-3">
                          {p.team} · {p.throws}HP vs {row.entry.opp}
                        </span>
                      </th>

                      {/* Season baseline cells */}
                      {SEASON_STATS.map((s, i) => (
                        <td
                          key={`season-${s}`}
                          className={`data-mono border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-1 ${
                            i % 2 === 0 ? 'bg-bg-1' : 'bg-bg-2/60'
                          }`}
                        >
                          {STAT_META[s].fmt(row.season[s])}
                        </td>
                      ))}

                      {/* Window heat cells */}
                      {windows.map((w, wIdx) =>
                        stats.map((s) => {
                          const meta = STAT_META[s]
                          const season = row.season[s]
                          const value = row.windows[w][s]
                          let dPct = deltaPct(value, season)
                          if (meta.invert) dPct = -dPct
                          const { background, textClass } = heatCell(dPct)
                          // chip sign matches color semantics: inverted stats (lower = better) flip sign
                          const deltaDisplay = meta.invert
                            ? meta.toDisplay(season) - meta.toDisplay(value)
                            : meta.toDisplay(value) - meta.toDisplay(season)
                          const isHover = hover?.id === p.id && hover.w === w && hover.stat === s
                          const colIdx = wIdx * stats.length + stats.indexOf(s)
                          return (
                            <td
                              key={`${w}-${s}`}
                              className="relative border-b border-l border-line px-3 py-2 text-center"
                              style={{ backgroundColor: background }}
                              onMouseEnter={() => setHover({ id: p.id, w, stat: s })}
                              onMouseLeave={() => setHover(null)}
                            >
                              {/* re-tint sweep veil */}
                              <motion.span
                                key={filterSig}
                                initial={{ opacity: 0.55 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 0.3, delay: colIdx * 0.05 }}
                                className="pointer-events-none absolute inset-0 bg-bg-0"
                              />
                              <span className={`data-mono block text-[13px] font-bold ${textClass}`}>
                                {meta.fmt(value)}
                              </span>
                              <span className={`data-mono block text-[10px] leading-tight ${deltaTextClass(dPct)}`}>
                                {formatDelta(deltaDisplay, meta.deltaDec)}
                              </span>
                              <AnimatePresence>
                                {isHover && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-56 -translate-x-1/2 rounded-md border border-line bg-bg-2 p-3 text-left shadow-raised"
                                  >
                                    <p className="overline-caption mb-1.5 text-text-3">
                                      {meta.label} · {MLB_WINDOW_LABELS[w]}
                                    </p>
                                    <p className="data-mono text-xs text-text-2">
                                      {MLB_WINDOW_LABELS[w]} {meta.label}{' '}
                                      <span className="text-text-1">{meta.fmt(value)}</span> vs season{' '}
                                      <span className="text-text-1">{meta.fmt(season)}</span>
                                    </p>
                                    <p className={`data-mono mt-0.5 text-xs ${deltaTextClass(dPct)}`}>
                                      Δ {formatDelta(dPct, 1)}% over {row.windows[w].bf} BF
                                    </p>
                                    {hasSavant(p) && (
                                      <p className="data-mono mt-1 border-t border-line pt-1 text-[10px] text-text-3">
                                        STCAST
                                        {p.barrelPct != null && <> · Barrel {fmtSvPct(p.barrelPct)}</>}
                                        {p.hardHitPct != null && <> · HH {fmtSvPct(p.hardHitPct)}</>}
                                        {p.whiffPct != null && <> · Whiff {fmtSvPct(p.whiffPct)}</>}
                                      </p>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          )
                        }),
                      )}

                      {/* Edge column */}
                      <td className="border-b border-l border-line px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className="h-7 w-[3px] rounded-full"
                            style={{ background: 'var(--gradient-spectrum)' }}
                          />
                          <span className="data-mono text-[13px] font-bold text-text-1">{row.edge}</span>
                          {row.edge >= 75 && <Flame size={14} className="text-pos" aria-label="Hot" />}
                        </div>
                      </td>

                      {/* + Angle */}
                      <td className="relative border-b border-l border-line px-2 py-2 text-center">
                        <button
                          type="button"
                          aria-label={`Add ${p.name} to angle`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAngleFor(angleFor === p.id ? null : p.id)
                          }}
                          className={`rounded-sm p-1.5 text-text-3 transition-all hover:bg-bg-2 hover:text-sp-magenta ${
                            angleFor === p.id ? 'opacity-100 text-sp-magenta' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                          }`}
                        >
                          <BookmarkPlus size={15} />
                        </button>
                        <AnimatePresence>
                          {angleFor === p.id && (
                            <AnglePopover onPick={saveAngle(row.entry)} onClose={() => setAngleFor(null)} />
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view (<640px) — dashboard.md §S9 */}
          <div className="space-y-3 p-4 sm:hidden">
            {sorted.map((row, i) => {
              const p = row.entry.pitcher
              const primary = stats[0]
              const meta = STAT_META[primary]
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  onClick={() => setSelected(row.entry)}
                  className="w-full rounded-lg border border-line bg-bg-1 p-4 text-left"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-text-1">{p.name}</span>
                    <span className="data-mono text-[11px] text-text-3">
                      {p.team} · {p.throws}HP vs {row.entry.opp}
                    </span>
                  </div>
                  {/* Edge bar */}
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-bg-3">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.edge}%`, background: 'var(--gradient-spectrum)' }}
                      />
                    </div>
                    <span className="data-mono text-[11px] font-bold text-text-1">{row.edge}</span>
                    {row.edge >= 75 && <Flame size={12} className="text-pos" />}
                  </div>
                  <p className="data-mono mb-3 text-[11px] text-text-3">
                    ERA {fmtEra(row.season.era)} · WHIP {fmtWhip(row.season.whip)} · K {fmtPct(row.season.kPct)} ·
                    BB {fmtPct(row.season.bbPct)} · xwOBA {fmtXwoba(row.season.xwoba)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {windows.map((w) => {
                      const season = row.season[primary]
                      const value = row.windows[w][primary]
                      let dPct = deltaPct(value, season)
                      if (meta.invert) dPct = -dPct
                      const { background, textClass } = heatCell(dPct)
                      // chip sign matches color semantics: inverted stats (lower = better) flip sign
                      const deltaDisplay = meta.invert
                        ? meta.toDisplay(season) - meta.toDisplay(value)
                        : meta.toDisplay(value) - meta.toDisplay(season)
                      return (
                        <div key={w} className="rounded-md px-2.5 py-2" style={{ backgroundColor: background }}>
                          <span className="data-mono block text-[10px] uppercase tracking-wide text-text-3">
                            {MLB_WINDOW_LABELS[w]} {meta.label}
                          </span>
                          <span className={`data-mono text-[13px] font-bold ${textClass}`}>{meta.fmt(value)}</span>
                          <span className={`data-mono ml-1.5 text-[10px] ${deltaTextClass(dPct)}`}>
                            {formatDelta(deltaDisplay, meta.deltaDec)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </>
      )}

      {/* S6 pitcher detail drawer */}
      <PitcherDrawer entry={selected} split={split} onClose={() => setSelected(null)} onToast={showToast} />
      <Toast message={toast} />
    </div>
  )
}
