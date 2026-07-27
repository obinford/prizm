// Slate ingestion — today's games from the real schedule endpoints.
//   MLB: statsapi /schedule?sportId=1&date=YYYY-MM-DD&hydrate=probablePitcher,team,venue
//   NHL: api-web /score/now (falls back to the most recent date with games)
// Probables are linked to ingested player rows (slug) when available.
// If today has no games (offseason), we walk back up to 14 days and ingest the
// most recent date with games, noting it in ingestionRuns.message.

import { getDb } from "../queries/connection";
import { players, slateGames } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { fetchJson, slug, startRun, finishRun, todayEt } from "./common";

const MLB_API = "https://statsapi.mlb.com/api/v1";
const NHL_API = "https://api-web.nhle.com/v1";

function etTimeLabel(isoUtc: string): string {
  // '2026-07-27T18:35:00Z' -> '2:35 PM ET'
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

function ymd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function ingestSlate(): Promise<{ rows: number; message: string }> {
  const db = getDb();
  const runId = await startRun("slate");
  let rows = 0;
  const notes: string[] = [];
  try {
    // ── MLB: today (ET) ──────────────────────────────────────────────────
    const mlbDate = todayEt();
    const sched = await fetchJson(
      `${MLB_API}/schedule?sportId=1&date=${mlbDate}&hydrate=probablePitcher,team,venue`,
    );
    let mlbGames: any[] = sched.dates?.[0]?.games ?? [];
    if (mlbGames.length === 0) {
      // offseason fallback — walk back up to 14 days
      for (let back = 1; back <= 14 && mlbGames.length === 0; back++) {
        const d = new Date(Date.now() - back * 86400000);
        const res = await fetchJson(
          `${MLB_API}/schedule?sportId=1&date=${ymd(d)}&hydrate=probablePitcher,team,venue`,
        );
        mlbGames = res.dates?.[0]?.games ?? [];
        if (mlbGames.length > 0) notes.push(`MLB: no games ${mlbDate}; ingested ${ymd(d)} slate instead`);
      }
    }

    for (const g of mlbGames) {
      const away = g.teams?.away?.team?.abbreviation ?? "???";
      const home = g.teams?.home?.team?.abbreviation ?? "???";
      const awayProb = g.teams?.away?.probablePitcher;
      const homeProb = g.teams?.home?.probablePitcher;
      const probables = {
        away: awayProb?.fullName,
        home: homeProb?.fullName,
        awayPlayerId: awayProb?.id ? await playerSlugFor("mlb", awayProb.id) : undefined,
        homePlayerId: homeProb?.id ? await playerSlugFor("mlb", homeProb.id) : undefined,
      };
      const extGameId = `mlb-${g.gamePk}`;
      const startTime = etTimeLabel(g.gameDate);
      await db
        .insert(slateGames)
        .values({
          sport: "mlb",
          extGameId,
          gameDate: mlbDate,
          startTime,
          away,
          home,
          venue: g.venue?.name ?? "",
          probablesJson: JSON.stringify(probables),
        })
        .onDuplicateKeyUpdate({
          set: {
            gameDate: mlbDate,
            startTime,
            away,
            home,
            venue: g.venue?.name ?? "",
            probablesJson: JSON.stringify(probables),
          },
        });
      rows++;
    }

    // ── NHL: /score/now ──────────────────────────────────────────────────
    let nhlDate = "";
    let nhlGames: any[] = [];
    try {
      const score = await fetchJson(`${NHL_API}/score/now`);
      nhlGames = score.games ?? [];
      nhlDate = score.currentDate ?? todayEt();
    } catch (err) {
      console.warn(`[slate] NHL score/now failed: ${(err as Error).message}`);
    }
    if (nhlGames.length === 0) {
      for (let back = 1; back <= 14 && nhlGames.length === 0; back++) {
        const d = ymd(new Date(Date.now() - back * 86400000));
        try {
          const res = await fetchJson(`${NHL_API}/score/${d}`);
          nhlGames = res.games ?? [];
          if (nhlGames.length > 0) {
            nhlDate = d;
            notes.push(`NHL: no games today; ingested ${d} slate instead`);
          }
        } catch {
          /* keep walking back */
        }
      }
    }

    for (const g of nhlGames) {
      const away = g.awayTeam?.abbrev ?? "???";
      const home = g.homeTeam?.abbrev ?? "???";
      // NHL lists no official probable goalies — leave probables empty honestly.
      const probables = { away: undefined, home: undefined };
      const extGameId = `nhl-${g.id}`;
      const startTime = etTimeLabel(g.startTimeUTC);
      const gameDate = g.gameDate ?? nhlDate;
      await db
        .insert(slateGames)
        .values({
          sport: "nhl",
          extGameId,
          gameDate,
          startTime,
          away,
          home,
          venue: g.venue?.default ?? "",
          probablesJson: JSON.stringify(probables),
        })
        .onDuplicateKeyUpdate({
          set: { gameDate, startTime, away, home, venue: g.venue?.default ?? "", probablesJson: JSON.stringify(probables) },
        });
      rows++;
    }

    const message = `MLB slate ${mlbDate} (${mlbGames.length} games); NHL slate ${nhlDate || "n/a"} (${nhlGames.length} games). ${notes.join(" ")}`.trim();
    await finishRun(runId, "ok", rows, message);
    return { rows, message };
  } catch (err) {
    await finishRun(runId, "error", rows, (err as Error).message);
    throw err;
  }
}

async function playerSlugFor(sport: "mlb" | "nhl", extId: number): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ slug: players.slug })
    .from(players)
    .where(and(eq(players.sport, sport), eq(players.extId, extId)))
    .limit(1);
  return row?.slug;
}
