// Batters tab — one flat, sortable DataTable across the whole slate.
//
// This used to render a collapsible SplitTable per game: 5 stats x 4 windows,
// no sorting on any column. It now renders every batter on the slate in one
// table with the full BATTER_COLUMNS set, market presets and PA-window heat,
// following PitcherTable.tsx exactly.
//
// The per-game grouping survives as a Game column plus a Filter-by-game
// dropdown; the opposing-starter chip information (name · K% · hand) survives
// in the dropdown options, the Opp L/R column and the row drawer's opposing
// starter block. Nothing was deleted without a home.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkPlus, X } from 'lucide-react'
import DataTable from '@/components/DataTable'
import type { ColumnDef } from '@/lib/columns'
import { fmt } from '@/lib/columns'
import type { BatterRow } from '@/lib/columns/mlbBatters'
import { BATTER_COLUMNS, BATTER_PRESETS, batterWindowColumns } from '@/lib/columns/mlbBatters'
import type { Pitcher } from '@/data/mlbPlayers'
import {
  getPitcher,
  getTeamBatters,
  MLB_WINDOW_KEYS,
  MLB_WINDOW_LABELS,
} from '@/data/mlbPlayers'
import type { SlateGame } from '@/data/slate'
import { MLB_SLATE } from '@/data/slate'
import { deltaPct, deltaTextClass, formatDelta, heatCell } from '@/lib/heat'
import { fmtRate, fmtSvPct, hasSavant } from '@/lib/savant'
import type { FilterValues } from '@/components/FilterBar'
import { windowSubset } from './utils'
import { AnglePopover, Toast } from './angles'
import { addToAngle, useToast } from './angleStore'
import LegendStrip from './Legend'

/** Local row — the shared BatterRow plus the game it belongs to. */
interface LineupRow extends BatterRow {
  game: SlateGame
}

/** Columns that always render, whatever preset is active. */
const ALWAYS_SHOW = ['team', 'pos', 'bats', 'oppHand', 'game']

/** Market filter (batter set) → column preset. */
const MARKET_TO_PRESET: Record<string, string> = {
  hits: 'h',
  tb: 'tb',
  hr: 'hr',
  '2b': '2b',
  ks: 'k',
  bb: 'bb',
}

/** Season/window stats shown in the drawer, with their formatters. */
const DRAWER_STATS = [
  { key: 'avg', label: 'AVG', format: fmt.rate },
  { key: 'obp', label: 'OBP', format: fmt.rate },
  { key: 'slg', label: 'SLG', format: fmt.rate },
  { key: 'iso', label: 'ISO', format: fmt.rate },
  { key: 'xbh', label: 'XBH/G', format: fmt.dec2 },
  { key: 'tb', label: 'TB/G', format: fmt.dec2 },
] as const

/** Probable-pitcher chip — the old per-game header chip, now above the table. */
function PitcherChip({ pitcher }: { pitcher: Pitcher }) {
  const dPct = deltaPct(pitcher.windows.L30.kPct, pitcher.kPct)
  const { background, textClass } = heatCell(dPct)
  return (
    <span
      className="data-mono rounded-sm px-2 py-1 text-[11px]"
      style={{ backgroundColor: background }}
    >
      <span className={textClass}>
        {pitcher.name} · K {(pitcher.kPct * 100).toFixed(1)}
      </span>
      <span className="ml-1 text-text-3">({pitcher.throws}HP)</span>
    </span>
  )
}

/**
 * Row drawer — DataTable has no drawer of its own. Reuses the content the old
 * SplitTable drawer rendered: season baseline grid, per-window heat blocks,
 * Statcast chips and the opposing-starter block.
 */
