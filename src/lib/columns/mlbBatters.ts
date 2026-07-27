// MLB batter column definitions.
//
// Companion to mlbPitchers.ts. Feeds the Batters tab (currently 5 stats x 4
// windows against Handigraphs' 50 columns) and the GameCenter splits matrix.
//
// SCALE NOTE: legacy MySQL rate stats (avg/obp/slg/iso) are 0-1 baseball rates.
// Statcast (sv_stat_cache) percent fields are 0-100 as served. Formatters differ
// accordingly — fmt.rate for the former, fmt.svPct for the latter. Getting this
// wrong renders 2410% instead of 24.1%, so each column states which it reads.
//
// A note on what is NOT here: batting order and opponent handedness are
// Handigraphs' columns 4 and 6 and gate every batter prop, but neither exists in
// Prizm's data model (Batter has no order field; opposing hand is a row filter
// only). They need a lineup feed. Deliberately absent rather than approximated.

import type { ColumnDef, ColumnPreset } from '@/lib/columns'
import { fmt } from '@/lib/columns'
import type { Batter, MlbWindowKey } from '@/data/mlbPlayers'

/** Row shape — the Batters tab renders batters directly, unlike StarterEntry. */
export interface BatterRow {
  batter: Batter
  /** Tonight's opposing starter hand, when the slate knows it. */
  oppHand?: 'L' | 'R' | null
  opp?: string
  homeAway?: 'Home' | 'Away'
}

const MYSQL = 'MLB Stats API game logs → season_stats'
const SV = 'Baseball Savant → sv_stat_cache'

/** Season-level legacy numeric, null-safe. */
const b =
  (k: 'avg' | 'obp' | 'slg' | 'iso' | 'xbh' | 'tb') =>
  (r: BatterRow): number | null =>
    r.batter[k] ?? null

