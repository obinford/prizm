// Props ingestion — derives prop lines FROM REAL STATS stored in the DB
// (players + gameLogs + slateGames). No odds feed exists: prices stay flat
// -115/-115 (illustrative). Everything here is conservative and deterministic.
//
// Line derivation:
//   MLB pitcher Strikeouts — round-half(K/9 × avg IP per start); needs ≥3 GS, line ≥ 3.5
//   MLB batter Total Bases — 1.5 (2.5 if season TB/G ≥ 2.2); needs TB/G ≥ 1.3
//   MLB batter XBH        — 0.5 (1.5 if XBH/G ≥ 0.9); needs XBH/G ≥ 0.35
//   MLB batter Hits       — 1.5 (0.5 if H/G < 1.05); needs H/G ≥ 0.8
//   NHL goalie Saves      — round-half(season saves/game); needs ≥8 starts
//   NHL skater SOG        — round-half(season SOG/game); needs ≥ 1.5
//   NHL skater Goals      — 0.5; needs G/G ≥ 0.35
//   NHL skater Points     — 1.5 if P/G ≥ 1.0 else 0.5; needs P/G ≥ 0.6
// L5/L10/L20 = fraction of the player's last N real game logs over the line.

import { getDb } from "../queries/connection";
import { gameLogs, players, props, slateGames } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ipToOuts, startRun, finishRun } from "./common";

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

interface PropSpec {
  market: string;
  line: number;
  hit: (stat: any) => boolean; // over hit test for one game log stat
}

export async function ingestProps(): Promise<{ rows: number; message: string }> {
  const db = getDb();
  const runId = await startRun("props");
  let rows = 0;
  try {
    // current slate → team → {opponent, gameId}
    const dates = await db
      .selectDistinct({ gameDate: slateGames.gameDate })
      .from(slateGames)
      .orderBy(desc(slateGames.gameDate))
      .limit(4);
    const latestDates = dates.map((d) => d.gameDate);
    const games = latestDates.length
      ? await db.select().from(slateGames).where(
          // drizzle has no inArray on selectDistinct result; filter in JS below
          eq(slateGames.id, slateGames.id),
        )
      : [];
    const slateByTeam = new Map<string, { opponent: string; gameId: string; date: string }>();
    for (const g of games) {
      if (!latestDates.includes(g.gameDate)) continue;
      const gid = `${g.sport}-${g.away.toLowerCase()}-${g.home.toLowerCase()}`;
      if (!slateByTeam.has(g.away)) slateByTeam.set(g.away, { opponent: `@ ${g.home}`, gameId: gid, date: g.gameDate });
      if (!slateByTeam.has(g.home)) slateByTeam.set(g.home, { opponent: `vs ${g.away}`, gameId: gid, date: g.gameDate });
    }

    const allPlayers = await db.select().from(players).where(eq(players.active, true));
    let created = 0;
    let skipped = 0;

    for (const p of allPlayers) {
      const logs = await db
        .select()
        .from(gameLogs)
        .where(eq(gameLogs.playerId, p.id))
        .orderBy(desc(gameLogs.gameDate))
        .limit(25);
      if (logs.length < 5) {
        skipped++;
        continue;
      }
      const parsed = logs.map((l) => JSON.parse(l.statsJson));
      const season = aggregateSeason(p.role, parsed);
      const specs = deriveSpecs(p.role, season);
      if (specs.length === 0) {
        skipped++;
        continue;
      }
      const slate = slateByTeam.get(p.team) ?? { opponent: "", gameId: "", date: "" };

      for (const spec of specs) {
        const hits = parsed.map((g) => spec.hit(g.stat));
        const rate = (n: number) => {
          const slice = hits.slice(0, n);
          return slice.length ? slice.filter(Boolean).length / slice.length : 0;
        };
        const l5 = rate(5);
        const l10 = rate(10);
        const l20 = rate(20);
        await db
          .insert(props)
          .values({
            sport: p.sport,
            playerId: p.id,
            market: spec.market,
            line: String(spec.line),
            priceOver: -115,
            priceUnder: -115,
            l5: l5.toFixed(3),
            l10: l10.toFixed(3),
            l20: l20.toFixed(3),
            opponent: slate.opponent,
            gameId: slate.gameId,
            updatedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              sport: p.sport,
              line: String(spec.line),
              l5: l5.toFixed(3),
              l10: l10.toFixed(3),
              l20: l20.toFixed(3),
              opponent: slate.opponent,
              gameId: slate.gameId,
              updatedAt: new Date(),
            },
          });
        created++;
        rows++;
      }
    }

    const message = `props upserted=${created} across players with derived lines (${skipped} players skipped — no qualifying line or <5 logs); prices flat -115 (no odds feed)`;
    await finishRun(runId, "ok", rows, message);
    return { rows, message };
  } catch (err) {
    await finishRun(runId, "error", rows, (err as Error).message);
    throw err;
  }
}

