// Filter Library presets — Step 11.3.
//
// Each preset is a saved FilterRule[] set over the SEASON columns of the
// Starters or Batters table (window columns are tab-state-dependent; season
// columns are always rendered, so a library preset can never reference a
// column the target table lacks). Thresholds are Prizm display choices,
// written fresh against our own column scales — not carried over from any
// other product. Scales: legacy kPct/bbPct are 0-1; sv percents (barrelPct,
// whiffPct) are 0-100; rates (avg, xwoba) are 0-1.
//
// "Open in table" navigates to /dashboard?tab=<starters|batters>&rules=<json>
// — Dashboard applies the rules through the Step 4 registerRules bridge.

import type { FilterRule } from '@/lib/filterRules'

export interface LibraryPreset {
  key: string
  label: string
  side: 'pitcher' | 'batter'
  /** What the concept means here, including any proxy honesty. */
  description: string
  rules: FilterRule[]
}

function rule(id: string, columnKey: string, op: FilterRule['op'], value: number): FilterRule {
  return { id, columnKey, op, value }
}

export const LIBRARY_PRESETS: LibraryPreset[] = [
  {
    key: 'over-er',
    label: 'Over ER',
    side: 'pitcher',
    description: 'Starters in run-allowing form — season ERA 4.30 or worse.',
    rules: [rule('lib-over-er-1', 'era', 'gte', 4.3)],
  },
  {
    key: 'under-er',
    label: 'Under ER',
    side: 'pitcher',
    description: 'Run prevention — season ERA 3.10 or better.',
    rules: [rule('lib-under-er-1', 'era', 'lte', 3.1)],
  },
  {
    key: 'over-ks',
    label: 'Over Ks',
    side: 'pitcher',
    description: 'Strikeout stuff — season K% at least 27% (0-1 scale).',
    rules: [rule('lib-over-ks-1', 'kPct', 'gte', 0.27)],
  },
  {
    key: 'under-ks',
    label: 'Under Ks',
    side: 'pitcher',
    description: 'Contact managers — season K% no higher than 17% (0-1 scale).',
    rules: [rule('lib-under-ks-1', 'kPct', 'lte', 0.17)],
  },
  {
    key: 'under-hits',
    label: 'Under Hits',
    side: 'pitcher',
    description: 'Limits baserunners — season WHIP 1.08 or better.',
    rules: [rule('lib-under-hits-1', 'whip', 'lte', 1.08)],
  },
  {
    key: 'over-outs',
    label: 'Over Outs',
    side: 'pitcher',
    description:
      'Deep-game profile. There is no outs column in the warehouse — this is the efficiency proxy (WHIP ≤ 1.05 and BB% ≤ 5.5%), labelled as one.',
    rules: [rule('lib-over-outs-1', 'whip', 'lte', 1.05), rule('lib-over-outs-2', 'bbPct', 'lte', 0.055)],
  },
  {
    key: 'under-outs',
    label: 'Under Outs',
    side: 'pitcher',
    description:
      'Short-outing risk. Same caveat — no outs column, so this is the baserunner proxy (WHIP ≥ 1.38), labelled as one.',
    rules: [rule('lib-under-outs-1', 'whip', 'gte', 1.38)],
  },
  {
    key: 'over-hits',
    label: 'Over Hits',
    side: 'batter',
    description: 'Consistent contact — season AVG .295 or better.',
    rules: [rule('lib-over-hits-1', 'avg', 'gte', 0.295)],
  },
  {
    key: 'hr-candidates',
    label: 'HR Candidates',
    side: 'batter',
    description: 'Barrel rate at least 12% (sv 0-100 scale) — the power floor.',
    rules: [rule('lib-hr-candidates-1', 'barrelPct', 'gte', 12)],
  },
  {
    key: 'best-fades',
    label: 'Best Fades',
    side: 'batter',
    description: 'Cold profiles — xwOBA .290 or worse with a whiff rate of 28% or more.',
    rules: [
      rule('lib-best-fades-1', 'xwoba', 'lte', 0.29),
      rule('lib-best-fades-2', 'whiffPct', 'gte', 28),
    ],
  },
]
