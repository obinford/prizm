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
  /** Real per-game values, most recent first (max 20). Absent when the row was
   *  not built from game logs — consumers must not synthesise a substitute. */
  recentValues?: number[]
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

/**
 * American odds -> implied probability (0-1), vig included.
 * NOTE: this is the RAW implied probability. It overstates true probability by
 * roughly half the hold. It is the correct raw conversion and the de-vig in
 * devig() is built on top of it — UI edges must never consume it directly;
 * route through edgePp().
 */
export function impliedProb(price: number): number {
  return price > 0 ? 100 / (price + 100) : -price / (-price + 100)
}

/**
 * Observed hit rate minus raw implied probability, in percentage points.
 * Returns null when the row has no real book odds, because an edge against an
 * invented flat price is not an edge.
 *
 * @deprecated The raw implied probability includes the book's hold, so every
 * edge computed from it is overstated by roughly half the vig. Kept for any
 * external caller; the UI routes through edgePp(), which de-vigs first.
 */
export function rawEdgePp(p: PropLine, window: 'L5' | 'L10' | 'L20' = 'L10'): number | null {
  if (!hasRealOdds(p)) return null
  const rate = p.hitRates[window]
  if (rate == null) return null
  return (rate - impliedProb(consensusOver(p))) * 100
}

/**
 * Two-sided de-vig (multiplicative / proportional method).
 *
 * A book's two prices imply probabilities that sum to more than 1. The excess
 * is the hold. Normalising both sides by their sum removes it:
 *
 *   pOverTrue = pOverRaw / (pOverRaw + pUnderRaw)
 *
 * ASSUMPTION, stated because it is a real modelling choice and not a fact:
 * this assumes the book applies its margin proportionally to both sides. It
 * does not fully correct favourite-longshot bias — books typically load more
 * margin onto longshots, so a heavy favourite's de-vigged probability here is
 * slightly understated and a longshot's slightly overstated. Shin and power
 * methods model that asymmetry; they need a parameter we have no basis to fit
 * yet. Multiplicative is the honest default and the industry baseline. Do not
 * silently swap in another method — it changes every number on the board.
 *
 * Returns null when either side is missing. A one-sided de-vig is not a
 * de-vig; it is the raw number wearing a better name.
 */
export function devig(overPrice: number | null, underPrice: number | null): {
  over: number
  under: number
  hold: number
} | null {
  if (overPrice == null || underPrice == null) return null
  const rawOver = impliedProb(overPrice)
  const rawUnder = impliedProb(underPrice)
  const sum = rawOver + rawUnder
  if (!Number.isFinite(sum) || sum <= 0) return null
  return { over: rawOver / sum, under: rawUnder / sum, hold: sum - 1 }
}

/** De-vigged consensus probabilities for a prop, or null if a side is missing. */
export function devigProp(p: PropLine) {
  if (!hasRealOdds(p)) return null
  return devig(p.consOver ?? null, p.consUnder ?? null)
}

/**
 * Edge in percentage points: observed hit rate minus the DE-VIGGED market
 * probability. Null when there are no real odds or no two-sided price.
 *
 * IMPORTANT — what this is and is not. This is a historical hit rate compared
 * against a fair market price. It is NOT a model probability. A 10-game hit
 * rate is a point estimate with enormous uncertainty: 7/10 and 70/100 both
 * read "70%", and only one of them is worth acting on. Never render this
 * number without its sample size next to it. See ciWilson below.
 */
export function edgePp(p: PropLine, window: HitWindow = 'L10'): number | null {
  const fair = devigProp(p)
  if (!fair) return null
  const rate = p.hitRates[window]
  if (rate == null) return null
  return (rate - fair.over) * 100
}

/** Games behind a hit-rate window. L5 → 5, L10 → 10, L20 → 20. */
export function windowN(window: HitWindow): number {
  return Number(String(window).replace(/\D/g, '')) || 0
}

/**
 * Wilson score interval for a hit rate — the honest error bar on a small
 * sample. The normal approximation breaks down at n=5 and at rates near 0
 * or 1, which is exactly where prop hit rates live; Wilson does not.
 *
 * z = 1.96 (95%). Returns [lo, hi] as 0–1 probabilities.
 */
export function ciWilson(rate: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1]
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = rate + z2 / (2 * n)
  const spread = z * Math.sqrt((rate * (1 - rate) + z2 / (4 * n)) / n)
  return [
    Math.max(0, (centre - spread) / denom),
    Math.min(1, (centre + spread) / denom),
  ]
}

/**
 * True when the edge survives its own uncertainty — the LOWER bound of the
 * hit-rate interval still clears the fair price. This is the difference
 * between "this looks good" and "this is defensible", and it is the single
 * most valuable thing on the Edgecenter.
 */
export function edgeSurvivesCI(p: PropLine, window: HitWindow = 'L10'): boolean | null {
  const fair = devigProp(p)
  const rate = p.hitRates[window]
  if (!fair || rate == null) return null
  const [lo] = ciWilson(rate, windowN(window))
  return lo > fair.over
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
