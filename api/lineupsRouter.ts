// Batting orders from the MLB Stats API schedule feed (hydrate=lineups).
//
// Why this is NOT api/ingest/lineups.ts: the ingest path is a batch loader
// into MySQL, and this step must not depend on DATABASE_URL. The schedule
// feed is keyless and live — lineups change up to first pitch, so it is
// cached 5 minutes (same cadence as the pg client), never warehoused. A stale
// order is a wrong order.
//
// Empty `lineups: {}` on a game is the normal state for most of the day —
// teams post 3–4 hours before first pitch. It is not an error, not retried,
// and contributes nothing. Never write a batting order the feed did not send.

import { createRouter, publicQuery } from "./middleware";
import { z } from "zod";
import { parseScheduleGames, parseScheduleLineups, type ParsedLineups } from "./lineupsParse";
import { TEAM_ID_TO_ABBR } from "./supabase/savant";
import { etTimeLabel } from "./slateRouter";

const CACHE_TTL_MS = 5 * 60_000;
let cache: { at: number; parsed: ParsedLineups } | null = null;

/** Schedule facts (probables) per date — same feed, same 5-minute cadence. */
const scheduleCache = new Map<string, { at: number; games: ReturnType<typeof parseScheduleGames> }>();

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function fetchSchedule(date: string, hydrate: string): Promise<any> {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=${hydrate}`;
  const res = await fetch(url, {
    headers: { "user-agent": "prizm/1.0", accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from statsapi schedule`);
  return res.json();
}

async function getLineups(): Promise<ParsedLineups> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.parsed;
  const date = todayEt();
  const parsed = parseScheduleLineups(await fetchSchedule(date, "lineups,probablePitcher"), date);
  cache = { at: Date.now(), parsed };
  return parsed;
}

async function getScheduleGames(date: string): Promise<ReturnType<typeof parseScheduleGames>> {
  const hit = scheduleCache.get(date);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.games;
  const games = parseScheduleGames(await fetchSchedule(date, "probablePitcher"));
  scheduleCache.set(date, { at: Date.now(), games });
  return games;
}

export const lineupsRouter = createRouter({
  /**
   * Tonight's batting orders.
   *
   * orders is keyed by MLBAM id (joins sv_stat_cache.mlbam_id directly).
   * slugs carries the same entries keyed by slug(fullName) — the client
   * Batter.id — because the client never sees MLBAM ids (players.extId is
   * server-side and off-limits to this step). Both come from the same parse;
   * the slug join is deterministic, not a string match: slug() here is the
   * same function that built players.slug at ingest.
   */
  today: publicQuery.query(async () => {
    const { date, orders, postedGamePks, teamsByGamePk } = await getLineups();

    const byMlbam: Record<number, { battingOrder: number; position: string }> = {};
    const bySlug: Record<string, { battingOrder: number; position: string }> = {};
    for (const [id, o] of Object.entries(orders)) {
      const entry = { battingOrder: o.battingOrder, position: o.position };
      byMlbam[Number(id)] = entry;
      if (o.slug) bySlug[o.slug] = entry;
    }

    // Slate ids via statsapi team_id → the same MLBAM abbreviations sv_slate
    // uses, so lineupsPostedFor matches SlateGame.id. An unmapped team id is
    // a data problem — listed, never guessed.
    const lineupsPostedFor: string[] = [];
    const unmatchedGamePks: number[] = [];
    for (const pk of postedGamePks) {
      const t = teamsByGamePk[pk];
      const away = t && TEAM_ID_TO_ABBR[t.awayTeamId];
      const home = t && TEAM_ID_TO_ABBR[t.homeTeamId];
      if (away && home) lineupsPostedFor.push(`mlb-${away.toLowerCase()}-${home.toLowerCase()}`);
      else unmatchedGamePks.push(pk);
    }

    return { date, lineupsPostedFor, postedGamePks, unmatchedGamePks, orders: byMlbam, slugs: bySlug };
  }),

  /**
   * Schedule facts for any date (the Tomorrow view): teams, start, venue and
   * named probables. Keyless feed, cached 5 minutes, never warehoused.
   *
   * Probable hands are NOT in this hydrate (probablePitcher carries id +
   * fullName only), so this route returns names and nothing else — the
   * client must not decorate tomorrow's probables with today's hand data.
   * An unmapped statsapi team id yields a null abbr, never a guessed one.
   */
  schedule: publicQuery
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const games = await getScheduleGames(input.date);
      return games.map((g) => ({
        gamePk: g.gamePk,
        startTime: etTimeLabel(g.startUtc),
        venue: g.venue,
        away: g.awayTeamId != null ? (TEAM_ID_TO_ABBR[g.awayTeamId] ?? null) : null,
        home: g.homeTeamId != null ? (TEAM_ID_TO_ABBR[g.homeTeamId] ?? null) : null,
        awayProbable: g.awayProbable?.name ?? null,
        homeProbable: g.homeProbable?.name ?? null,
      }));
    }),
});
