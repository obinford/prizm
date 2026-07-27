// NHL ingestion — source: https://api-web.nhle.com/v1 (public, no key).
//
// standings/now → 32 teams → roster/{abbrev}/current → per-player
// game-log/{season}/2 (regular season). Season line and rolling windows are
// BOTH aggregated from the real game log so they are always consistent.
// Windows are by ICE TIME: last 60/120/180/240 minutes of TOI.
//
// Data season: 20252026 (last COMPLETED regular season — the API's "now" is
// the very start of 2026-27 with ~0-1 games played).
//
// Caveat: api-web.nhle.com exposes no expected-goals data, so Goalie.gsax and
// xgAgainst are stored as null (omitted honestly, per spec).

import { getDb } from "../queries/connection";
import { gameLogs, players, seasonStats, windowStats } from "@db/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchJson, round2, round3, slug, startRun, finishRun, toiToMinutes } from "./common";

const API = "https://api-web.nhle.com/v1";
const SEASON = "20252026";
const GAME_TYPE = 2; // regular season

const NHL_WINDOWS = [
  { key: "MIN60", quota: 60 },
  { key: "MIN120", quota: 120 },
  { key: "MIN180", quota: 180 },
  { key: "MIN240", quota: 240 },
] as const;

const FALLBACK_TEAMS = [
  "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM",
  "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT",
  "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
];

interface SkaterAgg { toi: number; shots: number; goals: number; points: number; games: number }
interface GoalieAgg { toi: number; saves: number; shotsAgainst: number; goalsAgainst: number; games: number; starts: number }

function skaterLine(a: SkaterAgg) {
  const g = Math.max(1, a.games);
  return {
    toi: Math.round(a.toi),
    sog: Math.round((a.shots / g) * 10) / 10,
    goals: round2(a.goals / g),
    points: round2(a.points / g),
  };
}

function goalieLine(a: GoalieAgg) {
  const saves = a.saves || a.shotsAgainst - a.goalsAgainst;
  return {
    toi: Math.round(a.toi),
    svPct: a.shotsAgainst > 0 ? round3(saves / a.shotsAgainst) : 0,
    gsax: null as number | null,
    xgAgainst: null as number | null,
  };
}

export async function ingestNhl(fromIdx = 0, toIdx = 32): Promise<{ rows: number; message: string }> {
  const db = getDb();
  const runId = await startRun("nhl");
  let rows = 0;
  try {
    // 1) teams from standings (fallback to static list)
    let teamAbbrevs: string[] = [];
    try {
      const standings = await fetchJson(`${API}/standings/now`);
      teamAbbrevs = (standings.standings ?? [])
        .map((s: any) => (typeof s.teamAbbrev === "object" ? s.teamAbbrev?.default : s.teamAbbrev))
        .filter(Boolean);
    } catch {
      console.warn("[nhl] standings/now failed, using fallback team list");
    }
    if (teamAbbrevs.length === 0) teamAbbrevs = FALLBACK_TEAMS;
    console.log(`[nhl] ${teamAbbrevs.length} teams`);

    let nGoalies = 0;
    let nSkaters = 0;
    let maxGameDate = "";

    for (const abbr of teamAbbrevs.slice(fromIdx, toIdx)) {
      let roster: any;
      try {
        roster = await fetchJson(`${API}/roster/${abbr}/${SEASON}`);
      } catch {
        try {
          roster = await fetchJson(`${API}/roster/${abbr}/current`);
        } catch (err) {
          console.warn(`[nhl] roster ${abbr} failed: ${(err as Error).message}`);
          continue;
        }
      }
      const skatersRaw = [...(roster.forwards ?? []), ...(roster.defensemen ?? [])];
      const goaliesRaw = roster.goalies ?? [];

      for (const p of skatersRaw) {
        // normalize NHL's L/R/D/C codes to the frontend's LW/RW/D/C
        const rawPos: string = p.positionCode ?? "";
        const pos = rawPos === "L" ? "LW" : rawPos === "R" ? "RW" : rawPos;
        const ok = await ingestOneNhlPlayer(db, {
          extId: p.id,
          name: `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim(),
          team: abbr,
          pos,
          hand: p.shootsCatches ?? "",
          role: "skater",
        });
        if (ok) {
          nSkaters++;
          rows++;
          if (ok.maxDate > maxGameDate) maxGameDate = ok.maxDate;
        }
      }
      for (const p of goaliesRaw) {
        const ok = await ingestOneNhlPlayer(db, {
          extId: p.id,
          name: `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim(),
          team: abbr,
          pos: "G",
          hand: p.shootsCatches ?? "",
          role: "goalie",
        });
        if (ok) {
          nGoalies++;
          rows++;
          if (ok.maxDate > maxGameDate) maxGameDate = ok.maxDate;
        }
      }
      console.log(`[nhl] ${abbr} done (skaters=${nSkaters} goalies=${nGoalies})`);
    }

    const message = `season=${SEASON} (regular season, gameType=2); skaters=${nSkaters} goalies=${nGoalies}; game logs through ${maxGameDate || "n/a"}; GSAx/xGA omitted (no public xG feed)`;
    await finishRun(runId, "ok", rows, message);
    return { rows, message };
  } catch (err) {
    await finishRun(runId, "error", rows, (err as Error).message);
    throw err;
  }
}

