// MLB bullpen column definitions.
//
// Companion to mlbPitchers.ts / mlbBatters.ts. One row per team, backed only by
// the real ingested reliever aggregates (api/ingest/mlb.ts:251-260 →
// slate.bullpens). Teams without an ingested row dash out and sort last —
// there is no fallback number and no per-team baseline, so no heat.
//
// SCALE NOTE: era/whip are innings rates; kPct/bbPct are legacy 0-1 rates
// (fmt.pct1), not sv-native 0-100.

import type { ColumnDef } from '@/lib/columns'
import { fmt } from '@/lib/columns'
import type { BullpenRow } from '@/pages/dashboard/utils'

export type { BullpenRow } from '@/pages/dashboard/utils'

const SRC = 'MLB Stats API game logs → team_stats (reliever aggregates)'
const MISSING = 'No ingested bullpen row for this team.'

export const BULLPEN_COLUMNS: ColumnDef<BullpenRow>[] = [
  {
    key: 'team',
    label: 'Team',
    value: (r) => `${r.team.city} ${r.team.name}`,
    source: SRC,
    definition: 'The team whose bullpen this line aggregates.',
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
  },
  {
    key: 'era',
    label: 'ERA',
    value: (r) => r.era,
    format: fmt.era,
    invert: true,
    source: SRC,
    definition: 'Earned runs allowed per nine innings by the team’s relievers, aggregated from game logs.',
    markets: ['Team totals', 'Live betting'],
    missingHint: MISSING,
    sortable: true,
  },
  {
    key: 'whip',
    label: 'WHIP',
    value: (r) => r.whip,
    format: fmt.whip,
    invert: true,
    source: SRC,
    definition: 'Walks plus hits allowed per inning by the team’s relievers — how much traffic the pen allows.',
    markets: ['Team totals'],
    missingHint: MISSING,
    sortable: true,
  },
  {
    key: 'kPct',
    label: 'K%',
    value: (r) => r.kPct,
    format: fmt.pct1, // 0-1 scale (legacy aggregate)
    source: SRC,
    definition: 'Share of batters faced that the team’s relievers strike out.',
    markets: ['Team totals'],
    missingHint: MISSING,
    sortable: true,
  },
  {
    key: 'bbPct',
    label: 'BB%',
    value: (r) => r.bbPct,
    format: fmt.pct1, // 0-1 scale (legacy aggregate)
    invert: true,
    source: SRC,
    definition: 'Share of batters faced that the team’s relievers walk.',
    markets: ['Team totals'],
    missingHint: MISSING,
    sortable: true,
  },
  {
    key: 'relievers',
    label: 'Arms',
    value: (r) => r.relievers,
    format: fmt.int,
    source: SRC,
    definition:
      'Distinct relievers behind the aggregate — the sample-size affordance. A pen line built on few arms is noisier.',
    missingHint: MISSING,
    sortable: true,
  },
]
