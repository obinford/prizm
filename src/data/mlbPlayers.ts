// Prizm LIVE data — real MLB players with rolling windows, loaded from the
// tRPC API (players.pitchers / players.batters) and hydrated into these arrays
// by src/data/live.ts (see LiveDataProvider). Before hydration they are empty;
// AppShell blocks the authed app behind the provider's loading state, and
// marketing pages never read them.
// Windows: L30 / L60 / L90 / L120 (plate appearances for batters, batters faced for pitchers).
// Heat deltas are derivable: deltaPct = (window − season) / season (see src/lib/heat.ts).
//
// Step 9 — the player/window/split TYPE declarations that used to live here
// were a hand mirror of contracts/prizm.ts and drifted three times (the
// patch-4 extension the client never saw, the SavantSplitFields split, the
// Step 6 gamePk addition). They are deleted; the contract is the single
// declaration and this module re-exports it so no call site churns. The
// assignability guard is src/data/contractSync.test.ts.
// What remains here is client-only: assembled arrays, display labels,
// filters, and getters — concerns the API contract correctly does not have.
//
// SCALE (unchanged, from the contract comments): sv percent fields
// (barrelPct/hardHitPct/whiffPct/cswPct, and split-line kPct/bbPct) are
// 0–100 as served — unlike legacy kPct/bbPct on the season/window rows
// which are 0–1. Rate stats (xwobaReal/xba/xslg/woba/babip) are 0–1;
// avgEv is mph.

import type { MlbWindowKey } from '@contracts/prizm'

export type {
  MlbWindowKey,
  SavantSplitFields,
  SavantWindowFields,
  SavantSplitLine,
  SavantSplits,
  PitcherWindow,
  Pitcher,
  BatterWindow,
  Batter,
} from '@contracts/prizm'
export { MLB_WINDOW_KEYS } from '@contracts/prizm'

import type { Pitcher, Batter } from '@contracts/prizm'

export const MLB_WINDOW_LABELS: Record<MlbWindowKey, string> = {
  L30: 'L30 PA',
  L60: 'L60 PA',
  L90: 'L90 PA',
  L120: 'L120 PA',
}

// ---------------------------------------------------------------------------
// Assembled data — populated by hydrateLiveData() at AppShell mount
// ---------------------------------------------------------------------------

export const PITCHERS: Pitcher[] = []

export const BATTERS: Batter[] = []

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export interface PitcherFilters {
  team?: string
  throws?: 'L' | 'R'
  maxEra?: number
  minKPct?: number
}

export function getPitchers(filters: PitcherFilters = {}): Pitcher[] {
  return PITCHERS.filter(
    (p) =>
      (!filters.team || p.team === filters.team) &&
      (!filters.throws || p.throws === filters.throws) &&
      (filters.maxEra === undefined || p.era <= filters.maxEra) &&
      (filters.minKPct === undefined || p.kPct >= filters.minKPct),
  )
}

export interface BatterFilters {
  team?: string
  pos?: string
  bats?: 'L' | 'R' | 'S'
  minAvg?: number
  minIso?: number
}

export function getBatters(filters: BatterFilters = {}): Batter[] {
  return BATTERS.filter(
    (b) =>
      (!filters.team || b.team === filters.team) &&
      (!filters.pos || b.pos === filters.pos) &&
      (filters.bats === undefined || b.bats === filters.bats) &&
      (filters.minAvg === undefined || b.avg >= filters.minAvg) &&
      (filters.minIso === undefined || b.iso >= filters.minIso),
  )
}

export function getPitcher(id: string): Pitcher | undefined {
  return PITCHERS.find((p) => p.id === id)
}

export function getBatter(id: string): Batter | undefined {
  return BATTERS.find((b) => b.id === id)
}

export function getTeamBatters(team: string): Batter[] {
  return BATTERS.filter((b) => b.team === team)
}

export function searchMlbPlayers(q: string): (Pitcher | Batter)[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return [...PITCHERS, ...BATTERS].filter(
    (p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase() === s,
  )
}
