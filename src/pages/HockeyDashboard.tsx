import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import SplitTable from '@/components/SplitTable'
import type { SplitColumn, SplitPlayer, SplitWindow } from '@/components/SplitTable'
import FilterBar from '@/components/FilterBar'
import type { FilterDef, FilterValues } from '@/components/FilterBar'
import { GOALIES, NHL_WINDOW_KEYS, NHL_WINDOW_LABELS, SKATERS } from '@/data/nhlPlayers'
import type { Goalie, Skater } from '@/data/nhlPlayers'
import { NHL_SLATE } from '@/data/slate'
import type { SlateGame } from '@/data/slate'
import { deltaPct } from '@/lib/heat'
import { TEAM_STATS, getTeamStats } from '@/pages/hockey/teamStats'
import type { TeamStats } from '@/pages/hockey/teamStats'
import {
  GoalieDrawerExtra,
  SkaterDrawerExtra,
  TeamDrawerExtra,
  goalieEdge,
  skaterDeployment,
  skaterEdge,
} from '@/pages/hockey/extras'

type Tab = 'goalies' | 'skaters' | 'teams'

const TABS: { key: Tab; label: string }[] = [
  { key: 'goalies', label: 'Goalies' },
  { key: 'skaters', label: 'Skaters' },
  { key: 'teams', label: 'Team Stats' },
]

const NHL_WINDOWS: SplitWindow[] = NHL_WINDOW_KEYS.map((k) => ({
  key: k,
  label: NHL_WINDOW_LABELS[k],
}))

const TEAM_WINDOWS: SplitWindow[] = [
  { key: 'l5', label: 'L5' },
  { key: 'l10', label: 'L10' },
  { key: 'l20', label: 'L20' },
]

const TEAM_NAMES: Record<string, string> = {
  EDM: 'Edmonton Oilers',
  CGY: 'Calgary Flames',
  TOR: 'Toronto Maple Leafs',
  BOS: 'Boston Bruins',
  NYR: 'New York Rangers',
  NJ: 'New Jersey Devils',
  COL: 'Colorado Avalanche',
  DAL: 'Dallas Stars',
  TB: 'Tampa Bay Lightning',
  FLA: 'Florida Panthers',
}

const svFmt = (v: number) => (v === undefined || Number.isNaN(v) ? '—' : v.toFixed(3).replace(/^0/, ''))

const GOALIE_COLUMNS: SplitColumn[] = [
  { key: 'svp', label: 'SV%', format: svFmt, deltaDecimals: 3 },
  { key: 'gsax', label: 'GSAx/60', deltaDecimals: 2 },
  { key: 'xga', label: 'xGA/60', invert: true, deltaDecimals: 2 },
  { key: 'sog', label: 'SOG faced', deltaDecimals: 1 },
]

const SKATER_COLUMNS: SplitColumn[] = [
  { key: 'sog', label: 'SOG/G', deltaDecimals: 1 },
  { key: 'goals', label: 'Goals', deltaDecimals: 2 },
  { key: 'points', label: 'Points', deltaDecimals: 2 },
]

const TEAM_COLUMNS: SplitColumn[] = [
  { key: 'gf', label: 'GF/G', deltaDecimals: 2 },
  { key: 'ga', label: 'GA/G', invert: true, deltaDecimals: 2 },
  { key: 'xgfPct', label: 'xGF%', deltaDecimals: 1 },
  { key: 'ppPct', label: 'PP%', deltaDecimals: 1 },
  { key: 'pkPct', label: 'PK%', deltaDecimals: 1 },
]

// ---------------------------------------------------------------------------
// Slate lookups
// ---------------------------------------------------------------------------

// NHL_SLATE is hydrated live by LiveDataProvider before this page mounts —
// build the lookups lazily on first render, never at module import time.
let gameByTeamCache: Map<string, SlateGame> | null = null
function gameByTeam(): Map<string, SlateGame> {
  if (!gameByTeamCache) {
    gameByTeamCache = new Map<string, SlateGame>()
    for (const g of NHL_SLATE) {
      gameByTeamCache.set(g.away, g)
      gameByTeamCache.set(g.home, g)
    }
  }
  return gameByTeamCache
}