/** Additive Statcast field; null when the batter has no coverage. */
const sv =
  (k: keyof Batter) =>
  (r: BatterRow): number | null => {
    const v = r.batter[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const BATTER_IDENTITY_COLUMNS: ColumnDef<BatterRow>[] = [
  {
    key: 'team',
    label: 'Team',
    value: (r) => r.batter.team,
    source: MYSQL,
    definition: 'The batter’s team.',
    sortable: true,
    align: 'left',
  },
  {
    key: 'pos',
    label: 'Pos',
    value: (r) => r.batter.pos,
    source: MYSQL,
    definition: 'Fielding position.',
    sortable: true,
  },
  {
    key: 'bats',
    label: 'Bats',
    value: (r) => r.batter.bats,
    source: MYSQL,
    definition:
      'Which side the batter hits from. S is a switch hitter, who takes the favourable side against the starter.',
    markets: ['All batter props'],
    sortable: true,
  },
  {
    key: 'oppHand',
    label: 'Opp L/R',
    value: (r) => (r.oppHand ? `${r.oppHand}HP` : null),
    source: 'sv_slate probable starters',
    definition:
      'The hand of tonight’s opposing starter. With Bats, this is the platoon matchup — the single biggest swing factor on a batter prop.',
    markets: ['All batter props'],
    missingHint: 'No probable starter named for this game yet.',
    sortable: true,
  },
]

// ---------------------------------------------------------------------------
// Season — legacy MySQL rates
// ---------------------------------------------------------------------------

export const BATTER_SEASON_COLUMNS: ColumnDef<BatterRow>[] = [
  {
    key: 'avg',
    label: 'AVG',
    group: 'Season',
    value: b('avg'),
    format: fmt.rate,
    source: MYSQL,
    definition: 'Batting average — hits per at-bat. Ignores walks, so it understates on-base skill.',
    markets: ['Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'obp',
    label: 'OBP',
    group: 'Season',
    value: b('obp'),
    format: fmt.rate,
    source: MYSQL,
    definition: 'On-base percentage — how often the batter reaches by any means.',
    markets: ['Runs Scored', 'Hits + Runs + RBIs'],
    sortable: true,
  },
  {
    key: 'slg',
    label: 'SLG',
    group: 'Season',
    value: b('slg'),
    format: fmt.rate,
    source: MYSQL,
    definition: 'Slugging percentage — total bases per at-bat. Weights extra-base hits.',
    markets: ['Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'ops',
    label: 'OPS',
    group: 'Season',
    value: (r) => {
      const o = r.batter.obp
      const s = r.batter.slg
      return o == null || s == null ? null : o + s
    },
    format: fmt.rate,
    source: `Derived: OBP + SLG (${MYSQL})`,
    definition:
      'On-base plus slugging. A quick composite of reaching base and hitting for power; crude but widely quoted.',
    markets: ['Total Bases (O/U)', 'Hits + Runs + RBIs'],
    sortable: true,
  },
  {
    key: 'iso',
    label: 'ISO',
    group: 'Season',
    value: b('iso'),
    format: fmt.rate,
    source: MYSQL,
    definition:
      'Isolated power — slugging minus batting average. Strips singles out, leaving extra-base damage only.',
    markets: ['Total Bases (O/U)', 'Home Runs', 'Doubles'],
    sortable: true,
  },
  {
    key: 'xbh',
    label: 'XBH/G',
    group: 'Season',
    value: b('xbh'),
    format: fmt.dec2,
    source: MYSQL,
    definition: 'Extra-base hits per game — doubles, triples and home runs.',
    markets: ['Doubles', 'Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'tb',
    label: 'TB/G',
    group: 'Season',
    value: b('tb'),
    format: fmt.dec2,
    source: MYSQL,
    definition: 'Total bases per game.',
    markets: ['Total Bases (O/U)'],
    sortable: true,
  },
]

// ---------------------------------------------------------------------------
// Statcast — expected outcomes and contact quality
// ---------------------------------------------------------------------------

export const BATTER_STATCAST_COLUMNS: ColumnDef<BatterRow>[] = [
  {
    key: 'xwoba',
    label: 'xwOBA',
    group: 'Expected',
    value: sv('xwobaReal'),
    format: fmt.rate,
    source: SV,
    definition:
      'Expected weighted on-base average, from the quality of contact rather than whether balls found gloves. The best single summary of a hitter’s true form.',
    markets: ['Total Bases (O/U)', 'Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'woba',
    label: 'wOBA',
    group: 'Expected',
    value: sv('woba'),
    format: fmt.rate,
    source: SV,
    definition:
      'Actual weighted on-base average. Compare against xwOBA — a large gap usually means luck, not skill.',
    markets: ['Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'xba',
    label: 'xBA',
    group: 'Expected',
    value: sv('xba'),
    format: fmt.rate,
    source: SV,
    definition: 'Expected batting average from contact quality.',
    markets: ['Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'xslg',
    label: 'xSLG',
    group: 'Expected',
    value: sv('xslg'),
    format: fmt.rate,
    source: SV,
    definition: 'Expected slugging percentage from contact quality.',
    markets: ['Total Bases (O/U)', 'Home Runs'],
    sortable: true,
  },
  {
    key: 'babip',
    label: 'BABIP',
    group: 'Expected',
    value: sv('babip'),
    format: fmt.rate,
    source: SV,
    definition:
      'Batting average on balls in play. Far above or below .300 is usually variance that regresses.',
    markets: ['Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'barrelPct',
    label: 'Barrel%',
    group: 'Contact',
    value: sv('barrelPct'),
    format: fmt.svPct,
    source: SV,
    definition:
      'Share of batted balls struck with the exit-velocity and launch-angle combination that produces the most damage. The cleanest home-run signal.',
    markets: ['Home Runs', 'Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'hardHitPct',
    label: 'Hard-Hit%',
    group: 'Contact',
    value: sv('hardHitPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Share of batted balls hit at 95 mph or harder.',
    markets: ['Total Bases (O/U)', 'Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'avgEv',
    label: 'Avg EV',
    group: 'Contact',
    value: sv('avgEv'),
    format: fmt.ev,
    source: SV,
    definition: 'Average exit velocity off the bat, in mph.',
    markets: ['Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'whiffPct',
    label: 'Whiff%',
    group: 'Discipline',
    value: sv('whiffPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Swings that miss, as a share of swings.',
    markets: ['Strikeouts', 'Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'swStrPct',
    label: 'SwStr%',
    group: 'Discipline',
    value: sv('swStrPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Swinging strikes as a share of total pitches seen.',
    markets: ['Strikeouts'],
    sortable: true,
  },
  {
    key: 'cswPct',
    label: 'CSW%',
    group: 'Discipline',
    value: sv('cswPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Called strikes plus whiffs against this batter, as a share of pitches seen.',
    markets: ['Strikeouts'],
    sortable: true,
  },
  {
    key: 'zonePct',
    label: 'Zone%',
    group: 'Discipline',
    value: sv('zonePct'),
    format: fmt.svPct,
    source: SV,
    definition:
      'Share of pitches seen inside the strike zone. Low rates mean pitchers are avoiding the batter.',
    markets: ['Walks', 'Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'gbPct',
    label: 'GB%',
    group: 'Batted ball',
    value: sv('gbPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Share of batted balls on the ground. Ground balls rarely become extra-base hits.',
    markets: ['Home Runs', 'Total Bases (O/U)'],
    sortable: true,
  },
  {
    key: 'fbPct',
    label: 'FB%',
    group: 'Batted ball',
    value: sv('fbPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Share of batted balls in the air — the prerequisite for home-run power.',
    markets: ['Home Runs'],
    sortable: true,
  },
  {
    key: 'ldPct',
    label: 'LD%',
    group: 'Batted ball',
    value: sv('ldPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Share of batted balls hit as line drives — the type that becomes a hit most often.',
    markets: ['Hits (O/U)'],
    sortable: true,
  },
  {
    key: 'hrPct',
    label: 'HR%',
    group: 'Batted ball',
    value: sv('hrPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Home runs as a share of plate appearances.',
    markets: ['Home Runs'],
    sortable: true,
  },
  {
    key: 'bbe',
    label: 'BBE',
    group: 'Batted ball',
    value: sv('bbe'),
    format: fmt.int,
    source: SV,
    definition:
      'Batted-ball events — the sample size behind every contact rate on this row. Low BBE means the percentages beside it are noisy.',
    sortable: true,
  },
]

export const BATTER_COLUMNS: ColumnDef<BatterRow>[] = [
  ...BATTER_IDENTITY_COLUMNS,
  ...BATTER_SEASON_COLUMNS,
  ...BATTER_STATCAST_COLUMNS,
]

// ---------------------------------------------------------------------------
// Rolling-window columns
// ---------------------------------------------------------------------------

const WINDOW_STATS = ['avg', 'obp', 'slg', 'iso', 'xbh', 'tb'] as const
type WindowStat = (typeof WINDOW_STATS)[number]

const WINDOW_META: Record<WindowStat, { label: string; format: (v: number) => string }> = {
  avg: { label: 'AVG', format: fmt.rate },
  obp: { label: 'OBP', format: fmt.rate },
  slg: { label: 'SLG', format: fmt.rate },
  iso: { label: 'ISO', format: fmt.rate },
  xbh: { label: 'XBH/G', format: fmt.dec2 },
  tb: { label: 'TB/G', format: fmt.dec2 },
}

/**
 * Heat-coloured window columns for one PA window. Each cell is tinted by its
 * delta against the batter's own season baseline — "is he hot right now",
 * not "is he good".
 */
export function batterWindowColumns(
  window: MlbWindowKey,
  windowLabel: string,
  stats: readonly WindowStat[] = WINDOW_STATS,
): ColumnDef<BatterRow>[] {
  return stats.map((s) => ({
    key: `${window}:${s}`,
    label: WINDOW_META[s].label,
    group: windowLabel,
    value: (r) => r.batter.windows[window]?.[s] ?? null,
    baseline: (r) => r.batter[s] ?? null,
    format: WINDOW_META[s].format,
    heat: true,
    source: `${MYSQL} — rolling ${windowLabel} window`,
    definition: `${WINDOW_META[s].label} over the ${windowLabel} window, coloured against this batter's own season baseline.`,
    sortable: true,
  }))
}

// ---------------------------------------------------------------------------
// Market-keyed presets — mirrors the chip row on the pitcher table
// ---------------------------------------------------------------------------

export const BATTER_PRESETS: ColumnPreset[] = [
  {
    key: 'h',
    label: 'H',
    description: 'Hits',
    columns: ['avg', 'xba', 'babip', 'ldPct', 'hardHitPct', 'whiffPct', 'xwoba'],
  },
  {
    key: 'tb',
    label: 'TB',
    description: 'Total bases',
    columns: ['tb', 'slg', 'xslg', 'iso', 'barrelPct', 'hardHitPct', 'avgEv', 'xwoba'],
  },
  {
    key: 'hr',
    label: 'HR',
    description: 'Home runs',
    columns: ['hrPct', 'barrelPct', 'fbPct', 'gbPct', 'iso', 'xslg', 'avgEv'],
  },
  {
    key: '2b',
    label: '2B',
    description: 'Doubles',
    columns: ['xbh', 'iso', 'ldPct', 'hardHitPct', 'avgEv', 'slg'],
  },
  {
    key: 'k',
    label: 'K',
    description: 'Strikeouts',
    columns: ['whiffPct', 'swStrPct', 'cswPct', 'zonePct', 'avg'],
  },
  {
    key: 'bb',
    label: 'BB',
    description: 'Walks',
    columns: ['obp', 'zonePct', 'whiffPct', 'avg'],
  },
  {
    key: 'contact',
    label: 'Contact',
    description: 'Batted-ball profile',
    columns: ['gbPct', 'fbPct', 'ldPct', 'barrelPct', 'hardHitPct', 'avgEv', 'bbe'],
  },
]