async function ingestOneNhlPlayer(
  db: ReturnType<typeof getDb>,
  info: { extId: number; name: string; team: string; pos: string; hand: string; role: "skater" | "goalie" },
): Promise<{ maxDate: string } | null> {
  let gl: any[];
  try {
    const res = await fetchJson(`${API}/player/${info.extId}/game-log/${SEASON}/${GAME_TYPE}`);
    gl = res.gameLog ?? [];
  } catch (err) {
    console.warn(`  [nhl] game-log ${info.name} (${info.extId}) failed: ${(err as Error).message}`);
    return null;
  }
  // newest first; keep only games actually played
  const games = gl
    .filter((g) => g.toi && toiToMinutes(g.toi) > 0)
    .sort((a, b) => (a.gameDate < b.gameDate ? 1 : -1));
  if (games.length < 5) return null; // skip players with <5 games

  // upsert player row
  let playerSlug = slug(info.name);
  const existing = await db
    .select()
    .from(players)
    .where(and(eq(players.sport, "nhl"), eq(players.extId, info.extId)))
    .limit(1);
  if (existing.length > 0) {
    playerSlug = existing[0].slug;
    await db
      .update(players)
      .set({ name: info.name, team: info.team, pos: info.pos, hand: info.hand, role: info.role, active: true })
      .where(eq(players.id, existing[0].id));
  } else {
    const clash = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.sport, "nhl"), eq(players.slug, playerSlug)))
      .limit(1);
    if (clash.length > 0) playerSlug = `${playerSlug}-${info.extId}`;
    await db.insert(players).values({
      sport: "nhl", extId: info.extId, slug: playerSlug, name: info.name, team: info.team,
      pos: info.pos, hand: info.hand, role: info.role, active: true,
    });
  }
  const [row] = await db
    .select()
    .from(players)
    .where(and(eq(players.sport, "nhl"), eq(players.extId, info.extId)))
    .limit(1);
  const pid = row.id;

  // store raw game logs — batched (per-row awaits on a remote DB are ~70ms each)
  const logRows: { playerId: number; gameDate: string; extGameId: string; statsJson: string }[] = [];
  for (const g of games) {
    logRows.push({
      playerId: pid,
      gameDate: g.gameDate,
      extGameId: String(g.gameId ?? ""),
      statsJson: JSON.stringify({
        group: info.role,
        date: g.gameDate,
        gameId: g.gameId,
        opponent: g.opponentAbbrev ?? "",
        isHome: g.homeRoadFlag === "H",
        stat: g,
      }),
    });
  }
  for (let i = 0; i < logRows.length; i += 400) {
    const batch = logRows.slice(i, i + 400);
    if (batch.length === 0) continue;
    await db
      .insert(gameLogs)
      .values(batch)
      .onDuplicateKeyUpdate({ set: { statsJson: sql`VALUES(statsJson)` } });
  }

  // season line from full log
  if (info.role === "skater") {
    const a: SkaterAgg = { toi: 0, shots: 0, goals: 0, points: 0, games: 0 };
    for (const g of games) {
      a.toi += toiToMinutes(g.toi);
      a.shots += g.shots ?? 0;
      a.goals += g.goals ?? 0;
      a.points += g.points ?? 0;
      a.games++;
    }
    const season = { ...skaterLine(a), g: a.games };
    await upsertSeason(db, pid, season);
    for (const w of NHL_WINDOWS) {
      const wa: SkaterAgg = { toi: 0, shots: 0, goals: 0, points: 0, games: 0 };
      for (const g of games) {
        if (wa.toi >= w.quota) break;
        wa.toi += toiToMinutes(g.toi);
        wa.shots += g.shots ?? 0;
        wa.goals += g.goals ?? 0;
        wa.points += g.points ?? 0;
        wa.games++;
      }
      if (wa.games < 2) continue;
      await upsertWindow(db, pid, w.key, skaterLine(wa), Math.round(wa.toi));
    }
  } else {
    const a: GoalieAgg = { toi: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, games: 0, starts: 0 };
    for (const g of games) {
      a.toi += toiToMinutes(g.toi);
      a.shotsAgainst += g.shotsAgainst ?? 0;
      a.goalsAgainst += g.goalsAgainst ?? 0;
      a.saves += (g.shotsAgainst ?? 0) - (g.goalsAgainst ?? 0);
      a.games++;
      a.starts += g.gamesStarted ?? 0;
    }
    const season = { ...goalieLine(a), g: a.games, gs: a.starts };
    await upsertSeason(db, pid, season);
    for (const w of NHL_WINDOWS) {
      const wa: GoalieAgg = { toi: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, games: 0, starts: 0 };
      for (const g of games) {
        if (wa.toi >= w.quota) break;
        wa.toi += toiToMinutes(g.toi);
        wa.shotsAgainst += g.shotsAgainst ?? 0;
        wa.goalsAgainst += g.goalsAgainst ?? 0;
        wa.saves += (g.shotsAgainst ?? 0) - (g.goalsAgainst ?? 0);
        wa.games++;
      }
      if (wa.games < 1) continue;
      await upsertWindow(db, pid, w.key, goalieLine(wa), Math.round(wa.toi));
    }
  }

  return { maxDate: games[0].gameDate ?? "" };
}

async function upsertSeason(db: ReturnType<typeof getDb>, playerId: number, line: any) {
  const json = JSON.stringify(line);
  await db
    .insert(seasonStats)
    .values({ playerId, statsJson: json, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { statsJson: json, updatedAt: new Date() } });
}

async function upsertWindow(
  db: ReturnType<typeof getDb>,
  playerId: number,
  window: string,
  line: any,
  sample: number,
) {
  const json = JSON.stringify(line);
  await db
    .insert(windowStats)
    .values({ playerId, window, statsJson: json, sample, computedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { statsJson: json, sample, computedAt: new Date() } });
}
