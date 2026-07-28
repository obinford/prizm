// MLB Team Stats column definitions.
//
// Companion to mlbPitchers.ts / mlbBatters.ts / mlbBullpen.tsx. One row per
// team, every statistic from api/teamsRouter.ts (sv_stat_cache batter lines
// aggregated to a team). src/data/mlbTeams.ts is used for IDENTITY ONLY —
// abbr, city, name, league, division. Its runsPerGame / bullpenEra /
// teamXwoba / parkFactor fields are hardcoded seed literals and are never
// read here.
//
// SCALE NOTE: sv percent fields are 0-100 as served (fmt.svPct). Rate stats
// are 0-1 (fmt.rate). Getting this wrong renders 2160% instead of 21.6%.
//
// HEAT: unlike every other table, a team has no "own baseline", so heat is
// against the LEAGUE MEAN for the column, computed in the tab across the 30
// rows in view and closed over by this factory. The provenance line says so.
//
// POLARITY: a column with no honest "better direction" — GB%, FB%, GB/FB,
// Zone% — sets heat: false. Colouring a neutral stat green implies a claim
// the data does not make.

import type { ColumnDef } from '@/lib/columns'
import { fmt } from '@/lib/columns'
import type { MlbTeam } from '@/data/mlbTeams'
import type { MlbTeamStats } from '@contracts/types'

export interface TeamRow {
  team: MlbTeam
  stats: MlbTeamStats
}

const SV = 'Baseball Savant → sv_stat_cache, team-aggregated'
const MISSING = 'No qualified batter on this team carried this stat with a usable weight.'

/** Numeric stat columns that heat against the league mean. */
export const HEATED_KEYS = [
  'woba',
  'xwoba',
  'avg',
  'slg',
  'iso',
  'babip',
  'xba',
  'xslg',
  'kPct',
  'bbPct',
  'swStrPct',
  'cswPct',
  'whiffPct',
  'hrPct',
  'hardHitPct',
  'barrelPct',
  'avgEv',
  'ldPct',
] as const satisfies readonly (keyof MlbTeamStats)[]

export type HeatedKey = (typeof HEATED_KEYS)[number]

type Means = Record<string, number | null>

interface StatCol {
  key: HeatedKey | 'zonePct' | 'gbPct' | 'fbPct' | 'gbFb'
  label: string
  group: string
  format: (v: number) => string
  weight: 'PA' | 'BBE' | 'derived'
  invert?: boolean
  neutral?: boolean // no honest polarity -> heat: false
  definition: string
  markets?: string[]
}

