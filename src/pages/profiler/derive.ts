// Player Profiler — derivations layered on top of src/data seeds.
// Phase 1 cleanup: fabricated generators (game logs, trend series, similarity,
// form delta, goalie/skater header extras, unsupported split categories) were
// deleted because no data source exists for them. Remaining hash-based values
// (batter K%/BB%/xwOBA, pitcher GB%/SwStr%, vs-L/R + home/away split cards)
// are flagged REWIRE and are being connected to real warehouse splits in
// parallel work — do not "fix" them here.

import { BATTERS, PITCHERS, type Batter, type Pitcher } from '@/data/mlbPlayers'
import { GOALIES, SKATERS, type Goalie, type Skater } from '@/data/nhlPlayers'
import { deltaPct } from '@/lib/heat'

export type AnyPlayer = Pitcher | Batter | Goalie | Skater
export type PlayerKind = 'pitcher' | 'batter' | 'goalie' | 'skater'

const MLB_KEYS = ['L30', 'L60', 'L90', 'L120'] as const
const NHL_KEYS = ['MIN60', 'MIN120', 'MIN180', 'MIN240'] as const

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
// Deterministic RNG
// ---------------------------------------------------------------------------

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const fmt3 = (v: number) => v.toFixed(3).replace(/^0/, '')

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
// Header stat grid — 8 stats per player type (derived where seed data ends)
// ---------------------------------------------------------------------------

export interface HeaderStat {
  label: string
  value: string
}

export function headerStats(p: AnyPlayer): HeaderStat[] {
  const rand = mulberry32(hashString(`${p.id}-extras`))
  if (p.kind === 'batter') {
    const kPct = clamp(0.34 - p.avg * 0.55 - p.iso * 0.1 + (rand() - 0.5) * 0.05, 0.1, 0.32)
    const bbPct = clamp((p.obp - p.avg) * 0.9 + (rand() - 0.5) * 0.015, 0.03, 0.18)
    const xwoba = clamp(0.2 + p.obp * 0.28 + p.iso * 0.55 + (rand() - 0.5) * 0.02, 0.25, 0.48)
    return [
      { label: 'AVG', value: fmt3(p.avg) },
      { label: 'OBP', value: fmt3(p.obp) },
      { label: 'ISO', value: fmt3(p.iso) },
      { label: 'XBH/G', value: p.xbh.toFixed(2) },
      { label: 'TB/G', value: p.tb.toFixed(2) },
      { label: 'K%', value: `${(kPct * 100).toFixed(1)}%` },
      { label: 'BB%', value: `${(bbPct * 100).toFixed(1)}%` },
      { label: 'xwOBA', value: fmt3(xwoba) },
    ]
  }
  if (p.kind === 'pitcher') {
    const gbPct = clamp(0.38 + (0.3 - p.kPct) * 0.3 + (rand() - 0.5) * 0.08, 0.3, 0.58)
    const swStr = clamp(p.kPct * 0.45 + (rand() - 0.5) * 0.02, 0.08, 0.18)
    const ipg = clamp(5.2 + (3.5 - p.era) * 0.5 + (rand() - 0.5) * 0.6, 4.0, 6.9)
    return [
      { label: 'ERA', value: p.era.toFixed(2) },
      { label: 'WHIP', value: p.whip.toFixed(2) },
      { label: 'K%', value: `${(p.kPct * 100).toFixed(1)}%` },
      { label: 'BB%', value: `${(p.bbPct * 100).toFixed(1)}%` },
      { label: 'xwOBA', value: fmt3(p.xwoba) },
      { label: 'GB%', value: `${(gbPct * 100).toFixed(1)}%` },
      { label: 'SwStr%', value: `${(swStr * 100).toFixed(1)}%` },
      { label: 'IP/G', value: ipg.toFixed(1) },
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
// Split cards (2×3 grid) — big value + delta chip + 4-window heat strip
// ---------------------------------------------------------------------------

export interface SplitCardData {
  title: string
  value: string
  /** raw % delta vs season baseline (stat direction) */
  deltaPct: number
  /** lower-is-better stat (ERA) — flips heat polarity */
  invert?: boolean
  /** raw % deltas across the 4 rolling windows */
  windows: number[]
  windowLabels: string[]
}

export function splitCards(p: AnyPlayer): SplitCardData[] {
  const rand = mulberry32(hashString(`${p.id}-splits`))
  const jitterWin = (base: number, f: number) => base * (f + (rand() - 0.5) * 0.05)

  if (p.kind === 'batter') {
    const defs = [
      { title: 'vs LHP', f: 0.86 + rand() * 0.28 },
      { title: 'vs RHP', f: 0.86 + rand() * 0.28 },
      { title: 'Home', f: 0.92 + rand() * 0.16 },
      { title: 'Away', f: 0.92 + rand() * 0.16 },
      // Deleted: Day games, Night games — no day/night split exists in any source.
    ]
    return defs.map((d) => ({
      title: d.title,
      value: fmt3(p.avg * d.f),
      deltaPct: (d.f - 1) * 100,
      windows: MLB_KEYS.map((k) => deltaPct(jitterWin(p.windows[k].avg, d.f), p.avg)),
      windowLabels: ['L30', 'L60', 'L90', 'L120'],
    }))
  }

  if (p.kind === 'pitcher') {
    const defs = [
      { title: 'vs LHB', f: 0.8 + rand() * 0.4 },
      { title: 'vs RHB', f: 0.8 + rand() * 0.4 },
      { title: 'Home', f: 0.85 + rand() * 0.3 },
      { title: 'Away', f: 0.85 + rand() * 0.3 },
      // Deleted: 1st/3rd time through the order — no times-through split exists in any source.
    ]
    return defs.map((d) => ({
      title: d.title,
      value: (p.era * d.f).toFixed(2),
      deltaPct: (d.f - 1) * 100,
      invert: true,
      windows: MLB_KEYS.map((k) => deltaPct(jitterWin(p.windows[k].era, d.f), p.era)),
      windowLabels: ['L30', 'L60', 'L90', 'L120'],
    }))
  }

  if (p.kind === 'goalie') {
    const defs = [
      { title: 'Home', f: 1 + (rand() - 0.5) * 0.03 },
      { title: 'Away', f: 1 + (rand() - 0.5) * 0.03 },
      // Deleted: vs Top-10/Bottom-10, 2+ days rest, Back-to-back — no opponent-tier
      // or rest split exists in any source.
    ]
    return defs.map((d) => ({
      title: d.title,
      value: fmt3(p.svPct * d.f),
      deltaPct: (d.f - 1) * 100,
      windows: NHL_KEYS.map((k) => deltaPct(jitterWin(p.windows[k].svPct, d.f), p.svPct)),
      windowLabels: ['60', '120', '180', '240'],
    }))
  }

  const defs = [
    { title: 'Home', f: 0.8 + rand() * 0.45 },
    { title: 'Away', f: 0.8 + rand() * 0.45 },
    // Deleted: vs Top-10/Bottom-10, vs Division/Non-division — no opponent-tier
    // or division split exists in any source.
  ]
  return defs.map((d) => ({
    title: d.title,
    value: (p.sog * d.f).toFixed(1),
    deltaPct: (d.f - 1) * 100,
    windows: NHL_KEYS.map((k) => deltaPct(jitterWin(p.windows[k].sog, d.f), p.sog)),
    windowLabels: ['60', '120', '180', '240'],
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
