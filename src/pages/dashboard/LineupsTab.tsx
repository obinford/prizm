// Batting Lineups tab (dashboard.md §S7): projected lineups grouped by game,
// each game rendered with the shared SplitTable component (Season AVG/OBP/ISO/
// XBH/TB + L30–L120 PA heat windows), collapsible game headers with opposing
// pitcher context chips.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gem } from 'lucide-react'
import SplitTable from '@/components/SplitTable'
import type { SplitColumn, SplitPlayer, SplitWindow } from '@/components/SplitTable'
import type { Batter, Pitcher } from '@/data/mlbPlayers'
import { getBatter, getPitcher, getTeamBatters, MLB_WINDOW_LABELS } from '@/data/mlbPlayers'
import type { SlateGame } from '@/data/slate'
import { MLB_SLATE } from '@/data/slate'
import { deltaPct, heatCell } from '@/lib/heat'
import { fmtRate, fmtSvPct, hasSavant } from '@/lib/savant'
import type { FilterValues } from '@/components/FilterBar'
import { fmtAvg, fmtPerGame, fmtPct, windowSubset } from './utils'
import LegendStrip from './Legend'

const COLUMNS: SplitColumn[] = [
  { key: 'avg', label: 'AVG', format: fmtAvg },
  { key: 'obp', label: 'OBP', format: fmtAvg },
  { key: 'iso', label: 'ISO', format: fmtAvg },
  { key: 'xbh', label: 'XBH/G', format: fmtPerGame },
  { key: 'tb', label: 'TB/G', format: fmtPerGame },
]

function toSplitPlayer(b: Batter): SplitPlayer {
  const season: Record<string, number> = { avg: b.avg, obp: b.obp, iso: b.iso, xbh: b.xbh, tb: b.tb }
  const windows: Record<string, Record<string, number>> = {}
  const samples: Record<string, number> = {}
  for (const w of Object.keys(b.windows) as (keyof typeof b.windows)[]) {
    const src = b.windows[w]
    windows[w] = { avg: src.avg, obp: src.obp, iso: src.iso, xbh: src.xbh, tb: src.tb }
    samples[w] = src.pa
  }
  return { id: b.id, name: b.name, team: b.team, pos: `${b.pos} · ${b.bats}`, season, windows, samples, sampleUnit: 'PA' }
}

/** Opposing pitcher chip on a game header (tinted by his L30 K% heat). */
function PitcherChip({ pitcher }: { pitcher: Pitcher }) {
  const dPct = deltaPct(pitcher.windows.L30.kPct, pitcher.kPct)
  const { background, textClass } = heatCell(dPct)
  return (
    <span className="data-mono rounded-sm px-2 py-1 text-[11px]" style={{ backgroundColor: background }}>
      <span className={textClass}>
        {pitcher.name} · K {fmtPct(pitcher.kPct)}
      </span>
      <span className="ml-1 text-text-3">({pitcher.throws}HP)</span>
    </span>
  )
}

export interface LineupsTabProps {
  loading: boolean
  values: FilterValues
  query: string
  onResetFilters: () => void
}

