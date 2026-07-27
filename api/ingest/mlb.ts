// MLB ingestion — source: https://statsapi.mlb.com/api/v1 (public, no key).
//
// Strategy: for each of the 30 MLB teams we pull the fullSeason roster FOUR
// times with hydrates (season hitting, season pitching, gameLog hitting,
// gameLog pitching) — 4 calls/team covers every rostered player's season line
// AND full game logs. Rolling windows are computed from the real game logs:
//   batters — last 30/60/90/120 PLATE APPEARANCES (aggregate newest-first)
//   pitchers — last 30/60/90/120 BATTERS FACED
// Team bullpen stats are aggregated from reliever game logs into teamStats.
//
// Caveat: statsapi has no expected stats — `xwoba` is a documented ESTIMATE
// derived from OPS-against: xwoba ~= 0.444 * opsAgainst (league avg .720 OPS
// maps to ~.320 xwOBA).

import { getDb } from "../queries/connection";
import { gameLogs, players, seasonStats, teamStats, windowStats } from "@db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { fetchJson, ipToOuts, round2, round3, slug, startRun, finishRun } from "./common";

const API = "https://statsapi.mlb.com/api/v1";
const SEASON = 2026;

// League-average OPS against → xwOBA mapping constant (documented estimate).
const XWOBA_PER_OPS = 0.32 / 0.72;

const MLB_WINDOWS = [
  { key: "L30", quota: 30 },
  { key: "L60", quota: 60 },
  { key: "L90", quota: 90 },
  { key: "L120", quota: 120 },
] as const;

// ── Aggregation helpers ──────────────────────────────────────────────────────

interface BatAgg {
  pa: number; ab: number; h: number; doubles: number; triples: number; hr: number;
  bb: number; ibb: number; hbp: number; sf: number; tb: number; games: number;
}

function emptyBat(): BatAgg {
  return { pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, ibb: 0, hbp: 0, sf: 0, tb: 0, games: 0 };
}

function addBat(a: BatAgg, s: any) {
  a.pa += s.plateAppearances ?? 0;
  a.ab += s.atBats ?? 0;
  a.h += s.hits ?? 0;
  a.doubles += s.doubles ?? 0;
  a.triples += s.triples ?? 0;
  a.hr += s.homeRuns ?? 0;
  a.bb += s.baseOnBalls ?? 0;
  a.ibb += s.intentionalWalks ?? 0;
  a.hbp += s.hitByPitch ?? 0;
  a.sf += s.sacFlies ?? 0;
  a.tb += s.totalBases ?? 0;
  a.games += 1;
}

function batLine(a: BatAgg) {
  const avg = a.ab > 0 ? a.h / a.ab : 0;
  const obpDenom = a.ab + a.bb + a.hbp + a.sf;
  const obp = obpDenom > 0 ? (a.h + a.bb + a.hbp) / obpDenom : 0;
  const slg = a.ab > 0 ? a.tb / a.ab : 0;
  const g = Math.max(1, a.games);
  return {
    avg: round3(avg),
    obp: round3(obp),
    slg: round3(slg),
    iso: round3(slg - avg),
    xbh: round2((a.doubles + a.triples + a.hr) / g),
    tb: round2(a.tb / g),
  };
}

interface PitAgg {
  bf: number; outs: number; er: number; h: number; bb: number; ibb: number;
  hbp: number; sf: number; so: number; ab: number; tb: number; games: number; gs: number;
}

function emptyPit(): PitAgg {
  return { bf: 0, outs: 0, er: 0, h: 0, bb: 0, ibb: 0, hbp: 0, sf: 0, so: 0, ab: 0, tb: 0, games: 0, gs: 0 };
}

function addPit(a: PitAgg, s: any) {
  a.bf += s.battersFaced ?? 0;
  a.outs += s.outs ?? ipToOuts(s.inningsPitched);
  a.er += s.earnedRuns ?? 0;
  a.h += s.hits ?? 0;
  a.bb += s.baseOnBalls ?? 0;
  a.ibb += s.intentionalWalks ?? 0;
  a.hbp += s.hitByPitch ?? s.hitBatsmen ?? 0;
  a.sf += s.sacFlies ?? 0;
  a.so += s.strikeOuts ?? 0;
  a.ab += s.atBats ?? 0;
  a.tb += s.totalBases ?? 0;
  a.games += 1;
  a.gs += s.gamesStarted ?? 0;
}

