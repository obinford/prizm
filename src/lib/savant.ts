// Statcast (sv_*) display helpers — scale-aware formatting for the additive
// warehouse fields (contracts/prizm.ts §SavantWindowFields).
//
// SCALE: sv percent fields are 0–100 as served (e.g. 12.5 renders "12.5%").
// Legacy MySQL kPct/bbPct on season/window rows are 0–1 (multiply ×100).
// Rate stats (xwoba/xba/xslg/woba/babip) are 0–1; avgEv is mph.

import type { SavantSplitLine, SavantSplits, SavantWindowFields } from '@/data/mlbPlayers'

/** League-average constants used for heat-tinting Statcast strips. */
export const LEAGUE_AVG = {
  xwoba: 0.315,
  barrelPct: 8,
  hardHitPct: 38,
  whiffPct: 25,
  avgEv: 88,
} as const

/** Format an sv percent field (0–100 scale) — shown as-is with one decimal. */
export const fmtSvPct = (v: number): string => `${v.toFixed(1)}%`

/** Format a 0–1 rate stat the baseball way: .345 */
export const fmtRate = (v: number): string => v.toFixed(3).replace(/^0/, '')

/** Format avg exit velocity: 91.2 */
export const fmtEv = (v: number): string => v.toFixed(1)

/** True when a player/window object carries any real Statcast coverage. */
export function hasSavant(f: SavantWindowFields | null | undefined): boolean {
  if (!f) return false
  return (
    f.xwobaReal != null ||
    f.xba != null ||
    f.xslg != null ||
    f.barrelPct != null ||
    f.hardHitPct != null ||
    f.whiffPct != null ||
    f.cswPct != null ||
    f.avgEv != null
  )
}

export interface SvSplitChip {
  key: 'vsL' | 'vsR' | 'home' | 'away'
  label: string
  line: SavantSplitLine
}

const SPLIT_LABELS: Record<SvSplitChip['key'], string> = {
  vsL: 'vs L',
  vsR: 'vs R',
  home: 'Home',
  away: 'Away',
}

/** Ordered real split chips (vs L / vs R / Home / Away) — empty when no sv data. */
export function svSplitChips(splits: SavantSplits | undefined): SvSplitChip[] {
  if (!splits) return []
  return (Object.keys(SPLIT_LABELS) as SvSplitChip['key'][])
    .filter((key) => splits[key] != null)
    .map((key) => ({ key, label: SPLIT_LABELS[key], line: splits[key]! }))
}