const STAT_COLS: StatCol[] = [
  // Production — PA-weighted
  { key: 'woba', label: 'wOBA', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Weighted on-base average — every offensive event scaled by its real run value. The best single summary of a team’s attack.', markets: ['Team totals', 'Moneyline'] },
  { key: 'xwoba', label: 'xwOBA', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Expected wOBA from contact quality, stripping out defence and luck. A gap vs wOBA usually means variance, not skill.', markets: ['Team totals'] },
  { key: 'avg', label: 'AVG', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Hits per at-bat, aggregated across the team’s qualified batters. Ignores walks, so it understates on-base skill.', markets: ['Team totals'] },
  { key: 'slg', label: 'SLG', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Total bases per at-bat — weights extra-base hits.', markets: ['Team totals'] },
  { key: 'iso', label: 'ISO', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Isolated power — slugging minus average. Extra-base damage only.', markets: ['Team totals'] },
  { key: 'babip', label: 'BABIP', group: 'Production', format: fmt.rate, weight: 'PA', definition: 'Batting average on balls in play. Far from .300 usually signals team-level luck that regresses.' },
  { key: 'hrPct', label: 'HR%', group: 'Production', format: fmt.svPct, weight: 'PA', definition: 'Home runs as a share of plate appearances.', markets: ['Team totals'] },
  // Expected — PA-weighted
  { key: 'xba', label: 'xBA', group: 'Expected', format: fmt.rate, weight: 'PA', definition: 'Expected batting average from contact quality.' },
  { key: 'xslg', label: 'xSLG', group: 'Expected', format: fmt.rate, weight: 'PA', definition: 'Expected slugging percentage from contact quality.', markets: ['Team totals'] },
  // Discipline — PA-weighted
  { key: 'kPct', label: 'K%', group: 'Discipline', format: fmt.svPct, weight: 'PA', invert: true, definition: 'Share of plate appearances ending in a strikeout. Lower is better for an offence.', markets: ['Team totals'] },
  { key: 'bbPct', label: 'BB%', group: 'Discipline', format: fmt.svPct, weight: 'PA', definition: 'Share of plate appearances ending in a walk. Patient lineups raise pitch counts and scoring floors.', markets: ['Team totals'] },
  { key: 'swStrPct', label: 'SwStr%', group: 'Discipline', format: fmt.svPct, weight: 'PA', invert: true, definition: 'Swinging strikes as a share of pitches seen. Lower means the lineup is not being beaten in the zone.' },
  { key: 'cswPct', label: 'CSW%', group: 'Discipline', format: fmt.svPct, weight: 'PA', invert: true, definition: 'Called strikes plus whiffs as a share of pitches seen. Lower is better for an offence.' },
  { key: 'whiffPct', label: 'Whiff%', group: 'Discipline', format: fmt.svPct, weight: 'PA', invert: true, definition: 'Swings that miss, as a share of swings.' },
  { key: 'zonePct', label: 'Zone%', group: 'Discipline', format: fmt.svPct, weight: 'PA', neutral: true, definition: 'Share of pitches seen inside the strike zone. Neither good nor bad on its own — elite hitters are pitched around.' },
  // Batted ball — BBE-weighted
  { key: 'hardHitPct', label: 'HardHit%', group: 'Batted ball', format: fmt.svPct, weight: 'BBE', definition: 'Share of batted balls hit at 95 mph or harder. Weighted by batted-ball events, not plate appearances.', markets: ['Team totals'] },
  { key: 'barrelPct', label: 'Barrel%', group: 'Batted ball', format: fmt.svPct, weight: 'BBE', definition: 'Share of batted balls with the exit-velocity/launch-angle combination that produces the most damage. Weighted by batted-ball events.', markets: ['Team totals'] },
  { key: 'avgEv', label: 'Avg EV', group: 'Batted ball', format: fmt.dec1, weight: 'BBE', definition: 'Average exit velocity off the bat, in mph. Weighted by batted-ball events.', markets: ['Team totals'] },
  { key: 'gbPct', label: 'GB%', group: 'Batted ball', format: fmt.svPct, weight: 'BBE', neutral: true, definition: 'Share of batted balls on the ground. A profile, not a quality grade — no honest better direction.' },
  { key: 'fbPct', label: 'FB%', group: 'Batted ball', format: fmt.svPct, weight: 'BBE', neutral: true, definition: 'Share of batted balls in the air. A profile, not a quality grade — no honest better direction.' },
  { key: 'ldPct', label: 'LD%', group: 'Batted ball', format: fmt.svPct, weight: 'BBE', definition: 'Share of batted balls hit as line drives — the type that becomes a hit most often.' },
  { key: 'gbFb', label: 'GB/FB', group: 'Batted ball', format: fmt.dec2, weight: 'derived', neutral: true, definition: 'Ground balls per fly ball, derived from GB% and FB%. A shape descriptor with no better direction.' },
]

/**
 * Build the column list, closing over the league means for the rows in view.
 * Heat baseline is the 30-team mean — a different meaning of colour than the
 * player tables, and the provenance line must say so.
 */
export function teamColumns(leagueMeans: Means): ColumnDef<TeamRow>[] {
  const identity: ColumnDef<TeamRow> = {
    key: 'team',
    label: 'Team',
    value: (r) => `${r.team.city} ${r.team.name}`,
    source: 'MLB Stats API → teams',
    definition: 'The team whose qualified batters this line aggregates.',
    sticky: true,
    minWidth: 190,
    sortable: true,
    render: (r) => (
      <>
        <span className="block text-sm font-semibold text-text-1">
          {r.team.city} {r.team.name}
        </span>
        <span className="data-mono block text-[11px] text-text-3">
          {r.team.abbr} · {r.team.league} {r.team.division}
        </span>
      </>
    ),
  }

  const sample: ColumnDef<TeamRow>[] = [
    {
      key: 'batters',
      label: 'Batters',
      value: (r) => r.stats.batters,
      format: fmt.int,
      source: SV,
      definition: 'Qualified batters behind this line (min PA qualifier applies) — the sample-size affordance.',
      sortable: true,
    },
    {
      key: 'teamPa',
      label: 'PA',
      value: (r) => r.stats.teamPa,
      format: fmt.int,
      source: SV,
      definition: 'Total plate appearances behind this line.',
      sortable: true,
    },
  ]

  const stats: ColumnDef<TeamRow>[] = STAT_COLS.map((c) => ({
    key: c.key,
    label: c.label,
    group: c.group,
    value: (r: TeamRow) => r.stats[c.key] ?? null,
    baseline: c.neutral ? undefined : () => leagueMeans[c.key] ?? null,
    format: c.format,
    invert: c.invert,
    heat: c.neutral ? false : true,
    source: `${SV} — ${c.weight === 'derived' ? 'derived from GB%/FB%' : `${c.weight}-weighted`}`,
    definition: c.definition,
    markets: c.markets,
    missingHint: MISSING,
    sortable: true,
  }))

  return [identity, ...sample, ...stats]
}
