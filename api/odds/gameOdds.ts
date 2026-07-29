// The Odds API v4 — GAME ODDS ONLY (h2h / spreads / totals), per FIX 19.
//
// Hard rules baked in here:
//   - Never player props. sv_odds prop coverage is strictly better, and
//     event-level props pulls cost ~30x quota. If a props use case ever
//     appears, it is a report, not a build.
//   - The key lives server-side only (env.oddsApiKey), travels in the query
//     string (the provider's only auth mechanism), and is NEVER logged —
//     log lines below carry quota headers and counts, never the URL.
//   - No key / 429 / provider error => degraded state and null-dashes.
//     No invented prices, ever (same rule as the flat -115 prop ban).
//   - Cost discipline: one call = markets(3) x regions(1) = 3 credits.
//     4h cache => ~6 refreshes/day => ~18 credits/day => ~540/month.
//     Historical endpoints (10x cost) are not used.

import { env } from "../lib/env";
import type { SlateGame } from "@contracts/types";

export const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
const MARKETS = ["h2h", "spreads", "totals"] as const;
const CACHE_TTL_MS = 4 * 60 * 60_000; // 4h — see header for the quota math

/**
 * The Odds API full display name → Prizm/MLBAM abbreviation. EXPLICIT map
 * for all 30 clubs — no fuzzy matching anywhere in the join. "Athletics"
 * is the current display name (Sacramento); "Oakland Athletics" is kept as
 * a legacy alias for the same club so a stale provider string still joins.
 */
export const ODDS_NAME_TO_ABBR: Record<string, string> = {
  "Arizona Diamondbacks": "AZ",
  "Athletics": "ATH",
  "Oakland Athletics": "ATH",
  "Atlanta Braves": "ATL",
  "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS",
  "Chicago Cubs": "CHC",
  "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN",
  "Cleveland Guardians": "CLE",
  "Colorado Rockies": "COL",
  "Detroit Tigers": "DET",
  "Houston Astros": "HOU",
  "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA",
  "Los Angeles Dodgers": "LAD",
  "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL",
  "Minnesota Twins": "MIN",
  "New York Mets": "NYM",
  "New York Yankees": "NYY",
  "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT",
  "San Diego Padres": "SD",
  "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA",
  "St. Louis Cardinals": "STL",
  "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX",
  "Toronto Blue Jays": "TOR",
  "Washington Nationals": "WSH",
};

/** Local-seed abbr → MLBAM-style abbr (same alias as TEAM_ABBR_TO_MLBAM). */
const TO_MLBAM_ABBR: Record<string, string> = { ARI: "AZ" };
function normAbbr(abbr: string): string {
  return TO_MLBAM_ABBR[abbr] ?? abbr;
}

/** Prices for one game, aggregated across bookmakers. Null = not offered. */
export interface GamePrices {
  moneylineHome: number | null;
  moneylineAway: number | null;
  runline: number | null; // home spread, typically -1.5
  runlineHomePrice: number | null;
  runlineAwayPrice: number | null;
  total: number | null;
  totalOverPrice: number | null;
  totalUnderPrice: number | null;
  bookCount: number;
}

interface ParsedEvent {
  awayAbbr: string;
  homeAbbr: string;
  commenceUtc: string;
  etDate: string; // en-CA in America/New_York — matches sv_slate.game_date
  prices: GamePrices;
}

export interface OddsProvenance {
  configured: boolean;
  degraded: boolean; // last fetch failed or was rate-limited
  pulledAt: string | null; // ISO of last successful pull
  remaining: number | null; // x-requests-remaining from the last pull
  used: number | null; // x-requests-used from the last pull
  regions: string;
  markets: string[];
  priced: number; // games joined on the most recent merge
  total: number; // slate games offered on the most recent merge
  misses: string[]; // e.g. "CLE@DET — no event for pair+date"
  doubleheaders: number; // games disambiguated by commence_time
}

