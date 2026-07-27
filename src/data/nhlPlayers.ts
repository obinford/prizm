// Prizm LIVE data — real NHL players with rolling windows, loaded from the
// tRPC API (players.goalies / players.skaters) and hydrated into these arrays
// by src/data/live.ts (see LiveDataProvider). Before hydration they are empty;
// AppShell blocks the authed app behind the provider's loading state.
// Windows: 60 / 120 / 180 / 240 minutes of TOI (≈ 1–4 games of form).
// Goalies: SV%, GSAx (goals saved above expected), xG faced per 60.
// GSAx / xgAgainst can be NULL (no public xG feed) — consumers must skip or
// dash-out null heat cells honestly rather than fabricating numbers.
// Skaters: SOG/game, goals/game, points/game.

export type NhlWindowKey = 'MIN60' | 'MIN120' | 'MIN180' | 'MIN240'
export const NHL_WINDOW_KEYS: NhlWindowKey[] = ['MIN60', 'MIN120', 'MIN180', 'MIN240']
export const NHL_WINDOW_LABELS: Record<NhlWindowKey, string> = {
  MIN60: '60 MIN',
  MIN120: '120 MIN',
  MIN180: '180 MIN',
  MIN240: '240 MIN',
}

export interface GoalieWindow {
  toi: number // minutes
  svPct: number
  gsax: number | null // goals saved above expected in window (null: no public xG feed)
  xgAgainst: number | null // xG faced per 60 in window (null: no public xG feed)
}

export interface Goalie {
  id: string
  sport: 'nhl'
  kind: 'goalie'
  name: string
  team: string
  catches: 'L' | 'R'
  svPct: number
  gsax: number | null // season total per 60
  xgAgainst: number | null // xG faced per 60, season
  windows: Record<NhlWindowKey, GoalieWindow>
}

export interface SkaterWindow {
  toi: number
  sog: number // shots per game
  goals: number // per game
  points: number // per game
}

export interface Skater {
  id: string
  sport: 'nhl'
  kind: 'skater'
  name: string
  team: string
  pos: 'C' | 'LW' | 'RW' | 'D'
  shoots: 'L' | 'R'
  sog: number
  goals: number
  points: number
  windows: Record<NhlWindowKey, SkaterWindow>
}

// ---------------------------------------------------------------------------
// Assembled data — populated by hydrateLiveData() at AppShell mount
// ---------------------------------------------------------------------------

export const GOALIES: Goalie[] = []

export const SKATERS: Skater[] = []

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export interface NhlFilters {
  team?: string
  pos?: Skater['pos']
  minSvPct?: number
  minSog?: number
}

export function getGoalies(filters: NhlFilters = {}): Goalie[] {
  return GOALIES.filter(
    (g) =>
      (!filters.team || g.team === filters.team) &&
      (filters.minSvPct === undefined || g.svPct >= filters.minSvPct),
  )
}

export function getSkaters(filters: NhlFilters = {}): Skater[] {
  return SKATERS.filter(
    (s) =>
      (!filters.team || s.team === filters.team) &&
      (!filters.pos || s.pos === filters.pos) &&
      (filters.minSog === undefined || s.sog >= filters.minSog),
  )
}

export function getGoalie(id: string): Goalie | undefined {
  return GOALIES.find((g) => g.id === id)
}

export function getSkater(id: string): Skater | undefined {
  return SKATERS.find((s) => s.id === id)
}

export function searchNhlPlayers(q: string): (Goalie | Skater)[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return [...GOALIES, ...SKATERS].filter(
    (p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase() === s,
  )
}