// ── Season aggregation from stored logs ──────────────────────────────────────

function aggregateSeason(role: string, logs: any[]) {
  const n = logs.length;
  const sum = (fn: (s: any) => number) => logs.reduce((acc, g) => acc + fn(g.stat ?? {}), 0);
  if (role === "batter") {
    return {
      games: n,
      tb: sum((s) => s.totalBases ?? 0) / n,
      xbh: sum((s) => (s.doubles ?? 0) + (s.triples ?? 0) + (s.homeRuns ?? 0)) / n,
      hits: sum((s) => s.hits ?? 0) / n,
    };
  }
  if (role === "pitcher") {
    const outs = sum((s) => s.outs ?? ipToOuts(s.inningsPitched));
    const so = sum((s) => s.strikeOuts ?? 0);
    const gs = sum((s) => s.gamesStarted ?? 0);
    const ip = outs / 3;
    return {
      games: n,
      gs,
      k9: ip > 0 ? (9 * so) / ip : 0,
      ipPerStart: gs > 0 ? ip / gs : 0,
    };
  }
  if (role === "skater") {
    return {
      games: n,
      sog: sum((s) => s.shots ?? 0) / n,
      goals: sum((s) => s.goals ?? 0) / n,
      points: sum((s) => s.points ?? 0) / n,
    };
  }
  // goalie
  const starts = sum((s) => s.gamesStarted ?? 0);
  return {
    games: n,
    starts,
    saves: sum((s) => (s.shotsAgainst ?? 0) - (s.goalsAgainst ?? 0)) / n,
  };
}

function deriveSpecs(role: string, season: any): PropSpec[] {
  const out: PropSpec[] = [];
  if (role === "pitcher") {
    if (season.gs >= 3 && season.ipPerStart > 0) {
      const line = roundHalf(season.k9 * season.ipPerStart);
      if (line >= 3.5) {
        out.push({ market: "Strikeouts", line, hit: (s) => (s.strikeOuts ?? 0) > line });
      }
    }
    return out;
  }
  if (role === "batter") {
    if (season.tb >= 1.3) {
      const line = season.tb >= 2.2 ? 2.5 : 1.5;
      out.push({ market: "Total Bases", line, hit: (s) => (s.totalBases ?? 0) > line });
    }
    if (season.xbh >= 0.35) {
      const line = season.xbh >= 0.9 ? 1.5 : 0.5;
      out.push({ market: "XBH", line, hit: (s) => (s.doubles ?? 0) + (s.triples ?? 0) + (s.homeRuns ?? 0) > line });
    }
    if (season.hits >= 0.8) {
      const line = season.hits >= 1.05 ? 1.5 : 0.5;
      out.push({ market: "Hits", line, hit: (s) => (s.hits ?? 0) > line });
    }
    return out;
  }
  if (role === "skater") {
    if (season.sog >= 1.5) {
      const line = roundHalf(season.sog);
      out.push({ market: "SOG", line, hit: (s) => (s.shots ?? 0) > line });
    }
    if (season.goals >= 0.35) {
      out.push({ market: "Goals", line: 0.5, hit: (s) => (s.goals ?? 0) > 0.5 });
    }
    if (season.points >= 0.6) {
      const line = season.points >= 1.0 ? 1.5 : 0.5;
      out.push({ market: "Points", line, hit: (s) => (s.points ?? 0) > line });
    }
    return out;
  }
  if (role === "goalie") {
    if (season.starts >= 8) {
      const line = roundHalf(season.saves);
      if (line >= 15) {
        out.push({ market: "Saves", line, hit: (s) => (s.shotsAgainst ?? 0) - (s.goalsAgainst ?? 0) > line });
      }
    }
    return out;
  }
  return out;
}
