// Player Profiler — deterministic derivations layered on top of src/data seeds.
// Anything not in the seed data (game logs, handedness splits, batted-ball mix,
// composite form score) is generated from a name hash so it's stable per player.

import { BATTERS, PITCHERS, type Batter, type Pitcher } from '@/data/mlbPlayers'
import { GOALIES, SKATERS, type Goalie, type Skater } from '@/data/nhlPlayers'
import { MLB_TEAMS } from '@/data/mlbTeams'
import { getPlayerProps } from '@/data/props'
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
// Composite form score (0–100) + delta vs two weeks ago
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

export function formDelta(p: AnyPlayer): number {
  return Math.round(((hashString(`${p.id}-2w`) % 15) - 7) * 1.2)
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
    const hdSv = clamp(p.svPct - 0.06 + (rand() - 0.5) * 0.02, 0.76, 0.9)
    const qs = clamp(0.5 + (p.gsax ?? 0) * 0.12 + (rand() - 0.5) * 0.1, 0.3, 0.78)
    const wins = clamp(Math.round(18 + (p.gsax ?? 0) * 9 + (rand() - 0.5) * 6), 10, 38)
    const so = clamp(Math.round(p.svPct * 6 - 2 + rand() * 2), 0, 6)
    return [
      { label: 'SV%', value: fmt3(p.svPct) },
      { label: 'GSAx/60', value: p.gsax == null ? '—' : p.gsax.toFixed(2) },
      { label: 'xGA/60', value: p.xgAgainst == null ? '—' : p.xgAgainst.toFixed(2) },
      { label: 'HD SV%', value: fmt3(hdSv) },
      { label: 'QS%', value: `${(qs * 100).toFixed(0)}%` },
      { label: 'W', value: `${wins}` },
      { label: 'SO', value: `${so}` },
      { label: 'TOI/G', value: '58:40' },
    ]
  }
  const xg = clamp(p.sog * 0.11 + p.goals * 0.25 + (rand() - 0.5) * 0.08, 0.15, 1.1)
  const toi = clamp(15 + p.points * 4 + (p.pos === 'D' ? 3.5 : 0) + (rand() - 0.5) * 2, 14, 25)
  const ppPct = clamp(0.16 + p.goals * 0.14 + (rand() - 0.5) * 0.05, 0.1, 0.36)
  const shPct = clamp(p.goals / Math.max(0.6, p.sog), 0.05, 0.26)
  const toiM = Math.floor(toi)
  const toiS = Math.round((toi - toiM) * 60)
  return [
    { label: 'SOG/G', value: p.sog.toFixed(1) },
    { label: 'G', value: p.goals.toFixed(2) },
    { label: 'A', value: Math.max(0.05, p.points - p.goals).toFixed(2) },
    { label: 'PTS', value: p.points.toFixed(2) },
    { label: 'xG', value: xg.toFixed(2) },
    { label: 'TOI', value: `${toiM}:${`${toiS}`.padStart(2, '0')}` },
    { label: 'PP%', value: `${(ppPct * 100).toFixed(1)}%` },
    { label: 'SH%', value: `${(shPct * 100).toFixed(1)}%` },
  ]
}

// ---------------------------------------------------------------------------
// Game logs (last 15) with per-game prop hit/miss dots
// ---------------------------------------------------------------------------

export interface LogColumn {
  key: string
  label: string
}

export interface LogCell {
  key: string
  text: string
  /** over = hit the over (red dot), under = missed (blue dot) */
  dot?: 'over' | 'under'
}

export interface LogRow {
  date: string
  opp: string
  home: boolean
  cells: LogCell[]
  /** full line for hover tooltip */
  line: string
}

export interface GameLogTable {
  columns: LogColumn[]
  rows: LogRow[]
}

const NHL_TEAMS = [
  'EDM', 'CGY', 'TOR', 'BOS', 'NYR', 'NJ', 'COL', 'DAL', 'TB', 'FLA',
  'WPG', 'MIN', 'VGK', 'VAN', 'PIT', 'WSH', 'DET', 'BUF', 'MTL', 'NSH',
  'NYI', 'PHI', 'CAR', 'SEA', 'LAK', 'STL', 'CHI', 'ANA', 'SJS', 'OTT', 'CBJ', 'UTA',
]