interface OddsCache {
  at: number;
  events: ParsedEvent[];
  remaining: number | null;
  used: number | null;
}

let cache: OddsCache | null = null;
let degraded = false;
let lastJoin = { priced: 0, total: 0, misses: [] as string[], doubleheaders: 0 };

function etDateOf(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** American odds -> implied probability (mirrors src/data/props.ts). */
function impliedProb(price: number): number {
  return price > 0 ? 100 / (price + 100) : -price / (-price + 100);
}

/** Implied probability -> American odds, rounded to int. */
function americanFromProb(p: number): number {
  // p = 0.5 is the boundary between +100 and -100 (both imply 0.5); the
  // positive branch keeps +100 a fixed point of the round-trip.
  return p > 0.5
    ? -Math.round((100 * p) / (1 - p))
    : Math.round((100 * (1 - p)) / p);
}

/**
 * Consensus price across books: mean of implied PROBABILITIES, converted
 * back to American. Averaging raw odds is mathematically meaningless —
 * -110 and +100 do not average to -5 in any real sense. The first live
 * pull proved it: nine books dealt an under near -103 with two at +100ish,
 * and a raw mean reported "consensus -29", a price no book offered.
 */
function consensusPrice(prices: number[]): number | null {
  const p = mean(prices.map(impliedProb));
  return p == null ? null : americanFromProb(p);
}

interface RawOutcome {
  name?: string;
  price?: number;
  point?: number;
}
interface RawMarket {
  key?: string;
  outcomes?: RawOutcome[];
}
interface RawBookmaker {
  markets?: RawMarket[];
}
interface RawEvent {
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: RawBookmaker[];
}

/**
 * Parse one event into normalized prices.
 *
 * Aggregation rules (rewritten after the first live pull exposed the flaws
 * in naive cross-book means):
 *   - BOOKS DISAGREE ON THE LINE. Averaging prices for Over 6.5 (-130) and
 *     Over 7.5 (+107) produces a price no book ever dealt — an invented
 *     number, which is the one thing this codebase never ships. So totals
 *     and spreads take the MODAL point across books (ties break to the
 *     lower point, deterministically), and prices average ONLY among the
 *     books dealing that line.
 *   - RAW AMERICAN ODDS DO NOT AVERAGE. -110 and +100 do not average to
 *     -5. All prices (moneyline included) aggregate as the mean of implied
 *     probabilities, converted back to American.
 * Returns null when the team names are outside the explicit map (a
 * non-MLB or renamed team is a report-worthy miss, never a fuzzy guess).
 */
export function parseEvent(raw: RawEvent): ParsedEvent | null {
  const homeAbbr = ODDS_NAME_TO_ABBR[raw.home_team ?? ""];
  const awayAbbr = ODDS_NAME_TO_ABBR[raw.away_team ?? ""];
  if (!homeAbbr || !awayAbbr || !raw.commence_time) return null;

  const mlHome: number[] = [];
  const mlAway: number[] = [];
  // line point -> prices dealt AT that line
  const totalsByPoint = new Map<number, { over: number[]; under: number[] }>();
  const spreadsByHomePoint = new Map<number, { home: number[]; away: number[] }>();

  for (const book of raw.bookmakers ?? []) {
    for (const market of book.markets ?? []) {
      const outcomes = market.outcomes ?? [];
      if (market.key === "h2h") {
        for (const o of outcomes) {
          if (o.price == null) continue;
          if (o.name === raw.home_team) mlHome.push(o.price);
          else if (o.name === raw.away_team) mlAway.push(o.price);
        }
      } else if (market.key === "spreads") {
        const homeO = outcomes.find((o) => o.name === raw.home_team);
        const awayO = outcomes.find((o) => o.name === raw.away_team);
        if (homeO?.price == null || homeO.point == null) continue;
        const group = spreadsByHomePoint.get(homeO.point) ?? { home: [], away: [] };
        group.home.push(homeO.price);
        if (awayO?.price != null) group.away.push(awayO.price);
        spreadsByHomePoint.set(homeO.point, group);
      } else if (market.key === "totals") {
        for (const o of outcomes) {
          if (o.price == null || o.point == null) continue;
          const group = totalsByPoint.get(o.point) ?? { over: [], under: [] };
          if (o.name === "Over") group.over.push(o.price);
          else if (o.name === "Under") group.under.push(o.price);
          totalsByPoint.set(o.point, group);
        }
      }
    }
  }

  /** Modal line: most books dealing it; ties break to the lower point. */
  function modalPoint(m: Map<number, unknown[]>): number | null {
    let best: number | null = null;
    let bestCount = -1;
    for (const [point, prices] of [...m.entries()].sort((a, b) => a[0] - b[0])) {
      if (prices.length > bestCount) {
        best = point;
        bestCount = prices.length;
      }
    }
    return best;
  }

  const totalPoint = modalPoint(
    new Map([...totalsByPoint.entries()].map(([p, g]) => [p, [...g.over, ...g.under]])),
  );
  const spreadPoint = modalPoint(
    new Map([...spreadsByHomePoint.entries()].map(([p, g]) => [p, [...g.home, ...g.away]])),
  );
  const totalGroup = totalPoint != null ? totalsByPoint.get(totalPoint) : undefined;
  const spreadGroup = spreadPoint != null ? spreadsByHomePoint.get(spreadPoint) : undefined;

  const bookCount = (raw.bookmakers ?? []).length;
  return {
    awayAbbr,
    homeAbbr,
    commenceUtc: raw.commence_time,
    etDate: etDateOf(raw.commence_time),
    prices: {
      moneylineHome: consensusPrice(mlHome),
      moneylineAway: consensusPrice(mlAway),
      runline: spreadPoint,
      runlineHomePrice: consensusPrice(spreadGroup?.home ?? []),
      runlineAwayPrice: consensusPrice(spreadGroup?.away ?? []),
      total: totalPoint,
      totalOverPrice: consensusPrice(totalGroup?.over ?? []),
      totalUnderPrice: consensusPrice(totalGroup?.under ?? []),
      bookCount,
    },
  };
}

/**
 * One pull of all upcoming MLB game odds, cached 4h. On 429 the cache is
 * left untouched (stale beats nothing), degraded is set, and there is NO
 * retry — the next call after the TTL tries again. Quota headers are
 * logged at info; the URL (which carries the key) never is.
 */
async function fetchEvents(): Promise<ParsedEvent[]> {
  const key = env.oddsApiKey; // "" => not configured
  if (!key) return [];
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.events;

  const url = new URL(`${ODDS_API_BASE}/sports/${SPORT_KEY}/odds`);
  url.searchParams.set("regions", REGIONS);
  url.searchParams.set("markets", MARKETS.join(","));
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("apiKey", key);

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  } catch (err) {
    degraded = true;
    console.warn(`[odds] fetch failed (network): ${(err as Error).message}`);
    return cache?.events ?? [];
  }

  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");

  if (res.status === 429) {
    degraded = true; // explicit backoff: keep stale cache, no tight retries
    console.warn(`[odds] 429 rate-limited — degraded, serving stale/none (used=${used ?? "?"})`);
    return cache?.events ?? [];
  }
  if (!res.ok) {
    degraded = true;
    console.warn(`[odds] HTTP ${res.status} — degraded, serving stale/none`);
    return cache?.events ?? [];
  }

  const raw = (await res.json()) as RawEvent[];
  const events = raw
    .map(parseEvent)
    .filter((e): e is ParsedEvent => e != null);
  const unnamed = raw.length - events.length;

  degraded = false;
  cache = {
    at: Date.now(),
    events,
    remaining: remaining == null ? null : Number(remaining),
    used: used == null ? null : Number(used),
  };
  console.info(
    `[odds] pulled ${events.length} MLB events (${unnamed} unmapped) · ` +
      `quota used=${used ?? "?"} remaining=${remaining ?? "?"}`,
  );
  return events;
}

