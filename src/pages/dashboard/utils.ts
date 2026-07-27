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
// Split (platoon) lookup — REAL Statcast splits only.
//
// Source: sv_stat_cache, attached to each pitcher as `p.splits` by
// api/loaders.ts:74-93. Split rows carry k_pct / bb_pct (0-100 scale) plus the
// Statcast rate stats. They do NOT carry ERA, WHIP, FIP or any counting stat —
// see api/supabase/savant.ts:9-42. Those columns therefore have no split
// source and must render as unavailable rather than being approximated.
//
// There is also no window x split cross-section (sv splits are season-level),
// so rolling-window cells are unavailable while a split filter is active.
// ---------------------------------------------------------------------------

export type SplitKey = 'vs-lhb' | 'vs-rhb' | 'home' | 'away'

/** UI split key -> sv_stat_cache split key. */
const SV_SPLIT: Record<SplitKey, 'vsL' | 'vsR' | 'home' | 'away'> = {
  'vs-lhb': 'vsL',
  'vs-rhb': 'vsR',
  home: 'home',
  away: 'away',
}

/** Stats that exist in sv_stat_cache split rows. Everything else is unavailable. */
export const SPLITTABLE_STATS = ['kPct', 'bbPct', 'xwoba'] as const
export type SplittableStat = (typeof SPLITTABLE_STATS)[number]

export function isSplittable(stat: string): stat is SplittableStat {
  return (SPLITTABLE_STATS as readonly string[]).includes(stat)
}

/**
 * Season-level value for a pitcher stat under an optional split.
 *
 * - no split active            -> the real season value
 * - split active, stat sourced -> the real sv split value (scale-normalised)
 * - split active, no source    -> null (caller renders an em-dash)
 *
 * Never approximates. Returns null rather than inventing a number.
 */
export function splitStat(
  p: Pitcher,
  split: SplitKey | undefined,
  stat: 'era' | 'whip' | 'kPct' | 'bbPct' | 'xwoba',
): number | null {
  if (!split) return p[stat] ?? null
  if (!isSplittable(stat)) return null // ERA / WHIP have no split source
  const line = p.splits?.[SV_SPLIT[split]]
  if (!line) return null // pitcher not covered by Statcast for this split
  if (stat === 'xwoba') return line.xwoba ?? null
  // sv k_pct / bb_pct are 0-100; legacy season/window values are 0-1.
  const raw = stat === 'kPct' ? line.kPct : line.bbPct
  return raw == null ? null : raw / 100
}

/** Sample size (TBF) behind a split line, for the "over N BF" affordance. */
export function splitSample(p: Pitcher, split: SplitKey | undefined): number | null {
  if (!split) return null
  return p.splits?.[SV_SPLIT[split]]?.pa ?? null
}

/**
 * Rolling-window value under an optional split.
 * sv has no window x split cross-section, so any active split makes every
 * window cell unavailable.
 */
export function splitWindowStat(
  p: Pitcher,
  window: MlbWindowKey,
  split: SplitKey | undefined,
  stat: 'era' | 'whip' | 'kPct' | 'bbPct' | 'xwoba',
): number | null {
  if (split) return null
  return p.windows[window][stat] ?? null
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
// Bullpen — real team reliever aggregates only.
//
// Source: api/ingest/mlb.ts:251-260 writes a real per-team bullpen line
// (era, whip, kPct, bbPct, relievers) aggregated from actual reliever game
// logs, surfaced through slate.bullpens -> getLiveBullpen().
//
// Everything else this module used to return was invented:
//   - WHIP fallback         `0.92 + era * 0.095`
//   - K% fallback           `0.272 - (era-3.4)*0.024 + jitter`
//   - LEV% (leverage)       `34 + rand01(seed+1) * 22`      — no source exists
//   - fatigue pitch count   `72 + rand01(seed+2) * 74`      — no source exists
//   - L7 / L14 / L30 ERA    `era * (1 + (rand01-0.5)*2*j)`  — no date buckets
//   - named reliever slots  Closer/Setup/7th/Long, ERA + K% from one seed
// All removed. Date-bucketed bullpen windows are buildable from game_logs and
// are Phase 2 work; until then the columns are absent rather than guessed.
// ---------------------------------------------------------------------------

/**
 * Seed abbreviations use the classic style (ARI); the warehouse and statsapi
 * use MLBAM style (AZ). One team differs — without this alias the Diamondbacks
 * would always miss their real bullpen row and silently show nothing.
 */
const BULLPEN_ABBR_ALIAS: Record<string, string> = { ARI: 'AZ' }

export interface BullpenRow {
  team: MlbTeam
  /** null => no ingested bullpen row for this team; render an em-dash. */
  era: number | null
  whip: number | null
  kPct: number | null
  bbPct: number | null
  /** Distinct relievers behind the aggregate — the sample-size affordance. */
  relievers: number | null
}

export function getBullpenRows(): BullpenRow[] {
  return MLB_TEAMS.map((team) => {
    const live =
      getLiveBullpen(team.abbr) ??
      (BULLPEN_ABBR_ALIAS[team.abbr] ? getLiveBullpen(BULLPEN_ABBR_ALIAS[team.abbr]) : undefined)
    return {
      team,
      era: live?.era ?? null,
      whip: live?.whip ?? null,
      kPct: live?.kPct ?? null,
      bbPct: live?.bbPct ?? null,
      relievers: live?.relievers ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Window subset helper (Window filter)
// ---------------------------------------------------------------------------

export function windowSubset(filter: string | undefined): MlbWindowKey[] {
  if (filter && (MLB_WINDOW_KEYS as string[]).includes(filter)) return [filter as MlbWindowKey]
  return [...MLB_WINDOW_KEYS]
}
