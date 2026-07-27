// Prizm LIVE data — prop lines + prices per market, with L5/L10/L20 hit rates,
// loaded from the tRPC API (props.list) and hydrated into the PROPS array by
// src/data/live.ts (see LiveDataProvider). Before hydration it is empty;
// AppShell blocks the authed app behind the provider's loading state.
// priceAlert = the price looks wrong vs recent hit rates (the "Zap" flag in UI).
// MLB odds are REAL aggregated book lines (sv_odds); NHL rows stay flat -115
// (no odds feed). Informational only — Prizm is not a sportsbook.

export type PropMarket =
  | 'XBH'
  | 'Total Bases'
  | 'Strikeouts'
  | 'Hits'
  | 'SOG'
  | 'Saves'
  | 'Goals'
  | 'Points'
  // sv_odds markets (MLB)
  | 'Hits Allowed'
  | 'Outs'
  | 'Home Runs'
  | 'Singles'
  | 'Doubles'
  | 'RBIs'
  | 'Runs'
  | 'Walks'
  | 'Stolen Bases'
  | 'Hits + Runs + RBIs'

export const MLB_MARKETS: PropMarket[] = ['XBH', 'Total Bases', 'Strikeouts', 'Hits']
export const NHL_MARKETS: PropMarket[] = ['SOG', 'Saves', 'Goals', 'Points']
export const ALL_MARKETS: PropMarket[] = [...MLB_MARKETS, ...NHL_MARKETS]

export type HitWindow = 'L5' | 'L10' | 'L20'
export const HIT_WINDOWS: HitWindow[] = ['L5', 'L10', 'L20']

export interface PropLine {
  id: string
  sport: 'mlb' | 'nhl'
  playerId: string
  player: string
  team: string
  opponent: string
  market: PropMarket
  line: number
  overPrice: number // American odds — best over price for MLB (sv_odds); flat -115 for NHL
  underPrice: number
  hitRates: Record<HitWindow, number> // 0–1 over hit rate
  priceAlert?: boolean
  edgeScore?: number // 0–100 Prizm edge score
  gameId: string
  // ── real-odds fields (sv_odds, MLB only) ──
  svPropType?: string // raw sv_odds prop_type, e.g. 'strikeouts thrown'
  overBook?: string | null // best over book
  underBook?: string | null // best under book
  consOver?: number | null // consensus over price (American)
  consUnder?: number | null // consensus under price (American)
  books?: number | null // number of books in consensus
  pulledAt?: string // sv_odds pulled_at (ISO)
  oddsSource?: 'sv_odds' | 'flat'
}

/** Populated by hydrateLiveData() at AppShell mount. */
export const PROPS: PropLine[] = []

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export interface PropFilters {
  sport?: 'mlb' | 'nhl'
  market?: PropMarket
  team?: string
  alertsOnly?: boolean
  minEdge?: number
}

export function getProps(filters: PropFilters = {}): PropLine[] {
  return PROPS.filter(
    (p) =>
      (!filters.sport || p.sport === filters.sport) &&
      (!filters.market || p.market === filters.market) &&
      (!filters.team || p.team === filters.team) &&
      (!filters.alertsOnly || p.priceAlert) &&
      (filters.minEdge === undefined || (p.edgeScore ?? 0) >= filters.minEdge),
  )
}

/** Hit rates for one market — the Hit Rates scanner's primary feed. */
export function getHitRates(market: PropMarket): PropLine[] {
  return getProps({ market }).sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0))
}

export function getPlayerProps(playerId: string): PropLine[] {
  return PROPS.filter((p) => p.playerId === playerId)
}

export function getGameProps(gameId: string): PropLine[] {
  return PROPS.filter((p) => p.gameId === gameId)
}

export function getAlerts(): PropLine[] {
  return getProps({ alertsOnly: true })
}

export function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`
}

/** True when the row carries real aggregated book odds (MLB sv_odds). */
export function hasRealOdds(p: PropLine): boolean {
  return p.oddsSource === 'sv_odds'
}

/** Consensus over price when available, else the listed over price. */
export function consensusOver(p: PropLine): number {
  return p.consOver ?? p.overPrice
}

/** Consensus under price when available, else the listed under price. */
export function consensusUnder(p: PropLine): number {
  return p.consUnder ?? p.underPrice
}

/**
 * Best-book tag for the over side, e.g. "+108 Novig" — null when there is no
 * per-book price or it merely matches the consensus.
 */
export function bestOverTag(p: PropLine): string | null {
  if (!hasRealOdds(p) || !p.overBook) return null
  return `${formatOdds(p.overPrice)} ${p.overBook}`
}

/** Best-book tag for the under side. */
export function bestUnderTag(p: PropLine): string | null {
  if (!hasRealOdds(p) || !p.underBook) return null
  return `${formatOdds(p.underPrice)} ${p.underBook}`
}