function BatterDrawer({ row, onClose }: { row: LineupRow | null; onClose: () => void }) {
  const oppProbableId = row
    ? row.homeAway === 'Away'
      ? row.game.homeProbableId
      : row.game.awayProbableId
    : undefined
  const opp = oppProbableId ? getPitcher(oppProbableId) : undefined
  const b = row?.batter
  const sv = b && hasSavant(b) ? b : null

  return (
    <AnimatePresence>
      {row && b && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-bg-1 p-6"
            role="dialog"
            aria-label={`${b.name} details`}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-text-1">{b.name}</h3>
                <p className="data-mono mt-1 text-xs text-text-3">
                  {b.team} · {b.pos} · Bats {b.bats} · {row.game.away} @ {row.game.home} (
                  {row.homeAway})
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            {/* Season baselines */}
            <p className="overline-caption mb-2 text-sp-indigo">Season baseline</p>
            <div className="mb-6 grid grid-cols-2 gap-2">
              {DRAWER_STATS.map((s) => (
                <div key={s.key} className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
                  <span className="overline-caption block text-text-3">{s.label}</span>
                  <span className="data-mono text-lg font-semibold text-text-1">
                    {s.format(b[s.key])}
                  </span>
                </div>
              ))}
            </div>

            {/* Rolling windows */}
            {MLB_WINDOW_KEYS.map((w) => (
              <div key={w}>
                <p className="overline-caption mb-2 mt-5 text-text-3">
                  {MLB_WINDOW_LABELS[w]}
                  <span className="data-mono ml-2 normal-case tracking-normal">
                    n = {b.windows[w].pa} PA
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DRAWER_STATS.map((s) => {
                    const season = b[s.key]
                    const value = b.windows[w][s.key]
                    if (value == null || season == null) return null
                    const dPct = deltaPct(value, season)
                    const { background, textClass } = heatCell(dPct)
                    return (
                      <div
                        key={s.key}
                        className="rounded-md px-3 py-2.5"
                        style={{ backgroundColor: background }}
                      >
                        <span className="overline-caption block text-text-3">{s.label}</span>
                        <span className={`data-mono text-lg font-semibold ${textClass}`}>
                          {s.format(value)}
                        </span>
                        <span className={`data-mono ml-2 text-xs ${deltaTextClass(dPct)}`}>
                          {formatDelta(dPct, 1)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Statcast chips */}
            {sv && (
              <div className="mt-6 border-t border-line pt-5">
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
                        <span className="data-mono text-[13px] font-semibold text-text-1">
                          {value}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Tonight's opposing starter */}
            <div className="mt-6 border-t border-line pt-5">
              <p className="overline-caption mb-2 text-text-3">Tonight's opposing starter</p>
              {opp ? (
                <div className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
                  <p className="text-sm font-medium text-text-1">{opp.name}</p>
                  <p className="data-mono mt-0.5 text-[11px] text-text-3">
                    {opp.team} · {opp.throws}HP · ERA {opp.era.toFixed(2)} · K{' '}
                    {(opp.kPct * 100).toFixed(1)}
                  </p>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
                  No probable starter named for this game yet.
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export interface LineupsTabProps {
  loading: boolean
  values: FilterValues
  query: string
  onResetFilters: () => void
}

export default function LineupsTab({ loading, values, query, onResetFilters }: LineupsTabProps) {
  const [gameFilter, setGameFilter] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<LineupRow | null>(null)
  const [angleFor, setAngleFor] = useState<string | null>(null)
  const [toast, showToast] = useToast()

  const windows = windowSubset(values.window)
  const market = values.market

  // 2.1b — one flat row list: every batter on both teams of every game.
  // oppHand is the OPPOSING probable starter's throws; null when the slate
  // names no probable — never guessed, so Opp L/R dashes out honestly.
  const rows = useMemo<LineupRow[]>(() => {
    const q = query.trim().toLowerCase()
    const out: LineupRow[] = []
    for (const game of MLB_SLATE) {
      if (gameFilter && game.id !== gameFilter) continue
      const awayProb = game.awayProbableId ? getPitcher(game.awayProbableId) : undefined
      const homeProb = game.homeProbableId ? getPitcher(game.homeProbableId) : undefined

      const addTeam = (team: string, opp: string, oppP: Pitcher | undefined, homeAway: 'Home' | 'Away') => {
        // Venue filter keeps only home or away batters.
        if (values.venue && homeAway.toLowerCase() !== values.venue) return
        // Handedness filter keeps batters facing a starter of that hand.
        if (values.handedness && oppP?.throws !== values.handedness) return
        for (const batter of getTeamBatters(team)) {
          if (q && !batter.name.toLowerCase().includes(q)) continue
          out.push({ batter, game, opp, oppHand: oppP?.throws ?? null, homeAway })
        }
      }

      addTeam(game.away, game.home, homeProb, 'Away')
      addTeam(game.home, game.away, awayProb, 'Home')
    }
    return out
  }, [values.handedness, values.venue, query, gameFilter])

  // Filter-by-game options carry the probable-pitcher chip information
  // (name · season K% · hand) so dropping the per-game headers loses nothing.
  const gameOptions = useMemo(
    () =>
      MLB_SLATE.map((g) => {
        const ap = g.awayProbableId ? getPitcher(g.awayProbableId) : undefined
        const hp = g.homeProbableId ? getPitcher(g.homeProbableId) : undefined
        const chip = (p?: Pitcher) =>
          p ? `${p.name} · K ${(p.kPct * 100).toFixed(1)} (${p.throws}HP)` : 'TBD'
        return { id: g.id, label: `${g.away} @ ${g.home} — ${chip(ap)} / ${chip(hp)}` }
      }),
    [],
  )

  const selectedGame = gameFilter ? MLB_SLATE.find((g) => g.id === gameFilter) : undefined
  const selectedAwayProb = selectedGame?.awayProbableId
    ? getPitcher(selectedGame.awayProbableId)
    : undefined
  const selectedHomeProb = selectedGame?.homeProbableId
    ? getPitcher(selectedGame.homeProbableId)
    : undefined

  const saveAngleFor = (r: LineupRow) => (angleId: string | null, newName?: string) => {
    addToAngle(angleId, newName, {
      id: r.batter.id,
      kind: 'mlb-batter',
      label: r.batter.name,
      meta: `${r.batter.team} · ${r.batter.pos} · ${
        r.oppHand ? `vs ${r.oppHand}HP` : 'no probable named'
      }`,
    })
    setAngleFor(null)
    showToast('Added to angle')
  }

  // 2.1c — column assembly, same shape as PitcherTable.tsx.
  const columns = useMemo<ColumnDef<LineupRow>[]>(() => {
    const identity: ColumnDef<LineupRow> = {
      key: 'player',
      label: 'Player',
      value: (r) => r.batter.name,
      source: 'MLB Stats API → players',
      definition: 'Batter.',
      sticky: true,
      minWidth: 190,
      render: (r) => (
        <>
          <span className="block text-sm font-semibold text-text-1">{r.batter.name}</span>
          <span className="data-mono block text-[11px] text-text-3">
            {r.batter.team} · {r.batter.pos} · {r.batter.bats}
          </span>
        </>
      ),
    }

    // Game grouping, flattened into a column so no information is lost.
    const gameCol: ColumnDef<LineupRow> = {
      key: 'game',
      label: 'Game',
      value: (r) => `${r.game.away} @ ${r.game.home}`,
      source: 'sv_slate',
      definition: 'Tonight’s game.',
      sortable: true,
    }

    const presetKey = market ? MARKET_TO_PRESET[market] : undefined
    const preset = presetKey ? BATTER_PRESETS.find((p) => p.key === presetKey) : undefined
    const wanted = preset ? new Set([...ALWAYS_SHOW, ...preset.columns]) : null

    const stats = BATTER_COLUMNS.filter((c) => !wanted || wanted.has(c.key))

    const windowCols = windows.flatMap((w) => batterWindowColumns(w, MLB_WINDOW_LABELS[w]))

    const actions: ColumnDef<LineupRow> = {
      key: 'actions',
      label: '',
      value: () => null,
      source: '—',
      definition: 'Save this batter to an angle.',
      render: (r) => (
        <span className="relative inline-flex">
          <button
            type="button"
            aria-label={`Add ${r.batter.name} to an angle`}
            onClick={(e) => {
              e.stopPropagation()
              setAngleFor(angleFor === r.batter.id ? null : r.batter.id)
            }}
            className={`rounded p-1 transition-opacity ${
              angleFor === r.batter.id
                ? 'text-sp-magenta opacity-100'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <BookmarkPlus size={14} />
          </button>
          {angleFor === r.batter.id && (
            <AnglePopover onPick={saveAngleFor(r)} onClose={() => setAngleFor(null)} />
          )}
        </span>
      ),
    }

    return [identity, gameCol, ...stats, ...windowCols, actions]
    // saveAngleFor closes over stable setters; angleFor drives the popover only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, windows, angleFor])

  const filterSig = useMemo(
    () => JSON.stringify([values, query, gameFilter]),
    [values, query, gameFilter],
  )

  return (
    <div className="space-y-3">
      <div className="prizm-card px-5 py-3">
        <LegendStrip />
      </div>

      {/* Filter by game — narrows rows; probable chips preserved in options */}
      <div className="prizm-card flex flex-wrap items-center gap-3 px-5 py-3">
        <label htmlFor="lineups-game-filter" className="overline-caption text-text-3">
          Filter by game
        </label>
        <select
          id="lineups-game-filter"
          value={gameFilter ?? ''}
          onChange={(e) => setGameFilter(e.target.value || undefined)}
          className="data-mono h-9 max-w-full rounded-sm border border-line bg-bg-2 px-3 text-[12px] text-text-1 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)]"
        >
          <option value="">All games ({MLB_SLATE.length})</option>
          {gameOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        {selectedGame && (
          <span className="flex flex-wrap items-center gap-1.5">
            {selectedAwayProb && <PitcherChip pitcher={selectedAwayProb} />}
            {selectedHomeProb && <PitcherChip pitcher={selectedHomeProb} />}
          </span>
        )}
      </div>

      <DataTable<LineupRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.batter.id}
        loading={loading}
        filterSig={filterSig}
        onRowClick={(r) => setSelected(r)}
        onResetFilters={onResetFilters}
        emptyLabel="No players match these filters"
        defaultSortKey="team"
        defaultSortDir={1}
        mobileTitle={(r) => r.batter.name}
        mobileSummary={(r) =>
          `${r.batter.team} · ${r.batter.pos} · ${r.batter.bats} · ${r.game.away} @ ${r.game.home} · AVG ${fmt.rate(
            r.batter.avg,
          )}`
        }
      />

      <BatterDrawer row={selected} onClose={() => setSelected(null)} />
      <Toast message={toast} />
    </div>
  )
}
