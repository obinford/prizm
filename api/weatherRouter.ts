// Ballpark Pal park factors — game-level and hitter-level, server-side only.
//
// Why this router exists (Step 8 recon, 2026-07-27, docs + live payloads):
// - The API key must never ship to the client. It lives in
//   BALLPARKPAL_API_KEY (loaded via api/lib/env.ts → dotenv/config) and is
//   sent as the X-API-Key header from api/ballparkpal.ts only.
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
// DATABASE_URL. Same stance as lineupsRouter: cached 5 minutes in memory
// (api/ballparkpal.ts), never persisted, never fabricated. When
// DATABASE_URL lands, persistence can be added behind this same response
// shape.
//
// Abbreviations: Ballpark Pal uses CHW/WAS where Prizm and the warehouse use
// CWS/WSH (MLBAM style). Mapped in api/ballparkpal.ts — never string-matched
// downstream.

import { createRouter, publicQuery } from "./middleware";
import { z } from "zod";
import { getParkFactors } from "./ballparkpal";

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
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
      const date = input.date ?? todayEt();
      if (!process.env.BALLPARKPAL_API_KEY) {
        return {
          configured: false as const,
          date,
          asOf: "",
          games: [],
          hittersByGame: {},
        };
      }
      const { asOf, games, hittersByGame } = await getParkFactors(date);
      return { configured: true as const, date, asOf, games, hittersByGame };
    }),
});