function opponents(p: AnyPlayer, rand: () => number, count: number): { opp: string; home: boolean }[] {
  const pool = (p.sport === 'mlb' ? MLB_TEAMS.map((t) => t.abbr) : NHL_TEAMS).filter((t) => t !== p.team)
  const start = Math.floor(rand() * pool.length)
  return Array.from({ length: count }, (_, i) => ({
    opp: pool[(start + i * 3 + Math.floor(rand() * 4)) % pool.length],
    home: rand() > 0.5,
  }))
}

function gameDates(rand: () => number, count: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < count; i++) {
    d.setDate(d.getDate() - (1 + Math.floor(rand() * 2)))
    out.push(d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }))
  }
  return out
}

function propLineFor(p: AnyPlayer, market: string, fallback: number): number {
  const prop = getPlayerProps(p.id).find((x) => x.market === market)
  return prop ? prop.line : fallback
}

export function gameLogs(p: AnyPlayer): GameLogTable {
  const rand = mulberry32(hashString(`${p.id}-logs`))
  const N = 15
  const dates = gameDates(rand, N)
  const opps = opponents(p, rand, N)

  if (p.kind === 'batter') {
    const kPct = clamp(0.34 - p.avg * 0.55 - p.iso * 0.1, 0.1, 0.32)
    const bbPct = clamp((p.obp - p.avg) * 0.9, 0.03, 0.18)
    const columns: LogColumn[] = [
      { key: 'ab', label: 'AB' }, { key: 'h', label: 'H' }, { key: 'xbh', label: 'XBH' },
      { key: 'tb', label: 'TB' }, { key: 'bb', label: 'BB' }, { key: 'k', label: 'K' },
    ]
    const rows: LogRow[] = dates.map((date, i) => {
      const ab = 3 + Math.floor(rand() * 2)
      const h = clamp(Math.round(ab * p.avg * (0.35 + rand() * 1.3)), 0, ab)
      const xbh = clamp(Math.round(h * (p.xbh / Math.max(0.3, p.avg * 3.6)) * (0.4 + rand() * 1.3)), 0, h)
      const tb = clamp(h + Math.round((p.tb / 2.4 - 0.4) * 1.6 * rand()), h, h + 3)
      const bb = rand() < bbPct * 4 ? 1 : 0
      const k = rand() < kPct * 3.5 ? (rand() < 0.2 ? 2 : 1) : 0
      const cells: LogCell[] = [
        { key: 'ab', text: `${ab}` },
        { key: 'h', text: `${h}` },
        { key: 'xbh', text: `${xbh}`, dot: xbh >= 1 ? 'over' : 'under' },
        { key: 'tb', text: `${tb}`, dot: tb >= 2 ? 'over' : 'under' },
        { key: 'bb', text: `${bb}` },
        { key: 'k', text: `${k}` },
      ]
      return { date, opp: opps[i].opp, home: opps[i].home, cells, line: `${h}-for-${ab} · ${xbh} XBH · ${tb} TB · ${bb} BB · ${k} K` }
    })
    return { columns, rows }
  }

  if (p.kind === 'pitcher') {
    const kLine = propLineFor(p, 'Strikeouts', 6.5)
    const columns: LogColumn[] = [
      { key: 'ip', label: 'IP' }, { key: 'h', label: 'H' }, { key: 'er', label: 'ER' },
      { key: 'bb', label: 'BB' }, { key: 'k', label: 'K' }, { key: 'np', label: 'NP' },
    ]
    const rows: LogRow[] = dates.map((date, i) => {
      const outs = 15 + Math.floor(rand() * 7)
      const ip = `${Math.floor(outs / 3)}.${outs % 3}`
      const bf = outs + 2 + Math.floor(rand() * 5)
      const k = clamp(Math.round(p.kPct * bf * (0.6 + rand() * 0.8)), 0, 14)
      const bb = clamp(Math.round(p.bbPct * bf * (0.5 + rand())), 0, 5)
      const h = clamp(Math.round((p.whip * outs) / 3 - bb + rand() * 2), 1, 11)
      const er = clamp(Math.round(((p.era * outs) / 27) * (0.4 + rand() * 1.4)), 0, 7)
      const np = 78 + Math.round(rand() * 28)
      const cells: LogCell[] = [
        { key: 'ip', text: ip },
        { key: 'h', text: `${h}` },
        { key: 'er', text: `${er}` },
        { key: 'bb', text: `${bb}` },
        { key: 'k', text: `${k}`, dot: k > kLine ? 'over' : 'under' },
        { key: 'np', text: `${np}` },
      ]
      return { date, opp: opps[i].opp, home: opps[i].home, cells, line: `${ip} IP · ${h} H · ${er} ER · ${bb} BB · ${k} K · ${np} pitches` }
    })
    return { columns, rows }
  }

  if (p.kind === 'goalie') {
    const svLine = propLineFor(p, 'Saves', 28.5)
    const columns: LogColumn[] = [
      { key: 'sa', label: 'SA' }, { key: 'sv', label: 'SV' }, { key: 'ga', label: 'GA' },
      { key: 'svp', label: 'SV%' },
    ]
    const rows: LogRow[] = dates.map((date, i) => {
      const sa = 24 + Math.round(rand() * 12)
      const ga = clamp(Math.round((1 - p.svPct) * sa * (0.4 + rand() * 1.4)), 0, 6)
      const sv = sa - ga
      const svp = sv / sa
      const cells: LogCell[] = [
        { key: 'sa', text: `${sa}` },
        { key: 'sv', text: `${sv}`, dot: sv > svLine ? 'over' : 'under' },
        { key: 'ga', text: `${ga}` },
        { key: 'svp', text: fmt3(svp) },
      ]
      return { date, opp: opps[i].opp, home: opps[i].home, cells, line: `${sv} saves on ${sa} shots (${fmt3(svp)})` }
    })
    return { columns, rows }
  }

  const sogLine = propLineFor(p, 'SOG', 3.5)
  const columns: LogColumn[] = [
    { key: 'sog', label: 'SOG' }, { key: 'g', label: 'G' }, { key: 'a', label: 'A' },
    { key: 'pts', label: 'PTS' }, { key: 'toi', label: 'TOI' },
  ]
  const rows: LogRow[] = dates.map((date, i) => {
    const sog = clamp(Math.round(p.sog * (0.5 + rand() * 1.1)), 0, 9)
    const g = rand() < p.goals ? (rand() < 0.12 ? 2 : 1) : 0
    const a = clamp(Math.round(Math.max(0.1, p.points - p.goals) * (0.3 + rand() * 1.4)), 0, 3)
    const pts = g + a
    const toiM = 15 + Math.floor(rand() * 8)
    const toiS = Math.floor(rand() * 60)
    const cells: LogCell[] = [
      { key: 'sog', text: `${sog}`, dot: sog > sogLine ? 'over' : 'under' },
      { key: 'g', text: `${g}` },
      { key: 'a', text: `${a}` },
      { key: 'pts', text: `${pts}`, dot: pts >= 2 ? 'over' : 'under' },
      { key: 'toi', text: `${toiM}:${`${toiS}`.padStart(2, '0')}` },
    ]
    return { date, opp: opps[i].opp, home: opps[i].home, cells, line: `${sog} SOG · ${g} G · ${a} A · ${toiM} min` }
  })
  return { columns, rows }
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
      { title: 'Day games', f: 0.9 + rand() * 0.2 },
      { title: 'Night games', f: 0.9 + rand() * 0.2 },
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
      { title: '1st time through', f: 0.75 + rand() * 0.3 },
      { title: '3rd time through', f: 1.0 + rand() * 0.35 },
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
      { title: 'vs Top-10', f: 1 + (rand() - 0.5) * 0.035 },
      { title: 'vs Bottom-10', f: 1 + (rand() - 0.5) * 0.035 },
      { title: '2+ days rest', f: 1 + (rand() - 0.5) * 0.03 },
      { title: 'Back-to-back', f: 1 + (rand() - 0.5) * 0.04 },
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
    { title: 'vs Top-10', f: 0.7 + rand() * 0.5 },
    { title: 'vs Bottom-10', f: 0.85 + rand() * 0.5 },
    { title: 'vs Division', f: 0.8 + rand() * 0.4 },
    { title: 'vs Non-division', f: 0.8 + rand() * 0.4 },
  ]
  return defs.map((d) => ({
    title: d.title,
    value: (p.sog * d.f).toFixed(1),
    deltaPct: (d.f - 1) * 100,
    windows: NHL_KEYS.map((k) => deltaPct(jitterWin(p.windows[k].sog, d.f), p.sog)),
    windowLabels: ['60', '120', '180', '240'],
  }))
}

