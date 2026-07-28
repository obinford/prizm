// MLB starting-pitcher column definitions.
//
// One entry per stat, carrying its formatter, heat polarity, provenance and
// definition. The DataTable renders whatever subset a preset selects; adding a
// column here is the whole change.
//
// SCALE NOTE: legacy MySQL kPct/bbPct are 0-1. Statcast (sv_stat_cache) percent
// fields are 0-100 as served. Formatters differ accordingly — fmt.pct1 for the
// former, fmt.svPct for the latter. Getting this wrong renders 2410% instead of
// 24.1%, so each column states which scale it reads.

import type { ColumnDef, ColumnPreset } from '@/lib/columns'
import { fmt } from '@/lib/columns'
import type { MlbWindowKey } from '@/data/mlbPlayers'
import type { StarterEntry } from '@/pages/dashboard/utils'

export type PitcherRow = StarterEntry

const MYSQL = 'MLB Stats API game logs → season_stats'
const SV = 'Baseball Savant → sv_stat_cache'
const SLATE = 'sv_slate'

/** Read a season-level numeric off the pitcher, null-safe. */
const p =
  (k: 'era' | 'whip' | 'kPct' | 'bbPct' | 'xwoba') =>
  (r: PitcherRow): number | null =>
    r.pitcher[k] ?? null

