// Player Profiler — derivations layered on top of src/data seeds.
// Phase 1 cleanup: fabricated generators (game logs, trend series, similarity,
// form delta, goalie/skater header extras, unsupported split categories) were
// deleted because no data source exists for them.
// Phase 1 REWIRE: batter K%/BB%/xwOBA, pitcher GB%/SwStr% and the vs-L/R +
// home/away split cards now read the real sv warehouse fields attached by
// api/loaders.ts (xwobaReal, gbPct, swStrPct, splits.vsL/vsR/home/away).
// With that, the name-hash RNG is gone from this module entirely.

import { BATTERS, PITCHERS, type Batter, type Pitcher, type SavantSplitLine } from '@/data/mlbPlayers'
import { GOALIES, SKATERS, type Goalie, type Skater } from '@/data/nhlPlayers'
import { deltaPct } from '@/lib/heat'

export type AnyPlayer = Pitcher | Batter | Goalie | Skater
export type PlayerKind = 'pitcher' | 'batter' | 'goalie' | 'skater'

export function kindOf(p: AnyPlayer): PlayerKind {
  return p.kind
}

export function sportOf(p: AnyPlayer): 'mlb' | 'nhl' {
  return p.sport
}

export function posLabel(p: AnyPlayer): string {
  if (p.kind === 'pitcher') return p.role
  if (p.kind === 'goalie') return 'G'
  return p.pos
}

