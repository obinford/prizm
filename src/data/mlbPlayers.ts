// Prizm LIVE data — real MLB players with rolling windows, loaded from the
// tRPC API (players.pitchers / players.batters) and hydrated into these arrays
// by src/data/live.ts (see LiveDataProvider). Before hydration they are empty;
// AppShell blocks the authed app behind the provider's loading state, and
// marketing pages never read them.
// Windows: L30 / L60 / L90 / L120 (plate appearances for batters, batters faced for pitchers).
// Heat deltas are derivable: deltaPct = (window − season) / season (see src/lib/heat.ts).

export type MlbWindowKey = 'L30' | 'L60' | 'L90' | 'L120'
export const MLB_WINDOW_KEYS: MlbWindowKey[] = ['L30', 'L60', 'L90', 'L120']
export const MLB_WINDOW_LABELS: Record<MlbWindowKey, string> = {
  L30: 'L30 PA',
  L60: 'L60 PA',
  L90: 'L90 PA',
  L120: 'L120 PA',
}

// ── Statcast warehouse (sv_*) additive fields ───────────────────────────────
// Mirrors contracts/prizm.ts SavantWindowFields. SCALE: sv percent fields
// (barrelPct/hardHitPct/whiffPct/cswPct, and split-line kPct/bbPct) are 0–100
// as served — unlike legacy kPct/bbPct on the season/window rows which are
// 0–1. Rate stats (xwobaReal/xba/xslg/woba/babip) are 0–1; avgEv is mph.

export interface SavantWindowFields {
  xwobaReal?: number | null // real Statcast xwOBA (`xwoba` mirrors it when covered)
  xba?: number | null
  xslg?: number | null
  barrelPct?: number | null // 0–100
  hardHitPct?: number | null // 0–100
  whiffPct?: number | null // 0–100
  cswPct?: number | null // 0–100
  avgEv?: number | null // mph
  woba?: number | null
  babip?: number | null
}

/** Split-chip line (vsL/vsR/home/away) from sv_stat_cache split rows. */
export interface SavantSplitLine extends SavantWindowFields {
  pa?: number | null
  kPct?: number | null // 0–100 (sv scale)
  bbPct?: number | null // 0–100 (sv scale)
  xwoba?: number | null // split rows serve the real xwOBA under `xwoba`
}

export interface SavantSplits {
  vsL?: SavantSplitLine
  vsR?: SavantSplitLine
  home?: SavantSplitLine
  away?: SavantSplitLine
}

export interface PitcherWindow extends SavantWindowFields {
  bf: number // batters faced in window
  era: number
  whip: number
  kPct: number
  bbPct: number
  xwoba: number // real Statcast xwOBA where sv coverage exists; else estimate
}

export interface Pitcher extends SavantWindowFields {
  id: string
  sport: 'mlb'
  kind: 'pitcher'
  name: string
  team: string
  throws: 'L' | 'R'
  role: 'SP' | 'RP'
  era: number
  whip: number
  kPct: number // 0–1
  bbPct: number // 0–1
  xwoba: number
  windows: Record<MlbWindowKey, PitcherWindow>
  /** sv-sourced split chips (vsL/vsR/home/away) — additive. */
  splits?: SavantSplits
}

export interface BatterWindow extends SavantWindowFields {
  pa: number
  avg: number
  obp: number
  slg: number
  iso: number
  xbh: number // extra-base hits per game in window
  tb: number // total bases per game in window
  xwoba?: number // sv-sourced only
}

export interface Batter extends SavantWindowFields {
  id: string
  sport: 'mlb'
  kind: 'batter'
  name: string
  team: string
  pos: string
  bats: 'L' | 'R' | 'S'
  avg: number
  obp: number
  slg: number
  iso: number
  xbh: number // per game
  tb: number // per game
  windows: Record<MlbWindowKey, BatterWindow>
  /** sv-sourced split chips (vsL/vsR/home/away) — additive. */
  splits?: SavantSplits
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
      (!filters.bats || b.bats === filters.bats) &&
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
