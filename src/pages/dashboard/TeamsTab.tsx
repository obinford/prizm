// Team Stats tab — one row per team through the shared DataTable.
//
// Replaces the TabPlaceholder. Every statistic comes from trpc.teams.stats
// (api/teamsRouter.ts: sv_stat_cache batter lines aggregated to a team).
// src/data/mlbTeams.ts supplies IDENTITY ONLY (abbr, city, name, league,
// division) — its runsPerGame / bullpenEra / teamXwoba / parkFactor fields
// are hardcoded seed literals and are never read here.
//
// Windows are PLATE-APPEARANCE windows (sv_stat_cache splits), not game
// windows — Handigraphs ships L6/L12/L21 games and we cannot, because no
// date-bucketed team rollup exists. Game windows are not offered rather than
// faked. Heat is against the 30-team mean, not a team's own history.

import { useMemo, useState } from 'react'
import DataTable from '@/components/DataTable'
import type { MlbTeamStats } from '@contracts/types'
import { trpc } from '@/providers/trpc'
import { MLB_TEAMS } from '@/data/mlbTeams'
import { fmt } from '@/lib/columns'
import type { TeamRow } from '@/lib/columns/mlbTeams'
import { HEATED_KEYS, teamColumns } from '@/lib/columns/mlbTeams'
import { toMlbamAbbr } from './utils'
import LegendStrip from './Legend'

const QUERY_OPTS = {
  staleTime: 5 * 60_000,
  retry: 1,
} as const

type TeamSplit = 'season' | 'l30' | 'l60' | 'l90' | 'l120' | 'home' | 'away' | 'vsL' | 'vsR'

const SPLIT_OPTIONS: { value: TeamSplit; label: string }[] = [
  { value: 'season', label: 'Season' },
  { value: 'l30', label: 'L30 PA' },
  { value: 'l60', label: 'L60 PA' },
  { value: 'l90', label: 'L90 PA' },
  { value: 'l120', label: 'L120 PA' },
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'vsR', label: 'vs RHP' },
  { value: 'vsL', label: 'vs LHP' },
]

export interface TeamsTabProps {
  loading: boolean
  query: string
  filterSig: string
  onResetFilters: () => void
}

export default function TeamsTab({ loading, query, filterSig, onResetFilters }: TeamsTabProps) {
  const [split, setSplit] = useState<TeamSplit>('season')
  const statsQuery = trpc.teams.stats.useQuery({ split }, QUERY_OPTS)

  const response = statsQuery.data

  // Join the warehouse line (MLBAM-style abbr) to the local team record
  // (classic abbr) through the shared alias — never string-match raw.
  const { league, rows, unmatched } = useMemo(() => {
    const out: TeamRow[] = []
    const missed: string[] = []
    for (const stats of response?.teams ?? []) {
      const team = MLB_TEAMS.find((t) => toMlbamAbbr(t.abbr) === stats.abbr)
      if (!team) {
        missed.push(stats.abbr)
        continue
      }
      out.push({ team, stats })
    }
    const q = query.trim().toLowerCase()
    const filtered = q
      ? out.filter(
          (r) =>
            r.team.abbr.toLowerCase().includes(q) ||
            r.team.city.toLowerCase().includes(q) ||
            r.team.name.toLowerCase().includes(q),
        )
      : out
    return { league: out, rows: filtered, unmatched: missed }
  }, [response, query])

  // Heat baseline: the league mean per column. A team has no "own baseline" —
  // this is a different meaning of colour than the player tables, and the
  // provenance line says so.
  //
  // Computed over `league` (every joined team), NOT `rows` (the search-filtered
  // view). Deriving it from the visible rows makes the search box silently
  // redefine what the colours mean: search one team and it becomes its own
  // baseline, so every cell goes neutral; search "new" and two clubs become
  // "the league". The colours would still look authoritative while measuring
  // something the provenance line does not claim.
  const leagueMeans = useMemo(() => {
    const means: Record<string, number | null> = {}
    for (const key of HEATED_KEYS) {
      const vals = league
        .map((r) => r.stats[key as keyof MlbTeamStats])
        .filter((v): v is number => typeof v === 'number')
      means[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    return means
  }, [league])

  const columns = useMemo(() => teamColumns(leagueMeans), [leagueMeans])

  const provenance = response
    ? `Baseball Savant → sv_stat_cache · ${league.length}/30 teams${
        rows.length !== league.length ? ` · ${rows.length} shown` : ''
      } · min ${response.qualifierPa} PA · heat vs ${league.length}-team mean, not a team's own history${
        response.builtAt ? ` · updated ${response.builtAt.slice(0, 10)}` : ''
      }${unmatched.length ? ` · unmapped team_id abbr: ${unmatched.join(', ')}` : ''}`
    : undefined

  return (
    <div className="space-y-3">
      <div className="prizm-card px-5 py-3">
        <LegendStrip />
      </div>

      {/* Split selector — plate-appearance windows, not game windows */}
      <div className="prizm-card space-y-2 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="overline-caption text-text-3">Split</span>
          {SPLIT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setSplit(o.value)}
              aria-pressed={split === o.value}
              className={`data-mono rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                split === o.value ? 'bg-bg-3 text-text-1' : 'text-text-3 hover:text-text-1'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-text-3">
          Windows are plate-appearance windows, not game windows — no date-bucketed team rollup
          exists yet, so L6/L12/L21 game windows are not offered. Not available yet: wRC+
          (park/league adjustment needs a second source), Contact% and O-Swing% (not in
          sv_stat_cache — Zone% is the adjacent column), OPS (needs OBP, not in the warehouse),
          SB/SBA/SB% (MLB Stats API ingest, not the warehouse).
        </p>
      </div>

      <DataTable<TeamRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.team.abbr}
        loading={loading || statsQuery.isPending}
        filterSig={`${filterSig}:${split}`}
        onResetFilters={onResetFilters}
        emptyLabel="No teams match these filters"
        provenance={provenance}
        defaultSortKey="woba"
        defaultSortDir={-1}
        mobileTitle={(r) => `${r.team.city} ${r.team.name}`}
        mobileSummary={(r) =>
          `wOBA ${r.stats.woba != null ? fmt.rate(r.stats.woba) : '—'} · K ${
            r.stats.kPct != null ? fmt.svPct(r.stats.kPct) : '—'
          } · HardHit ${r.stats.hardHitPct != null ? fmt.svPct(r.stats.hardHitPct) : '—'} · ${
            r.stats.batters
          } batters`
        }
      />
    </div>
  )
}