/** Game a slate entry can be joined against — SlateGame plus the sv date. */
export interface JoinableGame {
  away: string;
  home: string;
  startUtc?: string; // sv_slate start_utc when available (DH tiebreak)
}

/**
 * Join parsed events onto a slate for one ET date, keyed by team pair +
 * ET date. Doubleheaders (same pair, same date, two events) are broken by
 * commence_time proximity when the slate supplies startUtc; otherwise the
 * earliest unmatched event takes the first game. Misses are NAMED — a
 * failed join dashes out and shows up in the provenance, never a guess.
 */
export function joinOddsToSlate(
  events: ParsedEvent[],
  games: JoinableGame[],
  etDate: string,
): { prices: (GamePrices | null)[]; misses: string[]; doubleheaders: number } {
  const misses: string[] = [];
  const used = new Set<ParsedEvent>();
  let doubleheaders = 0;

  const prices = games.map((g) => {
    const away = normAbbr(g.away);
    const home = normAbbr(g.home);
    const candidates = events.filter(
      (e) =>
        !used.has(e) && e.awayAbbr === away && e.homeAbbr === home && e.etDate === etDate,
    );
    if (candidates.length === 0) {
      misses.push(`${away}@${home} — no event for pair+date`);
      return null;
    }
    let pick = candidates[0];
    if (candidates.length > 1) {
      doubleheaders += 1;
      if (g.startUtc) {
        const target = new Date(g.startUtc).getTime();
        pick = candidates.reduce((best, e) =>
          Math.abs(new Date(e.commenceUtc).getTime() - target) <
          Math.abs(new Date(best.commenceUtc).getTime() - target)
            ? e
            : best,
        );
      }
    }
    used.add(pick);
    return pick.prices;
  });

  return { prices, misses, doubleheaders };
}

