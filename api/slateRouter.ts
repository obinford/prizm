import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { players, slateGames, teamStats } from "@db/schema";
import type { SlateGame } from "@contracts/types";
import { getSavantSlate, type SvSlateRow } from "./supabase/savant";

function etTimeLabel(isoUtc: string): string {
  // '2026-07-26T16:15:00+00:00' -> '12:15 PM ET'
  try {
    const d = new Date(isoUtc);
    return (
      d.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " ET"
    );
  } catch {
    return "";
  }
}

/** MLB games from sv_slate (probables with hands). NHL stays on MySQL. */
async function mlbSlateFromSavant(): Promise<SlateGame[]> {
  const { games } = await getSavantSlate();
  if (games.length === 0) return [];
  // map probable MLBAM ids → frontend slugs where the player exists locally
  const spIds = games
    .flatMap((g) => [g.away_sp_id, g.home_sp_id])
    .filter((id): id is number => id != null);
  const db = getDb();
  const local = spIds.length
    ? await db.select().from(players).where(inArray(players.extId, spIds))
    : [];
  const slugByExtId = new Map(
    local.filter((p) => p.sport === "mlb").map((p) => [p.extId, p.slug]),
  );
  const hand = (h: string | null): "L" | "R" | null => (h === "L" || h === "R" ? h : null);
  return games.map((g: SvSlateRow) => ({
    id: `mlb-${g.away_abbr.toLowerCase()}-${g.home_abbr.toLowerCase()}`,
    sport: "mlb" as const,
    away: g.away_abbr,
    home: g.home_abbr,
    startTime: etTimeLabel(g.start_utc),
    venue: g.venue ?? "",
    awayProbable: g.away_sp_name ?? undefined,
    homeProbable: g.home_sp_name ?? undefined,
    awayProbableId:
      (g.away_sp_id != null && slugByExtId.get(g.away_sp_id)) ||
      (g.away_sp_id != null ? String(g.away_sp_id) : undefined),
    homeProbableId:
      (g.home_sp_id != null && slugByExtId.get(g.home_sp_id)) ||
      (g.home_sp_id != null ? String(g.home_sp_id) : undefined),
    awayProbableHand: hand(g.away_sp_hand),
    homeProbableHand: hand(g.home_sp_hand),
    gamePk: g.game_pk,
  }));
}

/** NHL slate (and MLB fallback) from the MySQL ingestion — unchanged. */
async function mysqlSlate(sports: ("mlb" | "nhl")[]): Promise<SlateGame[]> {
  const db = getDb();
  const rows = await db.select().from(slateGames).orderBy(desc(slateGames.gameDate));
  const latestBySport = new Map<string, string>();
  for (const r of rows) if (!latestBySport.has(r.sport)) latestBySport.set(r.sport, r.gameDate);
  return rows
    .filter((r) => sports.includes(r.sport) && r.gameDate === latestBySport.get(r.sport))
    .map(toSlateGame);
}

function toSlateGame(row: typeof slateGames.$inferSelect): SlateGame {
  const prob = row.probablesJson ? JSON.parse(row.probablesJson) : {};
  return {
    id: `${row.sport}-${row.away.toLowerCase()}-${row.home.toLowerCase()}`,
    sport: row.sport,
    away: row.away,
    home: row.home,
    startTime: row.startTime,
    venue: row.venue,
    awayProbable: prob.away ?? undefined,
    homeProbable: prob.home ?? undefined,
    awayProbableId: prob.awayPlayerId ?? undefined,
    homeProbableId: prob.homePlayerId ?? undefined,
  };
}

export const slateRouter = createRouter({
  /** Games for the most recent ingested slate date (per sport). */
  today: publicQuery
    .input(z.object({ sport: z.enum(["mlb", "nhl"]).optional() }).optional())
    .query(async ({ input }) => {
      const out: SlateGame[] = [];
      const wantMlb = !input?.sport || input.sport === "mlb";
      const wantNhl = !input?.sport || input.sport === "nhl";
      if (wantMlb) {
        let mlb: SlateGame[] = [];
        try {
          mlb = await mlbSlateFromSavant();
        } catch (err) {
          console.warn("[savant] sv_slate unavailable, using MySQL fallback:", (err as Error).message);
        }
        out.push(...(mlb.length ? mlb : await mysqlSlate(["mlb"])));
      }
      if (wantNhl) out.push(...(await mysqlSlate(["nhl"]))); // NHL unchanged
      return out;
    }),

  game: publicQuery
    .input(z.object({ id: z.string().min(3).max(48) }))
    .query(async ({ input }) => {
      // id format: mlb-nyy-bos / nhl-edm-cgy
      const db = getDb();
      const parts = input.id.split("-");
      const sport = parts[0] as "mlb" | "nhl";
      if ((sport !== "mlb" && sport !== "nhl") || parts.length < 3) return undefined;
      const away = parts[1].toUpperCase();
      const home = parts[2].toUpperCase();
      const rows = await db
        .select()
        .from(slateGames)
        .where(and(eq(slateGames.sport, sport), eq(slateGames.away, away), eq(slateGames.home, home)))
        .orderBy(desc(slateGames.gameDate))
        .limit(1);
      return rows[0] ? toSlateGame(rows[0]) : undefined;
    }),

  /** MLB team bullpen stats (from reliever game logs — see api/ingest/mlb.ts). */
  bullpens: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(teamStats).where(eq(teamStats.sport, "mlb"));
    return rows.map((r) => JSON.parse(r.statsJson));
  }),
});
