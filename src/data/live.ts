// Live data bridge — module-level cache hydrated ONCE by LiveDataProvider
// (src/providers/LiveDataProvider.tsx) from the tRPC API. The src/data/*
// modules keep their original exported arrays + synchronous getters; this
// module replaces the array CONTENTS in place so every existing consumer
// (pages, drawers, angle snapshot builders) reads live data with zero changes.

import type { Batter, Pitcher } from './mlbPlayers'
import { BATTERS, PITCHERS } from './mlbPlayers'
import type { Goalie, Skater } from './nhlPlayers'
import { GOALIES, SKATERS } from './nhlPlayers'
import type { PropLine } from './props'
import { PROPS } from './props'
import type { SlateGame } from './slate'
import { MLB_SLATE, NHL_SLATE, TODAYS_SLATE } from './slate'

/** MLB team bullpen stats (mirrors contracts/prizm.ts BullpenStats). */
export interface BullpenStats {
  team: string
  relievers: number
  era: number
  whip: number
  kPct: number
  bbPct: number
}

export interface LiveDatasets {
  pitchers: Pitcher[]
  batters: Batter[]
  goalies: Goalie[]
  skaters: Skater[]
  slate: SlateGame[]
  props: PropLine[]
  bullpens: BullpenStats[]
}

let hydrated = false
let bullpenStats: BullpenStats[] = []
const listeners = new Set<() => void>()

/** True once the initial tRPC load has populated the data modules. */
export function isLiveDataHydrated(): boolean {
  return hydrated
}

/** Live bullpen stats keyed by team abbr (empty before hydration). */
export function getLiveBullpens(): BullpenStats[] {
  return bullpenStats
}

export function getLiveBullpen(team: string): BullpenStats | undefined {
  return bullpenStats.find((b) => b.team === team)
}

function replaceContents<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

/** Notified after every hydration (AppShell freshness chip, tests). */
export function onLiveDataHydrated(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Swap the seed arrays' contents for live API data. Idempotent — safe to call
 * again on refetch; array identities are preserved so import-time references
 * keep working.
 */
export function hydrateLiveData(datasets: LiveDatasets) {
  replaceContents(PITCHERS, datasets.pitchers)
  replaceContents(BATTERS, datasets.batters)
  replaceContents(GOALIES, datasets.goalies)
  replaceContents(SKATERS, datasets.skaters)
  replaceContents(MLB_SLATE, datasets.slate.filter((g) => g.sport === 'mlb'))
  replaceContents(NHL_SLATE, datasets.slate.filter((g) => g.sport === 'nhl'))
  replaceContents(TODAYS_SLATE, datasets.slate)
  replaceContents(PROPS, datasets.props)
  bullpenStats = datasets.bullpens
  hydrated = true
  listeners.forEach((cb) => cb())
}