const NULL_PRICES: Omit<GamePrices, "bookCount"> = {
  moneylineHome: null,
  moneylineAway: null,
  runline: null,
  runlineHomePrice: null,
  runlineAwayPrice: null,
  total: null,
  totalOverPrice: null,
  totalUnderPrice: null,
};

/**
 * Merge game odds onto MLB SlateGames for one ET slate date. Unjoined
 * games keep explicit nulls (the UI renders em-dashes with a missingHint);
 * the merge stats feed the provenance line.
 */
export async function withGameOdds<T extends SlateGame>(
  games: T[],
  etDate: string,
  startUtcById?: Map<string, string>,
): Promise<T[]> {
  const events = await fetchEvents();
  const joinables: JoinableGame[] = games.map((g) => ({
    away: g.away,
    home: g.home,
    startUtc: startUtcById?.get(g.id),
  }));
  const { prices, misses, doubleheaders } = joinOddsToSlate(events, joinables, etDate);
  lastJoin = {
    priced: prices.filter((p) => p != null).length,
    total: games.length,
    misses,
    doubleheaders,
  };
  if (misses.length > 0) {
    console.info(`[odds] join misses for ${etDate}: ${misses.join("; ")}`);
  }
  return games.map((g, i) => ({ ...g, ...(prices[i] ?? NULL_PRICES) }));
}

/** Provenance + quota surface for the Gamecenter freshness line. */
export function gameOddsProvenance(): OddsProvenance {
  return {
    configured: env.oddsApiKey.length > 0,
    degraded,
    pulledAt: cache ? new Date(cache.at).toISOString() : null,
    remaining: cache?.remaining ?? null,
    used: cache?.used ?? null,
    regions: REGIONS,
    markets: [...MARKETS],
    priced: lastJoin.priced,
    total: lastJoin.total,
    misses: lastJoin.misses,
    doubleheaders: lastJoin.doubleheaders,
  };
}

/** Test hook — resets module state between cases. Never called at runtime. */
export function _resetGameOddsForTest(): void {
  cache = null;
  degraded = false;
  lastJoin = { priced: 0, total: 0, misses: [], doubleheaders: 0 };
}