function opponentOf(team: string): { opp: string; home: boolean } | null {
  const g = gameByTeam().get(team)
  if (!g) return null
  return g.home === team ? { opp: g.away, home: true } : { opp: g.home, home: false }
}

let confirmedGoalieIdsCache: Set<string> | null = null
function confirmedGoalieIds(): Set<string> {
  if (!confirmedGoalieIdsCache) {
    confirmedGoalieIdsCache = new Set<string>()
    for (const g of NHL_SLATE) {
      if (g.awayProbableId) confirmedGoalieIdsCache.add(g.awayProbableId)
      if (g.homeProbableId) confirmedGoalieIdsCache.add(g.homeProbableId)
    }
  }
  return confirmedGoalieIdsCache
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function goalieToPlayer(g: Goalie): SplitPlayer {
  const match = opponentOf(g.team)
  const windows: Record<string, Record<string, number>> = {}
  const samples: Record<string, number> = {}
  for (const k of NHL_WINDOW_KEYS) {
    const w = g.windows[k]
    // GSAx / xgAgainst can be null (no public xG feed) — omit the stat key so
    // the table renders an honest "—" instead of a fabricated heat cell.
    const stats: Record<string, number> = { svp: w.svPct }
    if (w.gsax != null) {
      // convert cumulative window GSAx to a per-60 rate for baseline compare
      stats.gsax = +(w.gsax / (w.toi / 60)).toFixed(2)
    }
    if (w.xgAgainst != null) {
      stats.xga = w.xgAgainst
      stats.sog = +(w.xgAgainst / 0.086).toFixed(1) // shots faced per 60 (xG ÷ avg xG/shot)
    }
    windows[k] = stats
    samples[k] = w.toi
  }
  const season: Record<string, number> = { svp: g.svPct }
  if (g.gsax != null) season.gsax = g.gsax
  if (g.xgAgainst != null) {
    season.xga = g.xgAgainst
    season.sog = +(g.xgAgainst / 0.086).toFixed(1)
  }
  return {
    id: g.id,
    name: g.name,
    team: g.team,
    pos: match ? `G ${match.home ? 'vs' : '@'} ${match.opp}` : 'G · expected',
    season,
    windows,
    samples,
    sampleUnit: 'MIN',
  }
}

function skaterToPlayer(s: Skater, index: number): SplitPlayer {
  const match = opponentOf(s.team)
  const { line, pp } = skaterDeployment(index)
  const windows: Record<string, Record<string, number>> = {}
  const samples: Record<string, number> = {}
  for (const k of NHL_WINDOW_KEYS) {
    const w = s.windows[k]
    windows[k] = { sog: w.sog, goals: w.goals, points: w.points }
    samples[k] = w.toi
  }
  return {
    id: s.id,
    name: s.name,
    team: s.team,
    pos: `${s.pos} · ${line}${pp === 'PP1' ? ' · PP1' : ''}${match ? ` · ${match.home ? 'vs' : '@'} ${match.opp}` : ''}`,
    season: { sog: s.sog, goals: s.goals, points: s.points },
    windows,
    samples,
    sampleUnit: 'MIN',
  }
}

function teamToPlayer(t: TeamStats): SplitPlayer {
  const g = gameByTeam().get(t.abbr)
  return {
    id: t.abbr,
    name: TEAM_NAMES[t.abbr] ?? t.abbr,
    team: t.abbr,
    pos: `${g ? (g.home === t.abbr ? `vs ${g.away}` : `@ ${g.home}`) : ''} · Pace ${t.pace} · #${t.rank}`,
    season: { ...t.season },
    windows: {
      l5: { gf: t.l5.gf, ga: t.l5.ga, xgfPct: t.l5.xgfPct, ppPct: t.l5.ppPct, pkPct: t.l5.pkPct },
      l10: { gf: t.l10.gf, ga: t.l10.ga, xgfPct: t.l10.xgfPct, ppPct: t.l10.ppPct, pkPct: t.l10.pkPct },
      l20: { gf: t.l20.gf, ga: t.l20.ga, xgfPct: t.l20.xgfPct, ppPct: t.l20.ppPct, pkPct: t.l20.pkPct },
    },
    samples: { l5: 5, l10: 10, l20: 20 },
    sampleUnit: 'GP',
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function filtersForTab(tab: Tab): FilterDef[] {
  const defs: FilterDef[] = [
    {
      key: 'split',
      label: 'Split',
      options: [
        { value: 'hot', label: 'Heating up' },
        { value: 'cold', label: 'Cooling down' },
      ],
    },
    {
      key: 'venue',
      label: 'Venue',
      options: [
        { value: 'home', label: 'Home' },
        { value: 'away', label: 'Away' },
      ],
    },
    {
      key: 'opp',
      label: 'Opponent',
      options: [
        { value: 'top10', label: 'Top 10' },
        { value: 'bottom10', label: 'Bottom 10' },
      ],
    },
  ]
  if (tab !== 'teams') {
    defs.push({
      key: 'market',
      label: 'Market',
      options: [
        { value: 'saves', label: 'Saves' },
        { value: 'sog', label: 'SOG' },
        { value: 'goals', label: 'Goals' },
        { value: 'points', label: 'Points' },
      ],
    })
  }
  defs.push({
    key: 'window',
    label: 'Window',
    options:
      tab === 'teams'
        ? [
            { value: 'l5', label: 'L5' },
            { value: 'l10', label: 'L10' },
            { value: 'l20', label: 'L20' },
          ]
        : NHL_WINDOW_KEYS.map((k) => ({ value: k, label: NHL_WINDOW_LABELS[k] })),
  })
  defs.push({
    key: 'sort',
    label: 'Sort',
    options:
      tab === 'goalies'
        ? [
            { value: 'edge', label: 'Edge' },
            { value: 'svp', label: 'SV%' },
            { value: 'gsax', label: 'GSAx/60' },
          ]
        : tab === 'skaters'
          ? [
              { value: 'edge', label: 'Edge' },
              { value: 'sog', label: 'SOG/G' },
              { value: 'goals', label: 'Goals' },
              { value: 'points', label: 'Points' },
            ]
          : [
              { value: 'gf', label: 'GF/G' },
              { value: 'ga', label: 'GA/G' },
              { value: 'xgfPct', label: 'xGF%' },
              { value: 'ppPct', label: 'PP%' },
            ],
  })
  return defs
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HockeyDashboard() {
  const [tab, setTab] = useState<Tab>('goalies')
  const [values, setValues] = useState<FilterValues>({ sort: 'edge' })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Skeleton 500ms on mount + tab switch
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(t)
  }, [tab])

  const slateTeams = useMemo(() => {
    const abbrs = new Set<string>()
    for (const g of NHL_SLATE) {
      abbrs.add(g.away)
      abbrs.add(g.home)
    }
    return TEAM_STATS.filter((t) => abbrs.has(t.abbr)).map((t) => ({
      ...t,
      team: t.abbr,
      name: TEAM_NAMES[t.abbr] ?? t.abbr,
    }))
  }, [])

  const slateSkaters = useMemo(
    () => SKATERS.filter((s) => gameByTeam().has(s.team)),
    [],
  )

  const sortKey = values.sort ?? (tab === 'teams' ? 'gf' : 'edge')
  const windowKey =
    values.window ?? (tab === 'teams' ? 'l10' : 'MIN120')

  const applyCommon = <T extends { team: string; name: string }>(
    rows: T[],
    primary: (r: T) => { season: number; windows: Record<string, number> },
  ): T[] => {
    let out = rows
    const q = search.trim().toLowerCase()
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q) || r.team.toLowerCase().includes(q))
    if (values.venue) {
      out = out.filter((r) => {
        const m = opponentOf(r.team)
        return m ? (values.venue === 'home' ? m.home : !m.home) : false
      })
    }
    if (values.opp) {
      out = out.filter((r) => {
        const m = opponentOf(r.team)
        if (!m) return false
        const rank = getTeamStats(m.opp)?.rank ?? 16
        return values.opp === 'top10' ? rank <= 10 : rank >= 23
      })
    }
    if (values.split) {
      out = out.filter((r) => {
        const p = primary(r)
        const w = p.windows[windowKey]
        if (w === undefined) return true
        const d = deltaPct(w, p.season)
        return values.split === 'hot' ? d > 2 : d < -2
      })
    }
    return out
  }

  const sortPlayers = (
    players: SplitPlayer[],
    stat: string,
  ): SplitPlayer[] => {
    const arr = [...players]
    arr.sort((a, b) => {
      const av = a.windows[windowKey]?.[stat] ?? a.season[stat] ?? 0
      const bv = b.windows[windowKey]?.[stat] ?? b.season[stat] ?? 0
      return bv - av
    })
    return arr
  }

  // --- Goalies ---
  const goalieRows = useMemo(() => {
    let rows = GOALIES
    // market filter on goalies tab only keeps "saves" meaningful — other
    // markets belong to skaters, so treat them as no-op here.
    rows = applyCommon(rows, (g) => ({
      season: g.svPct,
      windows: Object.fromEntries(NHL_WINDOW_KEYS.map((k) => [k, g.windows[k].svPct])),
    }))
    // confirmed starters first
    rows = [...rows].sort(
      (a, b) => Number(confirmedGoalieIds().has(b.id)) - Number(confirmedGoalieIds().has(a.id)),
    )
    let players = rows.map(goalieToPlayer)
    if (sortKey === 'edge') {
      const edgeById = new Map(rows.map((g) => [g.id, goalieEdge(g)]))
      players = [...players].sort((a, b) => (edgeById.get(b.id) ?? 0) - (edgeById.get(a.id) ?? 0))
    } else {
      players = sortPlayers(players, sortKey)
    }
    return players
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, search, sortKey, windowKey])

  // --- Skaters ---
  const skaterRows = useMemo(() => {
    let rows = slateSkaters
    if (values.market === 'saves') rows = [] // goalie market — nothing to show
    rows = applyCommon(rows, (s) => ({
      season: s.sog,
      windows: Object.fromEntries(NHL_WINDOW_KEYS.map((k) => [k, s.windows[k].sog])),
    }))
    const indexById = new Map(slateSkaters.map((s, i) => [s.id, i]))
    let players = rows.map((s) => skaterToPlayer(s, indexById.get(s.id) ?? 0))
    if (sortKey === 'edge') {
      const edgeById = new Map(rows.map((s) => [s.id, skaterEdge(s)]))
      players = [...players].sort((a, b) => (edgeById.get(b.id) ?? 0) - (edgeById.get(a.id) ?? 0))
    } else {
      const stat =
        values.market === 'goals' || values.market === 'points' || values.market === 'sog'
          ? values.market
          : sortKey
      players = sortPlayers(players, stat === 'edge' ? 'sog' : stat)
    }
    return players
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, search, sortKey, windowKey, slateSkaters])

  // --- Teams ---
  const teamRows = useMemo(() => {
    const rows = applyCommon(slateTeams, (t) => ({
      season: t.season.gf,
      windows: { l5: t.l5.gf, l10: t.l10.gf, l20: t.l20.gf },
    }))
    return sortPlayers(rows.map(teamToPlayer), sortKey === 'edge' ? 'gf' : sortKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, search, sortKey, windowKey, slateTeams])

  const confirmedCount = confirmedGoalieIds().size

  const resetFilters = () => {
    setValues({ sort: tab === 'teams' ? 'gf' : 'edge' })
    setSearch('')
  }

  const filterBar = (
    <FilterBar
      key={tab}
      filters={filtersForTab(tab)}
      values={values}
      onChange={setValues}
      scope="dashboard-nhl"
    />
  )

  const searchBox = (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players…"
        aria-label="Search players"
        className="data-mono h-9 w-full rounded-sm border border-line bg-bg-2 pl-8 pr-3 text-[13px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)] sm:w-56"
      />
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-8"
    >
      {/* S1 — page row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center gap-3"
      >
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
          Tonight&rsquo;s goalies &amp; skaters
        </h2>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          {NHL_SLATE.length} games · {confirmedCount} goalies confirmed
        </span>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="ml-auto rounded-md border border-line bg-bg-2 px-3 py-2 text-[13px] font-medium text-text-1 transition-colors hover:bg-bg-3 sm:hidden"
        >
          Filters
        </button>
      </motion.div>

      {/* S2 — tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-1 border-b border-line"
        role="tablist"
        aria-label="NHL dashboard tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key)
              setValues({ sort: t.key === 'teams' ? 'gf' : 'edge' })
            }}
            className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'text-text-1' : 'text-text-3 hover:text-text-2'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="nhl-tab-underline"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-sp-indigo"
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* S3 — starter status strip (goalies tab) */}
      {tab === 'goalies' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap gap-2"
        >
          {NHL_SLATE.map((g) => (
            <div
              key={g.id}
              className="flex max-w-full flex-wrap items-center gap-2 rounded-md border border-line bg-bg-1 px-3 py-2"
            >
              <span className="data-mono text-[11px] font-semibold text-text-2">
                {g.away} @ {g.home}
              </span>
              {(['awayProbable', 'homeProbable'] as const).map((side) => {
                const name = g[side]
                const id = side === 'awayProbable' ? g.awayProbableId : g.homeProbableId
                if (!name) {
                  return (
                    <span key={side} className="data-mono text-[11px] text-text-3">
                      expected
                    </span>
                  )
                }
                return (
                  <span
                    key={side}
                    className={`data-mono flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] ${
                      id && confirmedGoalieIds().has(id)
                        ? 'bg-sp-cyan/10 text-sp-cyan'
                        : 'text-text-3'
                    }`}
                  >
                    {name}
                    {id && confirmedGoalieIds().has(id) && (
                      <span className="rounded-sm bg-sp-cyan/20 px-1 text-[9px] font-bold tracking-wide">
                        CONFIRMED
                      </span>
                    )}
                  </span>
                )
              })}
              <span className="data-mono text-[10px] text-text-3">{g.startTime}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* S3 — filters (desktop) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="hidden items-start gap-3 sm:flex"
      >
        <div className="min-w-0 flex-1">{filterBar}</div>
        {searchBox}
      </motion.div>

      {/* S4–S6 — tables */}
      <motion.div
        key={`${tab}-${sortKey}-${windowKey}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {tab === 'goalies' && (
          <SplitTable
            players={goalieRows}
            windows={NHL_WINDOWS}
            columns={GOALIE_COLUMNS}
            loading={loading}
            title="Goalies — rolling splits"
            onResetFilters={resetFilters}
            renderDrawerExtra={(p) => {
              const g = GOALIES.find((x) => x.id === p.id)
              return g ? <GoalieDrawerExtra goalie={g} /> : null
            }}
          />
        )}
        {tab === 'skaters' && (
          <SplitTable
            players={skaterRows}
            windows={NHL_WINDOWS}
            columns={SKATER_COLUMNS}
            loading={loading}
            title="Skaters — shot volume & production"
            emptyMessage="No skaters match these filters"
            onResetFilters={resetFilters}
            renderDrawerExtra={(p) => {
              const s = slateSkaters.find((x) => x.id === p.id)
              const i = slateSkaters.findIndex((x) => x.id === p.id)
              return s ? <SkaterDrawerExtra skater={s} index={i} /> : null
            }}
          />
        )}
        {tab === 'teams' && (
          <SplitTable
            players={teamRows}
            windows={TEAM_WINDOWS}
            columns={TEAM_COLUMNS}
            loading={loading}
            title="Team environment — tonight's slate"
            onResetFilters={resetFilters}
            renderDrawerExtra={(p) => {
              const t = TEAM_STATS.find((x) => x.abbr === p.id)
              return t ? <TeamDrawerExtra team={t} /> : null
            }}
          />
        )}
      </motion.div>

      {/* Mobile filters bottom sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
            onClick={() => setFiltersOpen(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-xl border-t border-line bg-bg-1 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-text-1">Filters</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md bg-sp-indigo px-4 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
            <div className="space-y-4">
              {searchBox}
              {filterBar}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