function pitLine(a: PitAgg) {
  const ip = a.outs / 3;
  const era = ip > 0 ? (9 * a.er) / ip : 0;
  const whip = ip > 0 ? (a.h + a.bb) / ip : 0;
  const kPct = a.bf > 0 ? a.so / a.bf : 0;
  const bbPct = a.bf > 0 ? (a.bb + a.ibb) / a.bf : 0; // baseOnBalls excludes IBB in statsapi
  const obpDenom = a.ab + a.bb + a.hbp + a.sf;
  const obpAgainst = obpDenom > 0 ? (a.h + a.bb + a.hbp) / obpDenom : 0.32;
  const slgAgainst = a.ab > 0 ? a.tb / a.ab : 0.4;
  const xwoba = Math.min(0.5, Math.max(0.15, (obpAgainst + slgAgainst) * XWOBA_PER_OPS));
  return {
    era: round2(era),
    whip: round2(whip),
    kPct: round3(kPct),
    bbPct: round3(bbPct),
    xwoba: round3(xwoba),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function ingestMlb(fromIdx = 0, toIdx = 30): Promise<{ rows: number; message: string }> {
  const db = getDb();
  const runId = await startRun("mlb");
  let rows = 0;
  try {
    // 1) teams
    const teamsRes = await fetchJson(`${API}/teams?sportId=1&season=${SEASON}`);
    const teams: any[] = teamsRes.teams ?? [];
    console.log(`[mlb] ${teams.length} teams`);

    // team → reliever season aggregates (for bullpen teamStats)
    const bullpen = new Map<string, PitAgg>();
    const bullpenArms = new Map<string, Set<number>>();

    let nPitchers = 0;
    let nBatters = 0;
    let maxGameDate = "";

    for (const team of teams.slice(fromIdx, toIdx)) {
      const teamId = team.id;
      const abbr: string = team.abbreviation ?? team.teamCode?.toUpperCase() ?? "???";

      // 4 hydrated roster calls per team: season + gameLog × hitting + pitching
      const [rosHitSeason, rosPitSeason, rosHitLog, rosPitLog] = await Promise.all([
        fetchJson(`${API}/teams/${teamId}/roster?rosterType=fullSeason&season=${SEASON}&hydrate=person(stats(type=season,group=hitting,season=${SEASON}))`),
        fetchJson(`${API}/teams/${teamId}/roster?rosterType=fullSeason&season=${SEASON}&hydrate=person(stats(type=season,group=pitching,season=${SEASON}))`),
        fetchJson(`${API}/teams/${teamId}/roster?rosterType=fullSeason&season=${SEASON}&hydrate=person(stats(type=gameLog,group=hitting,season=${SEASON}))`),
        fetchJson(`${API}/teams/${teamId}/roster?rosterType=fullSeason&season=${SEASON}&hydrate=person(stats(type=gameLog,group=pitching,season=${SEASON}))`),
      ]);

      const roster: any[] = rosHitSeason.roster ?? [];
      const hitSeasonById = indexRosterStats(rosHitSeason);
      const pitSeasonById = indexRosterStats(rosPitSeason);
      const hitLogById = indexRosterStats(rosHitLog);
      const pitLogById = indexRosterStats(rosPitLog);

      for (const entry of roster) {
        const person = entry.person;
        const extId: number = person.id;
        const name: string = person.fullName;
        const posAbbr: string = person.primaryPosition?.abbreviation ?? entry.position?.abbreviation ?? "";
        const isPitcher = posAbbr === "P";
        const hitSeason = hitSeasonById.get(extId)?.[0]?.stat;
        const pitSeason = pitSeasonById.get(extId)?.[0]?.stat;
        const hitLog = (hitLogById.get(extId) ?? []).filter((s) => s.stat?.gamesPlayed);
        const pitLog = (pitLogById.get(extId) ?? []).filter((s) => s.stat?.gamesPlayed);

        // Qualify: pitchers ≥5 games pitched; batters ≥5 games AND ≥30 PA.
        let role: "pitcher" | "batter" | null = null;
        if (isPitcher) {
          const gp = pitSeason?.gamesPitched ?? pitLog.length;
          if (gp >= 5 && pitLog.length >= 3) role = "pitcher";
        } else {
          const gp = hitSeason?.gamesPlayed ?? hitLog.length;
          const pa = hitSeason?.plateAppearances ?? 0;
          if (gp >= 5 && pa >= 30 && hitLog.length >= 3) role = "batter";
        }
        // Two-way players (e.g. Ohtani as P): also carry a batting line — keep
        // primary role only (documented caveat).
        if (!role) continue;

        const hand = isPitcher
          ? person.pitchHand?.code ?? ""
          : person.batSide?.code ?? "";

        // upsert player
        let playerSlug = slug(name);
        const existing = await db
          .select()
          .from(players)
          .where(and(eq(players.sport, "mlb"), eq(players.extId, extId)))
          .limit(1);
        if (existing.length > 0) {
          playerSlug = existing[0].slug;
          await db
            .update(players)
            .set({ name, team: abbr, pos: posAbbr, hand, role, active: true })
            .where(eq(players.id, existing[0].id));
        } else {
          // ensure slug uniqueness within sport
          const clash = await db
            .select({ id: players.id })
            .from(players)
            .where(and(eq(players.sport, "mlb"), eq(players.slug, playerSlug)))
            .limit(1);
          if (clash.length > 0) playerSlug = `${playerSlug}-${extId}`;
          await db.insert(players).values({
            sport: "mlb", extId, slug: playerSlug, name, team: abbr, pos: posAbbr, hand, role, active: true,
          });
        }
        const [playerRow] = await db
          .select()
          .from(players)
          .where(and(eq(players.sport, "mlb"), eq(players.extId, extId)))
          .limit(1);
        const pid = playerRow.id;

        if (role === "batter") {
          nBatters++;
          const seasonLine = pitOrBatSeason("batter", hitSeason, hitLog);
          await upsertSeason(db, pid, seasonLine);
          await upsertLogs(db, pid, hitLog, "hitting");
          const newest = [...hitLog].sort((a, b) => (a.date < b.date ? 1 : -1));
          if (newest[0]?.date && newest[0].date > maxGameDate) maxGameDate = newest[0].date;
          await upsertBatterWindows(db, pid, newest);
        } else {
          nPitchers++;
          const seasonLine = pitOrBatSeason("pitcher", pitSeason, pitLog);
          await upsertSeason(db, pid, seasonLine);
          await upsertLogs(db, pid, pitLog, "pitching");
          const newest = [...pitLog].sort((a, b) => (a.date < b.date ? 1 : -1));
          if (newest[0]?.date && newest[0].date > maxGameDate) maxGameDate = newest[0].date;
          await upsertPitcherWindows(db, pid, newest);
          // bullpen aggregate: reliever = GS < 50% of appearances
          const gs = pitSeason?.gamesStarted ?? 0;
          const gp = pitSeason?.gamesPitched ?? pitLog.length;
          if (gs < gp * 0.5) {
            const agg = bullpen.get(abbr) ?? emptyPit();
            for (const g of pitLog) addPit(agg, g.stat);
            bullpen.set(abbr, agg);
            if (!bullpenArms.has(abbr)) bullpenArms.set(abbr, new Set());
            bullpenArms.get(abbr)!.add(extId);
          }
        }
        rows++;
      }
      console.log(`[mlb] ${abbr} done (pitchers=${nPitchers} batters=${nBatters})`);
    }

    // team bullpen stats
    for (const [abbr, agg] of bullpen) {
      const line = pitLine(agg);
      const payload = {
        team: abbr,
        relievers: bullpenArms.get(abbr)?.size ?? 0,
        appearances: agg.games,
        era: line.era,
        whip: line.whip,
        kPct: line.kPct,
        bbPct: line.bbPct,
      };
      await db
        .insert(teamStats)
        .values({ sport: "mlb", team: abbr, statsJson: JSON.stringify(payload), updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { statsJson: JSON.stringify(payload), updatedAt: new Date() } });
    }

    const message = `season=${SEASON}; pitchers=${nPitchers} batters=${nBatters}; game logs through ${maxGameDate || "n/a"}; xwoba=estimate(0.444*OPS against)`;
    await finishRun(runId, "ok", rows, message);
    return { rows, message };
  } catch (err) {
    await finishRun(runId, "error", rows, (err as Error).message);
    throw err;
  }
}

/** Map personId -> splits array from a hydrated roster response. */
function indexRosterStats(rosterRes: any): Map<number, any[]> {
  const m = new Map<number, any[]>();
  for (const entry of rosterRes.roster ?? []) {
    const p = entry.person;
    const splits = p?.stats?.[0]?.splits;
    if (p?.id && Array.isArray(splits) && splits.length > 0) m.set(p.id, splits);
  }
  return m;
}

function pitOrBatSeason(role: "pitcher" | "batter", seasonStat: any, log: any[]) {
  // Aggregate from the real game logs (deterministic; matches windows).
  if (role === "batter") {
    const a = emptyBat();
    for (const g of log) addBat(a, g.stat);
    const line = batLine(a);
    return { ...line, g: a.games, pa: a.pa };
  }
  const a = emptyPit();
  for (const g of log) addPit(a, g.stat);
  const line = pitLine(a);
  const gp = a.games;
  const gs = a.gs;
  const spRole: "SP" | "RP" = gs >= gp * 0.5 || gs >= 5 ? "SP" : "RP";
  const ip = a.outs / 3;
  return {
    ...line,
    role: spRole,
    g: gp,
    gs,
    ip: Math.round(ip * 10) / 10,
    k9: ip > 0 ? round2((9 * a.so) / ip) : 0,
  };
}

async function upsertSeason(db: ReturnType<typeof getDb>, playerId: number, line: any) {
  const json = JSON.stringify(line);
  await db
    .insert(seasonStats)
    .values({ playerId, statsJson: json, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { statsJson: json, updatedAt: new Date() } });
}

async function upsertLogs(db: ReturnType<typeof getDb>, playerId: number, log: any[], group: string) {
  const rows: { playerId: number; gameDate: string; extGameId: string; statsJson: string }[] = [];
  for (const g of log) {
    const gameDate = g.date ?? "";
    const extGameId = String(g.game?.gamePk ?? "");
    if (!gameDate) continue;
    rows.push({
      playerId,
      gameDate,
      extGameId,
      statsJson: JSON.stringify({
        group,
        date: gameDate,
        opponent: g.opponent?.abbreviation ?? g.opponent?.name ?? "",
        isHome: g.isHome ?? null,
        gamePk: g.game?.gamePk ?? null,
        stat: g.stat,
      }),
    });
  }
  // Batched multi-row inserts — per-row awaits on a remote DB are ~70ms each
  for (let i = 0; i < rows.length; i += 400) {
    const batch = rows.slice(i, i + 400);
    if (batch.length === 0) continue;
    await db
      .insert(gameLogs)
      .values(batch)
      .onDuplicateKeyUpdate({ set: { statsJson: sql`VALUES(statsJson)` } });
  }
}

async function upsertBatterWindows(db: ReturnType<typeof getDb>, playerId: number, newestFirst: any[]) {
  for (const w of MLB_WINDOWS) {
    const agg = emptyBat();
    for (const g of newestFirst) {
      if (agg.pa >= w.quota) break;
      addBat(agg, g.stat);
    }
    if (agg.games === 0) continue; // no real data
    const line = { pa: agg.pa, ...batLine(agg) };
    const json = JSON.stringify(line);
    await db
      .insert(windowStats)
      .values({ playerId, window: w.key, statsJson: json, sample: agg.pa, computedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { statsJson: json, sample: agg.pa, computedAt: new Date() } });
  }
}

async function upsertPitcherWindows(db: ReturnType<typeof getDb>, playerId: number, newestFirst: any[]) {
  for (const w of MLB_WINDOWS) {
    const agg = emptyPit();
    for (const g of newestFirst) {
      if (agg.bf >= w.quota) break;
      addPit(agg, g.stat);
    }
    if (agg.games === 0) continue;
    const line = { bf: agg.bf, ...pitLine(agg) };
    const json = JSON.stringify(line);
    await db
      .insert(windowStats)
      .values({ playerId, window: w.key, statsJson: json, sample: agg.bf, computedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { statsJson: json, sample: agg.bf, computedAt: new Date() } });
  }
}
