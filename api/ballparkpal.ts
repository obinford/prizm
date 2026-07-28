// Shared Ballpark Pal fetch + cache — extracted from weatherRouter in Step 11
// so the Quick Alerts weather-HR verdict reads the same 5-minute cache as the
// Weather tab. All recon facts live in api/weatherRouter.ts's header comment;
// the short version: key server-side only (X-API-Key), today/future dates
// only, game-level factors are park+weather combined, raw conditions are not
// exposed.

export const BPP_BASE = "https://www.ballparkpal.com/api/v1";

/** Ballpark Pal abbr → Prizm/MLBAM abbr. Identity for every other team. */
const BPP_ABBR_MAP: Record<string, string> = { CHW: "CWS", WAS: "WSH" };

export function toPrizmAbbr(abbr: string): string {
  return BPP_ABBR_MAP[abbr] ?? abbr;
}

export interface BppGameFactors {
  gamePk: number;
  gameTime: string; // bare ET string from the feed, e.g. "6:45"
  away: string; // Prizm abbr
  home: string; // Prizm abbr
  runsPercent: number;
  homeRunsPercent: number;
  doublesTriplesPercent: number;
  singlesPercent: number;
  runsAmount: number;
  homeRunsAmount: number;
  doublesTriplesAmount: number;
  singlesAmount: number;
}

export interface BppHitterFactors {
  playerId: number; // MLBAM id — joins sv_stat_cache.mlbam_id directly
  playerName: string;
  team: string; // Prizm abbr
  // combined = stadium + weather (additive, per the provider docs)
  homeRuns: number;
  doublesTriples: number;
  singles: number;
  homeRunsStadium: number | null;
  doublesTriplesStadium: number | null;
  singlesStadium: number | null;
  homeRunsWeather: number | null;
  doublesTriplesWeather: number | null;
  singlesWeather: number | null;
}

export interface BppFactors {
  asOf: string;
  games: BppGameFactors[];
  hittersByGame: Record<number, BppHitterFactors[]>;
}

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; factors: BppFactors }>();

async function bppFetch(path: string, key: string): Promise<unknown> {
  const res = await fetch(`${BPP_BASE}${path}`, {
    headers: { "X-API-Key": key, accept: "application/json" },
  });
  if (!res.ok) {
    // Provider error envelope: { error: { code, message } } — surface the
    // code (rate_limited, date_out_of_range, …) without logging the key.
    let code = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      if (body?.error?.code) code = body.error.code;
    } catch {
      /* non-JSON error body — keep the HTTP status */
    }
    throw new Error(`Ballpark Pal ${path} failed: ${code}`);
  }
  return res.json();
}

/**
 * Game-level + hitter-level park factors for one ET date, cached 5 minutes.
 * Throws when the key is missing or the provider errors — callers decide
 * what honest state to render (weatherRouter maps a missing key to
 * `configured: false`; briefRouter treats it as "verdict unavailable").
 */
export async function getParkFactors(date: string): Promise<BppFactors> {
  const key = process.env.BALLPARKPAL_API_KEY ?? "";
  if (!key) throw new Error("BALLPARKPAL_API_KEY is not set");

  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.factors;

  const [gamesRes, hittersRes] = await Promise.all([
    bppFetch(`/parkfactors?date=${date}`, key),
    bppFetch(`/parkfactors/hitters?date=${date}`, key),
  ]);

  const gamesMeta = (gamesRes as { meta?: { asOf?: string } }).meta;
  const gameItems =
    ((gamesRes as { data?: { items?: Record<string, unknown>[] } }).data?.items) ?? [];
  const hitterItems =
    ((hittersRes as { data?: { items?: Record<string, unknown>[] } }).data?.items) ?? [];

  const games: BppGameFactors[] = gameItems.map((g) => ({
    gamePk: Number(g.gameId),
    gameTime: String(g.gameTime ?? ""),
    away: toPrizmAbbr(String(g.teamAway ?? "")),
    home: toPrizmAbbr(String(g.teamHome ?? "")),
    runsPercent: Number(g.runsPercent ?? 0),
    homeRunsPercent: Number(g.homeRunsPercent ?? 0),
    doublesTriplesPercent: Number(g.doublesTriplesPercent ?? 0),
    singlesPercent: Number(g.singlesPercent ?? 0),
    runsAmount: Number(g.runsAmount ?? 0),
    homeRunsAmount: Number(g.homeRunsAmount ?? 0),
    doublesTriplesAmount: Number(g.doublesTriplesAmount ?? 0),
    singlesAmount: Number(g.singlesAmount ?? 0),
  }));

  const hittersByGame: Record<number, BppHitterFactors[]> = {};
  for (const h of hitterItems) {
    const gamePk = Number(h.gameId);
    const row: BppHitterFactors = {
      playerId: Number(h.playerId),
      playerName: String(h.playerName ?? ""),
      team: toPrizmAbbr(String(h.team ?? "")),
      homeRuns: Number(h.homeRuns ?? 1),
      doublesTriples: Number(h.doublesTriples ?? 1),
      singles: Number(h.singles ?? 1),
      homeRunsStadium: h.homeRunsStadium == null ? null : Number(h.homeRunsStadium),
      doublesTriplesStadium:
        h.doublesTriplesStadium == null ? null : Number(h.doublesTriplesStadium),
      singlesStadium: h.singlesStadium == null ? null : Number(h.singlesStadium),
      homeRunsWeather: h.homeRunsWeather == null ? null : Number(h.homeRunsWeather),
      doublesTriplesWeather:
        h.doublesTriplesWeather == null ? null : Number(h.doublesTriplesWeather),
      singlesWeather: h.singlesWeather == null ? null : Number(h.singlesWeather),
    };
    (hittersByGame[gamePk] ??= []).push(row);
  }

  const factors: BppFactors = { asOf: gamesMeta?.asOf ?? "", games, hittersByGame };
  cache.set(date, { at: Date.now(), factors });
  return factors;
}
