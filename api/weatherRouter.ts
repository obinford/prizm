// Ballpark Pal park factors — game-level and hitter-level, server-side only.
//
// Why this router exists (Step 8 recon, 2026-07-27, docs + live payloads):
// - The API key must never ship to the client. It lives in
//   BALLPARKPAL_API_KEY (loaded via api/lib/env.ts → dotenv/config) and is
//   sent as the X-API-Key header from here only.
// - Base URL is https://www.ballparkpal.com/api/v1 (the bare domain 301s to
//   www). Rate limit: 60 req/min, 15,000 req/month, resetting the 1st UTC.
// - Today-and-future dates only (US Eastern); past dates return
//   date_out_of_range. Historical park factors are not available.
//
// What the feed does and does not carry (verified against live payloads):
// - /parkfactors?date= is game-level COMBINED (park + weather) factors only:
//   integer percents (18 = 18%) plus estimated per-game amounts for runs,
//   home runs, doubles/triples and singles. There is NO stadium/weather
//   split at game level.
// - /parkfactors/hitters?date= carries the split: per-hitter combined
//   multiplier (1.08 = +8% over neutral), stadium-only multiplier, and the
//   weather-only deviation (combined = stadium + weather, additive — e.g.
//   0.9981 + 0.2219 = 1.22). Stadium fields may be null before the
//   stadium-only projection is generated.
// - Raw conditions (temperature, humidity, wind speed/direction) are NOT
//   exposed by Ballpark Pal at any level — weather is baked into the
//   multipliers. Surfacing raw conditions needs a second provider; this
//   router does not backfill them.
// - Refresh cadence is undocumented. meta.asOf is the response timestamp;
//   factors for a date are populated by late evening ET the day before.
//
// Why this is NOT warehoused: slate_games.weatherJson exists in db/schema.ts
// but writing it requires the MySQL ingest path, which is blocked on
// DATABASE_URL. Same stance as lineupsRouter: cached 5 minutes in memory,
// never persisted, never fabricated. When DATABASE_URL lands, persistence
// can be added behind this same response shape.
//
// Abbreviations: Ballpark Pal uses CHW/WAS where Prizm and the warehouse use
// CWS/WSH (MLBAM style). Mapped here at the boundary — never string-matched
// downstream.

import { createRouter, publicQuery } from "./middleware";
import { z } from "zod";

const CACHE_TTL_MS = 5 * 60_000;
const BPP_BASE = "https://www.ballparkpal.com/api/v1";

/** Ballpark Pal abbr → Prizm/MLBAM abbr. Identity for every other team. */
const BPP_ABBR_MAP: Record<string, string> = { CHW: "CWS", WAS: "WSH" };

function toPrizmAbbr(abbr: string): string {
  return BPP_ABBR_MAP[abbr] ?? abbr;
}

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
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

interface CacheEntry {
  at: number;
  asOf: string;
  games: BppGameFactors[];
  hittersByGame: Record<number, BppHitterFactors[]>;
}

const cache = new Map<string, CacheEntry>();

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

async function getFactors(date: string, key: string): Promise<CacheEntry> {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

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

  const entry: CacheEntry = {
    at: Date.now(),
    asOf: gamesMeta?.asOf ?? "",
    games,
    hittersByGame,
  };
  cache.set(date, entry);
  return entry;
}

export const weatherRouter = createRouter({
  /**
   * Park + weather factors for one slate date (default: today ET).
   *
   * `configured: false` means BALLPARKPAL_API_KEY is not set server-side —
   * the client renders that as an honest setup state, never an empty slate.
   * An empty `games` array with `configured: true` means the provider has
   * not published factors for the date yet (normal for tomorrow until late
   * evening ET).
   */
  factors: publicQuery
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .query(async ({ input }) => {
      const key = process.env.BALLPARKPAL_API_KEY ?? "";
      const date = input.date ?? todayEt();
      if (!key) {
        return {
          configured: false as const,
          date,
          asOf: "",
          games: [] as BppGameFactors[],
          hittersByGame: {} as Record<number, BppHitterFactors[]>,
        };
      }
      const { asOf, games, hittersByGame } = await getFactors(date, key);
      return { configured: true as const, date, asOf, games, hittersByGame };
    }),
});