// ---------------------------------------------------------------------------
// Batted-ball / shot-profile trend series (15 games, rolling 10-game rate)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  game: number
  rate: number
  avg: number
  a: number
  b: number
  c: number
}

export interface TrendSeries {
  metric: string
  mixLabels: [string, string, string]
  points: TrendPoint[]
  seasonAvg: number
}

export function trendSeries(p: AnyPlayer): TrendSeries {
  const rand = mulberry32(hashString(`${p.id}-trend`))
  let metric: string
  let base: number
  let mix: [number, number, number]
  let mixLabels: [string, string, string]

  if (p.kind === 'batter') {
    metric = 'Hard-Hit%'
    base = clamp(28 + p.iso * 90, 25, 62)
    mix = [0.36, 0.32, 0.32]
    mixLabels = ['Pull%', 'Center%', 'Oppo%']
  } else if (p.kind === 'pitcher') {
    metric = 'Hard-Hit% allowed'
    base = clamp(30 + (p.xwoba - 0.27) * 130, 22, 52)
    mix = [0.34, 0.33, 0.33]
    mixLabels = ['Pull%', 'Center%', 'Oppo%']
  } else if (p.kind === 'goalie') {
    metric = 'Shots faced /60'
    base = clamp((p.xgAgainst ?? 2.9) * 10 + 2, 24, 40)
    mix = [0.36, 0.44, 0.2]
    mixLabels = ['Slot%', 'Perimeter%', 'Rush%']
  } else {
    metric = 'Shot attempts /60'
    base = clamp(p.sog * 3.2 + 4, 10, 24)
    mix = [0.38, 0.42, 0.2]
    mixLabels = ['Slot%', 'Perimeter%', 'Rush%']
  }

  const formTilt = p.kind === 'batter' || p.kind === 'skater'
    ? deltaPct(
        p.kind === 'batter' ? p.windows.L30.avg : p.windows.MIN60.sog,
        p.kind === 'batter' ? p.avg : p.sog,
      ) * 0.12
    : 0

  const raw: number[] = Array.from({ length: 15 }, (_, i) =>
    clamp(base + (i / 15) * formTilt + (rand() - 0.5) * 12, 4, 92),
  )
  const seasonAvg = +(raw.reduce((s, v) => s + v, 0) / raw.length).toFixed(1)

  const points: TrendPoint[] = raw.map((rate, i) => {
    const pa = clamp(mix[0] + (rand() - 0.5) * 0.08, 0.12, 0.7)
    const pb = clamp(mix[1] + (rand() - 0.5) * 0.08, 0.12, 0.7)
    const pc = Math.max(0.08, 1 - pa - pb)
    const sum = pa + pb + pc
    return {
      game: i + 1,
      rate: +rate.toFixed(1),
      avg: seasonAvg,
      a: +(pa / sum).toFixed(3),
      b: +(pb / sum).toFixed(3),
      c: +(pc / sum).toFixed(3),
    }
  })

  return { metric, mixLabels, points, seasonAvg }
}

// ---------------------------------------------------------------------------
// Similar profiles (right rail)
// ---------------------------------------------------------------------------

export interface SimilarPlayer {
  id: string
  name: string
  team: string
  pos: string
  sport: 'mlb' | 'nhl'
}

export function similarPlayers(p: AnyPlayer): SimilarPlayer[] {
  const pool: AnyPlayer[] =
    p.kind === 'batter' ? BATTERS : p.kind === 'pitcher' ? PITCHERS : p.kind === 'goalie' ? GOALIES : SKATERS
  const idx = pool.findIndex((x) => x.id === p.id)
  const out: SimilarPlayer[] = []
  for (let i = 1; i <= 3 && pool.length > 1; i++) {
    const q = pool[(idx + i * 7) % pool.length]
    if (q.id !== p.id && !out.some((o) => o.id === q.id)) {
      out.push({ id: q.id, name: q.name, team: q.team, pos: posLabel(q), sport: q.sport })
    }
  }
  return out
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