/** Read an additive Statcast field, null when the player has no coverage. */
const sv =
  (k: keyof PitcherRow['pitcher']) =>
  (r: PitcherRow): number | null => {
    const v = r.pitcher[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const IDENTITY_KEYS = ['player', 'team', 'throws', 'opponent']

// ---------------------------------------------------------------------------
// Season columns
// ---------------------------------------------------------------------------

export const PITCHER_SEASON_COLUMNS: ColumnDef<PitcherRow>[] = [
  {
    key: 'team',
    label: 'Team',
    value: (r) => r.pitcher.team,
    source: MYSQL,
    definition: 'The pitcher’s team.',
    sortable: true,
    align: 'left',
  },
  {
    key: 'throws',
    label: 'Throws',
    value: (r) => (r.pitcher.throws === 'L' ? 'LHP' : 'RHP'),
    source: MYSQL,
    definition: 'Which hand the pitcher throws with. Drives every platoon read.',
    markets: ['All pitcher props'],
    sortable: true,
  },
  {
    key: 'opponent',
    label: 'Opponent',
    value: (r) => `${r.homeAway === 'Home' ? 'vs' : '@'} ${r.opp}`,
    source: SLATE,
    definition: 'Tonight’s opponent, with home or away indicated.',
    sortable: true,
  },
  {
    key: 'era',
    label: 'ERA',
    group: 'Season',
    value: p('era'),
    format: fmt.era,
    invert: true,
    source: MYSQL,
    definition: 'Earned runs allowed per nine innings. Outcome-based, so it lags underlying skill.',
    markets: ['Earned Runs (O/U)', 'To Record a Win'],
    sortable: true,
  },
  {
    key: 'whip',
    label: 'WHIP',
    group: 'Season',
    value: p('whip'),
    format: fmt.whip,
    invert: true,
    source: MYSQL,
    definition: 'Walks plus hits allowed per inning pitched — how much traffic the pitcher allows.',
    markets: ['Hits Allowed (O/U)', 'Walks Allowed (O/U)'],
    sortable: true,
  },
  {
    key: 'kPct',
    label: 'K%',
    group: 'Season',
    value: p('kPct'),
    format: fmt.pct1, // 0-1 scale (legacy MySQL)
    source: MYSQL,
    definition: 'Share of batters faced who strike out. The single best predictor of a strikeout prop.',
    markets: ['Strikeouts (O/U)'],
    sortable: true,
  },
  {
    key: 'bbPct',
    label: 'BB%',
    group: 'Season',
    value: p('bbPct'),
    format: fmt.pct1, // 0-1 scale
    invert: true,
    source: MYSQL,
    definition: 'Share of batters faced who walk. High walk rates shorten starts.',
    markets: ['Walks Allowed (O/U)', 'Outs Recorded (O/U)'],
    sortable: true,
  },
  {
    key: 'xwoba',
    label: 'xwOBA',
    group: 'Season',
    value: p('xwoba'),
    format: fmt.rate,
    invert: true,
    source: `${SV} (falls back to an OPS-derived estimate when uncovered)`,
    definition:
      'Expected weighted on-base average allowed, from the quality of contact against. Strips out defence and luck.',
    markets: ['Earned Runs (O/U)', 'Hits Allowed (O/U)'],
    sortable: true,
  },
]

// ---------------------------------------------------------------------------
// Statcast columns — unlocked by Phase 1 patch 4
// ---------------------------------------------------------------------------

export const PITCHER_STATCAST_COLUMNS: ColumnDef<PitcherRow>[] = [
  {
    key: 'cswPct',
    label: 'CSW%',
    group: 'Statcast',
    value: sv('cswPct'),
    format: fmt.svPct, // 0-100 scale (sv native)
    source: SV,
    definition:
      'Called strikes plus whiffs, as a share of pitches. Stabilises faster than K% and predicts it.',
    markets: ['Strikeouts (O/U)'],
    sortable: true,
  },
  {
    key: 'swStrPct',
    label: 'SwStr%',
    group: 'Statcast',
    value: sv('swStrPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Swinging strikes as a share of total pitches — raw bat-missing ability.',
    markets: ['Strikeouts (O/U)'],
    sortable: true,
  },
  {
    key: 'whiffPct',
    label: 'Whiff%',
    group: 'Statcast',
    value: sv('whiffPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Swings that miss, as a share of swings. Whiff% is per-swing; SwStr% is per-pitch.',
    markets: ['Strikeouts (O/U)'],
    sortable: true,
  },
  {
    key: 'zonePct',
    label: 'Zone%',
    group: 'Statcast',
    value: sv('zonePct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Share of pitches in the strike zone. Low zone rates raise both walks and pitch counts.',
    markets: ['Walks Allowed (O/U)', 'Outs Recorded (O/U)'],
    sortable: true,
  },
  {
    key: 'barrelPct',
    label: 'Barrel%',
    group: 'Statcast',
    value: sv('barrelPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition:
      'Share of batted balls hit with the exit velocity and launch angle combination that produces the most damage.',
    markets: ['Earned Runs (O/U)', 'Home Runs Allowed'],
    sortable: true,
  },
  {
    key: 'hardHitPct',
    label: 'Hard-Hit%',
    group: 'Statcast',
    value: sv('hardHitPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Share of batted balls against this pitcher hit at 95 mph or harder.',
    markets: ['Earned Runs (O/U)', 'Hits Allowed (O/U)'],
    sortable: true,
  },
  {
    key: 'avgEv',
    label: 'Avg EV',
    group: 'Statcast',
    value: sv('avgEv'),
    format: fmt.ev,
    invert: true,
    source: SV,
    definition: 'Average exit velocity of batted balls against, in mph.',
    markets: ['Earned Runs (O/U)'],
    sortable: true,
  },
  {
    key: 'gbPct',
    label: 'GB%',
    group: 'Batted ball',
    value: sv('gbPct'),
    format: fmt.svPct,
    source: SV,
    definition: 'Share of batted balls on the ground. Ground-ball arms suppress home runs.',
    markets: ['Home Runs Allowed', 'Earned Runs (O/U)'],
    sortable: true,
  },
  {
    key: 'fbPct',
    label: 'FB%',
    group: 'Batted ball',
    value: sv('fbPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Share of batted balls in the air. Fly-ball arms are park- and weather-sensitive.',
    markets: ['Home Runs Allowed'],
    sortable: true,
  },
  {
    key: 'ldPct',
    label: 'LD%',
    group: 'Batted ball',
    value: sv('ldPct'),
    format: fmt.svPct,
    invert: true,
    source: SV,
    definition: 'Share of batted balls against this pitcher hit as line drives — the batted-ball type that becomes a hit most often.',
    markets: ['Hits Allowed (O/U)'],
    sortable: true,
  },
  {
    key: 'xba',
    label: 'xBA',
    group: 'Expected',
    value: sv('xba'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition: 'Expected batting average against, from contact quality rather than outcomes.',
    markets: ['Hits Allowed (O/U)'],
    sortable: true,
  },
  {
    key: 'xslg',
    label: 'xSLG',
    group: 'Expected',
    value: sv('xslg'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition: 'Expected slugging percentage against.',
    markets: ['Earned Runs (O/U)', 'Home Runs Allowed'],
    sortable: true,
  },
  {
    key: 'woba',
    label: 'wOBA',
    group: 'Expected',
    value: sv('woba'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition: 'Actual weighted on-base average allowed. Compare against xwOBA to spot luck.',
    markets: ['Earned Runs (O/U)'],
    sortable: true,
  },
  {
    key: 'babip',
    label: 'BABIP',
    group: 'Expected',
    value: sv('babip'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition:
      'Batting average on balls in play against. Far from .300 usually signals luck rather than skill.',
    markets: ['Hits Allowed (O/U)'],
    sortable: true,
  },
  {
    key: 'iso',
    label: 'ISO (ag)',
    group: 'Expected',
    value: sv('iso'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition: 'Isolated power allowed — slugging minus batting average. Extra-base damage only.',
    markets: ['Home Runs Allowed', 'Earned Runs (O/U)'],
    sortable: true,
  },
  {
    key: 'slg',
    label: 'SLG (ag)',
    group: 'Expected',
    value: sv('slg'),
    format: fmt.rate,
    invert: true,
    source: SV,
    definition: 'Slugging percentage allowed.',
    markets: ['Earned Runs (O/U)'],
    sortable: true,
  },
  {
    key: 'bbe',
    label: 'BBE',
    group: 'Expected',
    value: sv('bbe'),
    format: fmt.int,
    source: SV,
    definition:
      'Batted-ball events — the sample size behind every contact-quality rate on this row. Small BBE means the rates beside it are noisy.',
    sortable: true,
  },
]

/** Derived: strikeout rate minus walk rate. Both legacy 0-1, so ×100 once. */
export const PITCHER_DERIVED_COLUMNS: ColumnDef<PitcherRow>[] = [
  {
    key: 'kbbPct',
    label: 'K-BB%',
    group: 'Season',
    value: (r) => {
      const k = r.pitcher.kPct
      const bb = r.pitcher.bbPct
      return k == null || bb == null ? null : k - bb
    },
    format: fmt.pct1,
    source: `Derived from K% and BB% (${MYSQL})`,
    definition:
      'Strikeout rate minus walk rate. The most stable single summary of a pitcher’s command-and-miss profile.',
    markets: ['Strikeouts (O/U)', 'Earned Runs (O/U)'],
    sortable: true,
  },
]

export const PITCHER_COLUMNS: ColumnDef<PitcherRow>[] = [
  ...PITCHER_SEASON_COLUMNS,
  ...PITCHER_DERIVED_COLUMNS,
  ...PITCHER_STATCAST_COLUMNS,
]

// ---------------------------------------------------------------------------
// Rolling-window columns — built per window key
// ---------------------------------------------------------------------------

const WINDOW_STATS = ['era', 'whip', 'kPct', 'bbPct', 'xwoba'] as const
type WindowStat = (typeof WINDOW_STATS)[number]

const WINDOW_META: Record<WindowStat, { label: string; format: (v: number) => string; invert?: boolean }> = {
  era: { label: 'ERA', format: fmt.era, invert: true },
  whip: { label: 'WHIP', format: fmt.whip, invert: true },
  kPct: { label: 'K%', format: fmt.pct1 },
  bbPct: { label: 'BB%', format: fmt.pct1, invert: true },
  xwoba: { label: 'xwOBA', format: fmt.rate, invert: true },
}

/**
 * Heat-coloured window columns for one window key. Each cell is tinted by its
 * delta vs the pitcher's own season baseline — the "is he hot right now"
 * question rather than "is he good".
 */
export function pitcherWindowColumns(
  window: MlbWindowKey,
  windowLabel: string,
  stats: readonly WindowStat[] = WINDOW_STATS,
): ColumnDef<PitcherRow>[] {
  return stats.map((s) => ({
    key: `${window}:${s}`,
    label: WINDOW_META[s].label,
    group: windowLabel,
    value: (r) => r.pitcher.windows[window]?.[s] ?? null,
    baseline: (r) => r.pitcher[s] ?? null,
    format: WINDOW_META[s].format,
    invert: WINDOW_META[s].invert,
    heat: true,
    source: `${MYSQL} — rolling ${windowLabel} window`,
    definition: `${WINDOW_META[s].label} over the ${windowLabel} window, coloured against this pitcher's own season baseline.`,
    sortable: true,
    missingHint:
      'Rolling windows are unavailable while a split filter is active — Statcast splits are season-level only.',
  }))
}

// ---------------------------------------------------------------------------
// Market-keyed column presets
// ---------------------------------------------------------------------------

export const PITCHER_PRESETS: ColumnPreset[] = [
  {
    key: 'k',
    label: 'K',
    description: 'Strikeout props',
    columns: ['kPct', 'kbbPct', 'cswPct', 'swStrPct', 'whiffPct', 'zonePct', 'era', 'xwoba'],
  },
  {
    key: 'bb',
    label: 'BB',
    description: 'Walks allowed',
    columns: ['bbPct', 'kbbPct', 'zonePct', 'whip', 'era'],
  },
  {
    key: 'h',
    label: 'H',
    description: 'Hits allowed',
    columns: ['whip', 'xba', 'babip', 'ldPct', 'hardHitPct', 'avgEv', 'xwoba'],
  },
  {
    key: 'er',
    label: 'ER',
    description: 'Earned runs',
    columns: ['era', 'xwoba', 'woba', 'barrelPct', 'hardHitPct', 'xslg', 'whip'],
  },
  {
    key: 'hr',
    label: 'HR',
    description: 'Home runs allowed',
    columns: ['barrelPct', 'fbPct', 'gbPct', 'iso', 'xslg', 'hardHitPct'],
  },
  {
    key: 'contact',
    label: 'Contact',
    description: 'Batted-ball profile',
    columns: ['gbPct', 'fbPct', 'ldPct', 'barrelPct', 'hardHitPct', 'avgEv', 'bbe'],
  },
]
