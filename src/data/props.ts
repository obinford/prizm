// Prizm LIVE data — prop lines + prices per market, with L5/L10/L20 hit rates,
// loaded from the tRPC API (props.list) and hydrated into the PROPS array by
// src/data/live.ts (see LiveDataProvider). Before hydration it is empty;
// AppShell blocks the authed app behind the provider's loading state.
// priceAlert = the price looks wrong vs recent hit rates (the "Zap" flag in UI).
// MLB odds are REAL aggregated book lines (sv_odds). XBH — the one market no
// book ever priced — is off the board entirely (FIX 14); NHL rows stay flat
// -115 (no odds feed). Informational only — Prizm is not a sportsbook.

import { getGame } from '@/data/slate'
import { getPitcher } from '@/data/mlbPlayers'

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

// Thirteen markets served by sv_odds with real two-sided consensus prices.
// Order matters: the array leads the scanner's market chips, so a real-odds
// market leads — Total Bases, the deepest sv_odds book (~1.4k rows).
//
// FIX 14 (2026-07-29): XBH is OUT — off the market chips and off the board
// (the api mysql fallback filters it at read time). sv_odds carries zero
// XBH rows and no book prices it, so every XBH row was a derived line
// dashing out price/fair/edge — a market that could never be acted on.
// The XBH STAT (batter column, angles text) stays; the 'XBH' PropMarket
// union member and DERIVED_MARKETS stay for that contract. It returns as a
// market only if a real book price ever exists for it.
export const MLB_MARKETS: PropMarket[] = [
  'Total Bases',
  'Strikeouts',
  'Hits',
  'Hits Allowed',
  'Outs',
  'Home Runs',
  'Singles',
  'Doubles',
  'RBIs',
  'Runs',
  'Walks',
  'Stolen Bases',
  'Hits + Runs + RBIs',
]

/** Markets no book prices — line and hit rate are Prizm-derived from game
 * logs. The UI must disclose this provenance wherever the market appears. */
export const DERIVED_MARKETS: ReadonlySet<PropMarket> = new Set<PropMarket>(['XBH'])
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
  overPrice: number // American odds — best over price for MLB (sv_odds); flat -115 only on the no-odds-feed path (explicit NHL ask / MLB fallback)
  underPrice: number
  hitRates: Record<HitWindow, number> // 0–1 over hit rate
  /** NULL whenever oddsSource !== 'sv_odds' (FIX 8) — never an alert on a
   *  price that does not exist. Treat null as "no signal". */
  priceAlert?: boolean | null
  /** NULL whenever oddsSource !== 'sv_odds' (FIX 8) — never an edge computed
   *  against an invented -115. Treat null as "no signal", not a low score. */
  edgeScore?: number | null
  gameId: string
  // ── real-odds fields (sv_odds, MLB only) ──
  oddsDate?: string // sv_odds game_date these prices are for (YYYY-MM-DD) — drives the stale-board warning
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
 * Minimum books behind a consensus price for the de-vig to mean anything.
 * A "consensus" of two books is one book and its correlated twin.
 */
export const MIN_CONSENSUS_BOOKS = 4

/**
 * Maximum hold at which the two prices still describe a coherent market.
 * Above this the pair is stale, one-sided, or a posting error — normalising
 * it produces a "fair" probability that is not fair.
 */
export const MAX_CREDIBLE_HOLD = 0.15

/**
 * Whether a row's odds are good enough to price an edge against.
 *
 * MEASURED, not assumed. Across today's 1,772 two-sided sv_odds rows the hold
 * runs 0.50% to 54.81%, mean 7.85%. The 23 rows above 15% hold average **2.7
 * books**; every other row averages **12.1**. Extreme hold is not a market
 * condition here, it is a symptom of thin book coverage.
 *
 * This matters more than it looks. A distorted fair price is exactly what
 * makes a hit rate appear to beat the market, so without this gate the rows
 * with the WORST data produce the BIGGEST apparent edges and sort straight to
 * the top of the board. That is the classic failure mode of every +EV screen.
 */
export function edgeQuality(p: PropLine): { ok: boolean; reason?: string } {
  const fair = devigProp(p)
  if (!fair) return { ok: false, reason: 'No two-sided consensus price — cannot de-vig.' }
  if (p.books != null && p.books < MIN_CONSENSUS_BOOKS) {
    return {
      ok: false,
      reason: `Only ${p.books} book${p.books === 1 ? '' : 's'} behind this price — too thin to call a consensus (need ${MIN_CONSENSUS_BOOKS}).`,
    }
  }
  if (fair.hold > MAX_CREDIBLE_HOLD) {
    return {
      ok: false,
      reason: `${(fair.hold * 100).toFixed(1)}% hold — not a coherent two-sided market, so the de-vigged price is not trustworthy.`,
    }
  }
  return { ok: true }
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
  if (!edgeQuality(p).ok) return false
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

// ---------------------------------------------------------------------------
// Side-aware helpers (over / under)
// ---------------------------------------------------------------------------

export type PropSide = 'over' | 'under'

/**
 * Hit rate for ONE side of a prop in a window.
 *
 * Over rates come from the server (hitRates). Under rates are derived here:
 *
 * - When recentValues is present, the under rate is computed from the SAME
 *   per-game values and the SAME slice/denominator as the server's over rate
 *   (propsRouter buildMlbProp: `v > line` over values.slice(0, n)). A push is
 *   neither an over nor an under hit, so `v < line` is exact — it does not
 *   assume over + under = 1.
 * - When recentValues is absent (NHL flat rows), the only honest option is
 *   the complement 1 − over, which treats pushes as under misses. Exact for
 *   half-lines, approximate for integer lines — flagged `approx` so the UI
 *   can say so rather than present it as measured.
 */
export function sideRate(
  p: PropLine,
  window: HitWindow,
  side: PropSide,
): { rate: number; approx: boolean } {
  if (side === 'over') return { rate: p.hitRates[window], approx: false }
  const vals = p.recentValues
  if (vals && vals.length > 0) {
    const slice = vals.slice(0, windowN(window))
    if (slice.length > 0) {
      return { rate: slice.filter((v) => v < p.line).length / slice.length, approx: false }
    }
  }
  return { rate: 1 - p.hitRates[window], approx: true }
}

/**
 * Edge in percentage points for one side: observed side hit rate minus the
 * DE-VIGGED market probability for that side. Same caveat as edgePp() — a
 * historical hit rate against a fair price, not a model probability; never
 * render it without its sample size nearby.
 */
export function sideEdgePp(p: PropLine, window: HitWindow, side: PropSide): number | null {
  const fair = devigProp(p)
  if (!fair) return null
  const { rate } = sideRate(p, window, side)
  return (rate - (side === 'over' ? fair.over : fair.under)) * 100
}

/**
 * Hand of the opposing probable pitcher ('L' | 'R'), or null when the game or
 * the probable is unknown. Side detection uses the opponent tag written by
 * propsRouter ("vs X" = the prop player's team is home, "@" = away) rather
 * than matching team abbreviations, which differ between feeds.
 */
export function opposingPitcherHand(p: PropLine): 'L' | 'R' | null {
  if (p.sport !== 'mlb' || !p.gameId) return null
  const game = getGame(p.gameId)
  if (!game) return null
  const oppId = p.opponent.startsWith('vs') ? game.awayProbableId : game.homeProbableId
  if (!oppId) return null
  return getPitcher(oppId)?.throws ?? null
}