export function handLabel(p: AnyPlayer): string {
  if (p.kind === 'pitcher') return `Throws ${p.throws}`
  if (p.kind === 'batter') return `Bats ${p.bats}`
  if (p.kind === 'goalie') return `Catches ${p.catches}`
  return `Shoots ${p.shoots}`
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const fmt3 = (v: number) => v.toFixed(3).replace(/^0/, '')

/** Sample-weighted mean of a 0–100 rate across sv split rows (e.g. season
 * K% ≈ PA-weighted vsL + vsR). Pure arithmetic on real rows; null when the
 * rows or their samples aren't there. */
function splitWeighted(lines: (SavantSplitLine | undefined)[], key: 'kPct' | 'bbPct'): number | null {
  let num = 0
  let den = 0
  for (const l of lines) {
    const v = l?.[key]
    if (v == null || l?.pa == null) continue
    num += v * l.pa
    den += l.pa
  }
  return den > 0 ? num / den : null
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findPlayer(id: string): AnyPlayer | undefined {
  return (
    PITCHERS.find((p) => p.id === id) ??
    BATTERS.find((p) => p.id === id) ??
    GOALIES.find((p) => p.id === id) ??
    SKATERS.find((p) => p.id === id)
  )
}

export function searchAllPlayers(q: string, sport?: 'mlb' | 'nhl'): AnyPlayer[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const pool: AnyPlayer[] = [
    ...(sport !== 'nhl' ? ([...PITCHERS, ...BATTERS] as AnyPlayer[]) : []),
    ...(sport !== 'mlb' ? ([...GOALIES, ...SKATERS] as AnyPlayer[]) : []),
  ]
  return pool
    .filter((p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase() === s)
    .slice(0, 6)
}

export const TRENDING_IDS = [
  'paul-skenes',
  'aaron-judge',
  'tarik-skubal',
  'shohei-ohtani',
  'nathan-mackinnon',
  'connor-mcdavid',
]

const RECENT_KEY = 'prizm_recent_players'

export function getRecentPlayers(): AnyPlayer[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    return ids.map(findPlayer).filter((p): p is AnyPlayer => Boolean(p)).slice(0, 8)
  } catch {
    return []
  }
}

export function pushRecentPlayer(id: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    const next = [id, ...ids.filter((x) => x !== id)].slice(0, 8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Composite form score (0–100) — real rolling-window values vs season baseline
// ---------------------------------------------------------------------------

export function formScore(p: AnyPlayer): number {
  let score: number
  if (p.kind === 'batter') {
    const dAvg = deltaPct(p.windows.L30.avg, p.avg)
    const dTb = deltaPct(p.windows.L30.tb, p.tb)
    score = 50 + dAvg * 1.1 + dTb * 0.9
  } else if (p.kind === 'pitcher') {
    const dEra = -deltaPct(p.windows.L30.era, p.era)
    const dK = deltaPct(p.windows.L30.kPct, p.kPct)
    score = 50 + dEra * 0.9 + dK * 0.7
  } else if (p.kind === 'goalie') {
    const dSv = deltaPct(p.windows.MIN60.svPct, p.svPct) * 8
    const wGsax = p.windows.MIN60.gsax
    const dGsax = wGsax == null || p.gsax == null ? 0 : deltaPct(wGsax, p.gsax)
    score = 50 + dSv + dGsax * 0.3
  } else {
    const dSog = deltaPct(p.windows.MIN60.sog, p.sog)
    const dPts = deltaPct(p.windows.MIN60.points, p.points)
    score = 50 + dSog * 0.8 + dPts * 0.8
  }
  return clamp(Math.round(score), 2, 98)
}

// ---------------------------------------------------------------------------
// Header stat grid — seed stats plus the real sv warehouse fields. Anything
// without a source renders an em-dash, never an estimate.
// ---------------------------------------------------------------------------

export interface HeaderStat {
  label: string
  value: string
}

export function headerStats(p: AnyPlayer): HeaderStat[] {
  if (p.kind === 'batter') {
    // Season K%/BB% aren't served as single rows; they are the PA-weighted
    // combination of the real vsL/vsR split rows. xwOBA is the real Statcast
    // value — em-dash when the warehouse has no coverage for this player.
    const kPct = splitWeighted([p.splits?.vsL, p.splits?.vsR], 'kPct')
    const bbPct = splitWeighted([p.splits?.vsL, p.splits?.vsR], 'bbPct')
    return [
      { label: 'AVG', value: fmt3(p.avg) },
      { label: 'OBP', value: fmt3(p.obp) },
      { label: 'ISO', value: fmt3(p.iso) },
      { label: 'XBH/G', value: p.xbh.toFixed(2) },
      { label: 'TB/G', value: p.tb.toFixed(2) },
      { label: 'K%', value: kPct == null ? '—' : `${kPct.toFixed(1)}%` },
      { label: 'BB%', value: bbPct == null ? '—' : `${bbPct.toFixed(1)}%` },
      { label: 'xwOBA', value: p.xwobaReal == null ? '—' : fmt3(p.xwobaReal) },
    ]
  }
  if (p.kind === 'pitcher') {
    // GB% / SwStr% are the real sv season fields. Deleted: IP/G — it was
    // jittered from ERA and no innings-per-game source exists.
    return [
      { label: 'ERA', value: p.era.toFixed(2) },
      { label: 'WHIP', value: p.whip.toFixed(2) },
      { label: 'K%', value: `${(p.kPct * 100).toFixed(1)}%` },
      { label: 'BB%', value: `${(p.bbPct * 100).toFixed(1)}%` },
      { label: 'xwOBA', value: fmt3(p.xwoba) },
      { label: 'GB%', value: p.gbPct == null ? '—' : `${p.gbPct.toFixed(1)}%` },
      { label: 'SwStr%', value: p.swStrPct == null ? '—' : `${p.swStrPct.toFixed(1)}%` },
    ]
  }
  if (p.kind === 'goalie') {
    // Deleted: HD SV%, QS%, W, SO (jittered from svPct/gsax) and TOI/G
    // (hardcoded "58:40"). No source exists for any of them.
    return [
      { label: 'SV%', value: fmt3(p.svPct) },
      { label: 'GSAx/60', value: p.gsax == null ? '—' : p.gsax.toFixed(2) },
      { label: 'xGA/60', value: p.xgAgainst == null ? '—' : p.xgAgainst.toFixed(2) },
    ]
  }
  // Skater. Deleted: xG, TOI, PP%, SH% — all jittered from sog/goals/points.
  return [
    { label: 'SOG/G', value: p.sog.toFixed(1) },
    { label: 'G', value: p.goals.toFixed(2) },
    { label: 'A', value: Math.max(0.05, p.points - p.goals).toFixed(2) },
    { label: 'PTS', value: p.points.toFixed(2) },
  ]
}

// ---------------------------------------------------------------------------
// Split cards — real sv warehouse splits (vsL / vsR / home / away), season
// level. The card value is split xwOBA: sv serves no ERA or AVG by split,
// and xwOBA is the one rate stat present on every split row. The previous
// 4-window heat strip is gone — sv splits are season-level only, so there
// is no split-by-window data to show (the dashboard made the same call).
// NHL players have no split source at all and get an honest note instead.
// ---------------------------------------------------------------------------

export interface SplitCardData {
  title: string
  /** split xwOBA, or — when this split row isn't covered */
  value: string
  /** raw % delta vs the season xwOBA baseline; null when either side is missing */
  deltaPct: number | null
  /** lower-is-better stat (pitcher xwOBA) — flips chip polarity */
  invert?: boolean
  /** sample behind the split row — PA for batters, TBF for pitchers */
  sample: number | null
}

export function splitCards(p: AnyPlayer): SplitCardData[] {
  if (p.kind !== 'batter' && p.kind !== 'pitcher') return []

  const batter = p.kind === 'batter'
  // Season baseline: real Statcast xwOBA. Pitcher `xwoba` mirrors it when
  // covered, so it is a safe fallback there; uncovered players dash anyway.
  const seasonXwoba = p.xwobaReal ?? (batter ? null : p.xwoba)

  const defs: { title: string; line: SavantSplitLine | undefined }[] = batter
    ? [
        { title: 'vs LHP', line: p.splits?.vsL },
        { title: 'vs RHP', line: p.splits?.vsR },
        { title: 'Home', line: p.splits?.home },
        { title: 'Away', line: p.splits?.away },
      ]
    : [
        { title: 'vs LHB', line: p.splits?.vsL },
        { title: 'vs RHB', line: p.splits?.vsR },
        { title: 'Home', line: p.splits?.home },
        { title: 'Away', line: p.splits?.away },
      ]

  return defs.map(({ title, line }) => ({
    title,
    value: line?.xwoba == null ? '—' : fmt3(line.xwoba),
    deltaPct:
      line?.xwoba != null && seasonXwoba != null ? deltaPct(line.xwoba, seasonXwoba) : null,
    invert: !batter,
    sample: line?.pa ?? null,
  }))
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