export default function LineupsTab({ loading, values, query, onResetFilters }: LineupsTabProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const windows: SplitWindow[] = windowSubset(values.window).map((w) => ({
    key: w,
    label: MLB_WINDOW_LABELS[w],
  }))

  const games = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MLB_SLATE.map((game: SlateGame) => {
      const awayPitcher = game.awayProbableId ? getPitcher(game.awayProbableId) : undefined
      const homePitcher = game.homeProbableId ? getPitcher(game.homeProbableId) : undefined
      const oppMap: Record<string, Pitcher | undefined> = {}

      const battersFor = (team: string, opp: Pitcher | undefined, homeAway: 'Home' | 'Away') => {
        let list = getTeamBatters(team)
        if (values.handedness) {
          list = opp && opp.throws === values.handedness ? list : []
        }
        if (values.venue && homeAway.toLowerCase() !== values.venue) list = []
        if (q) list = list.filter((b) => b.name.toLowerCase().includes(q))
        for (const b of list) oppMap[b.id] = opp
        return list
      }

      const players = [
        ...battersFor(game.away, homePitcher, 'Away'),
        ...battersFor(game.home, awayPitcher, 'Home'),
      ].map(toSplitPlayer)

      return { game, players, awayPitcher, homePitcher, oppMap }
    }).filter((g) => g.players.length > 0)
  }, [values.handedness, values.venue, query])

  const totalBatters = games.reduce((n, g) => n + g.players.length, 0)

  if (loading) {
    return (
      <div className="prizm-card p-5" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mb-3 h-12 animate-pulse rounded-md bg-bg-2" />
        ))}
      </div>
    )
  }

  if (totalBatters === 0) {
    return (
      <div className="prizm-card flex flex-col items-center gap-4 px-6 py-16 text-center">
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
    )
  }

  return (
    <div className="space-y-4">
      {/* S4 legend */}
      <div className="prizm-card px-5 py-3">
        <LegendStrip />
      </div>

      {games.map(({ game, players, awayPitcher, homePitcher, oppMap }, gi) => {
        const isCollapsed = !!collapsed[game.id]
        return (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: gi * 0.05 }}
            className="prizm-card overflow-hidden [&_.prizm-card]:rounded-none [&_.prizm-card]:border-0 [&_.prizm-card]:shadow-none"
          >
            {/* Game header */}
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [game.id]: !c[game.id] }))}
              aria-expanded={!isCollapsed}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-bg-2/60 px-5 py-3 text-left transition-colors hover:bg-bg-2"
            >
              <ChevronDown
                size={15}
                className={`shrink-0 text-text-3 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
              />
              <span className="data-mono text-[13px] font-semibold text-text-1">
                {game.away} @ {game.home}
              </span>
              <span className="data-mono text-[11px] text-text-3">
                {game.startTime} · {game.venue}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                {awayPitcher && <PitcherChip pitcher={awayPitcher} />}
                {homePitcher && <PitcherChip pitcher={homePitcher} />}
              </span>
            </button>

            {/* Collapsible table */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <SplitTable
                    players={players}
                    windows={windows}
                    columns={COLUMNS}
                    showLegend={false}
                    onResetFilters={onResetFilters}
                    renderDrawerExtra={(player) => {
                      const opp = oppMap[player.id]
                      const batter = getBatter(player.id)
                      const sv = batter && hasSavant(batter) ? batter : null
                      if (!opp && !sv) return null
                      return (
                        <div className="space-y-5">
                          {sv && (
                            <div>
                              <p className="overline-caption mb-2 text-text-3">
                                Statcast
                                <span className="data-mono ml-2 rounded-sm border border-sp-cyan/40 bg-sp-cyan/10 px-1 py-px text-[8px] font-bold tracking-widest text-sp-cyan">
                                  STCAST
                                </span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    ['xBA', sv.xba != null ? fmtRate(sv.xba) : null],
                                    ['xSLG', sv.xslg != null ? fmtRate(sv.xslg) : null],
                                    ['Barrel%', sv.barrelPct != null ? fmtSvPct(sv.barrelPct) : null],
                                    ['HH%', sv.hardHitPct != null ? fmtSvPct(sv.hardHitPct) : null],
                                  ] as [string, string | null][]
                                )
                                  .filter((x): x is [string, string] => x[1] != null)
                                  .map(([label, value]) => (
                                    <span
                                      key={label}
                                      className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5"
                                      style={{ backgroundColor: 'rgba(34,211,238,0.08)' }}
                                    >
                                      <span className="overline-caption mr-1.5 text-text-3">{label}</span>
                                      <span className="data-mono text-[13px] font-semibold text-text-1">{value}</span>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                          {opp && (
                            <div>
                              <p className="overline-caption mb-2 text-text-3">Tonight's opposing starter</p>
                              <div className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
                                <p className="text-sm font-medium text-text-1">{opp.name}</p>
                                <p className="data-mono mt-0.5 text-[11px] text-text-3">
                                  {opp.team} · {opp.throws}HP · ERA {opp.era.toFixed(2)} · K {fmtPct(opp.kPct)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
