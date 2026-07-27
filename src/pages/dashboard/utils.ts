// Dashboard-local data helpers: slate starters, platoon adjustments, edge
// scores and bullpen derivations. All deterministic so numbers are stable
// across reloads (mirrors the src/data seed approach).

import type { MlbWindowKey, Pitcher } from '@/data/mlbPlayers'
import { getPitcher, MLB_WINDOW_KEYS } from '@/data/mlbPlayers'
import type { MlbTeam } from '@/data/mlbTeams'
import { MLB_TEAMS } from '@/data/mlbTeams'
import type { SlateGame } from '@/data/slate'
import { MLB_SLATE } from '@/data/slate'
import { getLiveBullpen } from '@/data/live'
import { deltaPct } from '@/lib/heat'

// ---------------------------------------------------------------------------
// Deterministic hashing
// ---------------------------------------------------------------------------

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Single deterministic pseudo-random in [0,1) from a numeric seed. */
export function rand01(seed: number): number {
  let a = seed >>> 0
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const fmtEra = (v: number) => v.toFixed(2)
export const fmtWhip = (v: number) => v.toFixed(2)
export const fmtPct = (v: number) => (v * 100).toFixed(1)
export const fmtXwoba = (v: number) => v.toFixed(3).replace(/^0/, '')
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, '')
export const fmtPerGame = (v: number) => v.toFixed(2)

// ---------------------------------------------------------------------------
// Today's starters (from the slate)
// ---------------------------------------------------------------------------

export interface StarterEntry {
  pitcher: Pitcher
  game: SlateGame
  opp: string
  homeAway: 'Home' | 'Away'
}

export function getStarters(): StarterEntry[] {
  const out: StarterEntry[] = []
  for (const g of MLB_SLATE) {
    if (g.awayProbableId) {
      const p = getPitcher(g.awayProbableId)
      if (p) out.push({ pitcher: p, game: g, opp: g.home, homeAway: 'Away' })
    }
    if (g.homeProbableId) {
      const p = getPitcher(g.homeProbableId)
      if (p) out.push({ pitcher: p, game: g, opp: g.away, homeAway: 'Home' })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Split (platoon) adjustment — simulated vs LHB / vs RHB / Home / Away factors
// ---------------------------------------------------------------------------

export type SplitKey = 'vs-lhb' | 'vs-rhb' | 'home' | 'away'

export function splitFactor(seed: string, split: SplitKey | undefined, stat: string): number {
  if (!split) return 1
  const r = rand01(hashStr(`${seed}|${split}|${stat}`))
  return 0.94 + r * 0.12 // 0.94 – 1.06
}

// ---------------------------------------------------------------------------
// Edge score (0–100 composite, deterministic)
// ---------------------------------------------------------------------------

export function edgeScore(p: Pitcher): number {
  let sum = 0
  let n = 0
  for (const w of MLB_WINDOW_KEYS) {
    const win = p.windows[w]
    sum += deltaPct(win.kPct, p.kPct) - deltaPct(win.era, p.era)
    n += 2
  }
  const score = 50 + (sum / n) * 1.6
  return Math.max(2, Math.min(98, Math.round(score)))
}

// ---------------------------------------------------------------------------
// Bullpen derivations (seed data only ships team.bullpenEra)
// ---------------------------------------------------------------------------

export type BullpenWindowKey = 'L7' | 'L14' | 'L30'
export const BULLPEN_WINDOWS: { key: BullpenWindowKey; label: string }[] = [
  { key: 'L7', label: 'L7 days' },
  { key: 'L14', label: 'L14 days' },
  { key: 'L30', label: 'L30 days' },
]

export interface BullpenRow {
  team: MlbTeam
  era: number
  whip: number
  kPct: number
  leverage: number // high-leverage usage %
  fatiguePitches: number // 3-day pitch count
  fatigue: 'Fresh' | 'Normal' | 'Heavy'
  windows: Record<BullpenWindowKey, { era: number; kPct: number }>
}

export function getBullpenRows(): BullpenRow[] {
  return MLB_TEAMS.map((team) => {
    const seed = hashStr(`bp|${team.abbr}`)
    // Prefer live bullpen stats (slate.bullpens → reliever game logs); fall
    // back to the team table line for teams without an ingested row.
    const live = getLiveBullpen(team.abbr)
    const era = live?.era ?? team.bullpenEra
    const whip = live?.whip ?? +(0.92 + era * 0.095).toFixed(2)
    const kPct =
      live?.kPct ??
      +Math.min(
        0.29,
        Math.max(0.19, 0.272 - (era - 3.4) * 0.024 + (rand01(seed) - 0.5) * 0.02),
      ).toFixed(3)
    const leverage = Math.round(34 + rand01(seed + 1) * 22)
    const fatiguePitches = Math.round(72 + rand01(seed + 2) * 74)
    const fatigue: BullpenRow['fatigue'] =
      fatiguePitches < 95 ? 'Fresh' : fatiguePitches < 118 ? 'Normal' : 'Heavy'
    const windows = {} as BullpenRow['windows']
    const jitter: Record<BullpenWindowKey, number> = { L7: 0.16, L14: 0.11, L30: 0.07 }
    for (const key of ['L7', 'L14', 'L30'] as BullpenWindowKey[]) {
      const r = rand01(seed + 10 + key.length * 7 + key.charCodeAt(1))
      const skew = 1 + (r - 0.5) * 2 * jitter[key]
      windows[key] = {
        era: +Math.max(1.4, era * skew).toFixed(2),
        kPct: +Math.min(0.32, Math.max(0.16, kPct * (1 + (skew - 1) * 0.7))).toFixed(3),
      }
    }
    return { team, era, whip, kPct, leverage, fatiguePitches, fatigue, windows }
  })
}

export interface RelieverSlot {
  role: string
  era: number
  kPct: number
}

/** Top-4 bullpen arms by role slot, derived from the team's season line. */
export function getRelievers(team: MlbTeam): RelieverSlot[] {
  const seed = hashStr(`rp|${team.abbr}`)
  const bullpenEra = getLiveBullpen(team.abbr)?.era ?? team.bullpenEra
  const roles = ['Closer', 'Setup', '7th inning', 'Long relief']
  return roles.map((role, i) => {
    const r = rand01(seed + i * 13)
    const era = +Math.max(1.2, bullpenEra - 0.55 + i * 0.34 + (r - 0.5) * 0.5).toFixed(2)
    const kPct = +Math.min(
      0.34,
      Math.max(0.16, 0.285 - i * 0.024 - (bullpenEra - 3.6) * 0.02 + (r - 0.5) * 0.03),
    ).toFixed(3)
    return { role, era, kPct }
  })
}

// ---------------------------------------------------------------------------
// Window subset helper (Window filter)
// ---------------------------------------------------------------------------

export function windowSubset(filter: string | undefined): MlbWindowKey[] {
  if (filter && (MLB_WINDOW_KEYS as string[]).includes(filter)) return [filter as MlbWindowKey]
  return [...MLB_WINDOW_KEYS]
}
