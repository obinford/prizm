// Verification script: row counts + recompute one L30 window from the source
// API by hand and diff against windowStats.
import "dotenv/config";
import { getDb } from "../queries/connection";
import { players, windowStats, gameLogs, seasonStats, slateGames, props, teamStats, ingestionRuns, angles, follows } from "@db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const API = "https://statsapi.mlb.com/api/v1";

function ipToOuts(ip: any): number {
  const s = String(ip ?? "0");
  const [w, f] = s.split(".");
  return parseInt(w || "0", 10) * 3 + parseInt(f || "0", 10);
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

async function counts() {
  const db = getDb();
  const tables = { players, season_stats: seasonStats, window_stats: windowStats, game_logs: gameLogs, slate_games: slateGames, props, team_stats: teamStats, ingestion_runs: ingestionRuns, angles, follows };
  for (const [name, t] of Object.entries(tables)) {
    const [row] = await db.select({ c: sql<number>`count(*)` }).from(t as any);
    console.log(`${name}: ${row.c}`);
  }
  const byRole = await db.select({ role: players.role, sport: players.sport, c: sql<number>`count(*)` }).from(players).groupBy(players.sport, players.role);
  console.log("players by sport/role:", JSON.stringify(byRole));
}

async function spotCheckBatter(slugId: string) {
  const db = getDb();
  const [p] = await db.select().from(players).where(and(eq(players.sport, "mlb"), eq(players.slug, slugId))).limit(1);
  if (!p) throw new Error("player not found " + slugId);
  const res = await fetch(`${API}/people/${p.extId}/stats?stats=gameLog&group=hitting&season=2026`);
  const data: any = await res.json();
  const splits = (data.stats?.[0]?.splits ?? []).sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
  // recompute L30 PA window newest-first
  let pa = 0, ab = 0, h = 0, tb = 0, dbl = 0, trp = 0, hr = 0, bb = 0, hbp = 0, sf = 0, games = 0;
  for (const g of splits) {
    if (pa >= 30) break;
    const s = g.stat;
    pa += s.plateAppearances ?? 0; ab += s.atBats ?? 0; h += s.hits ?? 0; tb += s.totalBases ?? 0;
    dbl += s.doubles ?? 0; trp += s.triples ?? 0; hr += s.homeRuns ?? 0;
    bb += s.baseOnBalls ?? 0; hbp += s.hitByPitch ?? 0; sf += s.sacFlies ?? 0; games++;
  }
  const avg = ab > 0 ? h / ab : 0;
  const obp = ab + bb + hbp + sf > 0 ? (h + bb + hbp) / (ab + bb + hbp + sf) : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const expected = {
    pa, avg: r3(avg), obp: r3(obp), slg: r3(slg), iso: r3(slg - avg),
    xbh: r2((dbl + trp + hr) / Math.max(1, games)), tb: r2(tb / Math.max(1, games)),
  };
  const [w] = await db.select().from(windowStats).where(and(eq(windowStats.playerId, p.id), eq(windowStats.window, "L30"))).limit(1);
  const stored = JSON.parse(w.statsJson);
  console.log(`\n[batter] ${p.name} (${slugId}) — games in window: ${games}, through ${splits[0]?.date}`);
  console.log("recomputed:", JSON.stringify(expected));
  console.log("stored:    ", JSON.stringify(stored));
  const diffs = Object.entries(expected).filter(([k, v]) => Math.abs((stored as any)[k] - (v as number)) > 0.002);
  console.log(diffs.length === 0 ? "MATCH ✔ (within rounding)" : `DIFF ✘: ${JSON.stringify(diffs)}`);
}

async function spotCheckPitcher(slugId: string) {
  const db = getDb();
  const [p] = await db.select().from(players).where(and(eq(players.sport, "mlb"), eq(players.slug, slugId))).limit(1);
  if (!p) throw new Error("player not found " + slugId);
  const res = await fetch(`${API}/people/${p.extId}/stats?stats=gameLog&group=pitching&season=2026`);
  const data: any = await res.json();
  const splits = (data.stats?.[0]?.splits ?? []).sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
  let bf = 0, outs = 0, er = 0, h = 0, bb = 0, ibb = 0, so = 0, games = 0;
  for (const g of splits) {
    if (bf >= 30) break;
    const s = g.stat;
    bf += s.battersFaced ?? 0; outs += s.outs ?? ipToOuts(s.inningsPitched);
    er += s.earnedRuns ?? 0; h += s.hits ?? 0; bb += s.baseOnBalls ?? 0;
    ibb += s.intentionalWalks ?? 0; so += s.strikeOuts ?? 0; games++;
  }
  const ip = outs / 3;
  const expected = {
    bf, era: r2(ip > 0 ? (9 * er) / ip : 0), whip: r2(ip > 0 ? (h + bb) / ip : 0),
    kPct: r3(bf > 0 ? so / bf : 0), bbPct: r3(bf > 0 ? (bb + ibb) / bf : 0),
  };
  const [w] = await db.select().from(windowStats).where(and(eq(windowStats.playerId, p.id), eq(windowStats.window, "L30"))).limit(1);
  const stored = JSON.parse(w.statsJson);
  console.log(`\n[pitcher] ${p.name} (${slugId}) — games in window: ${games}, through ${splits[0]?.date}`);
  console.log("recomputed:", JSON.stringify(expected));
  console.log("stored:    ", JSON.stringify({ bf: stored.bf, era: stored.era, whip: stored.whip, kPct: stored.kPct, bbPct: stored.bbPct }));
  const diffs = Object.entries(expected).filter(([k, v]) => Math.abs((stored as any)[k] - (v as number)) > 0.005);
  console.log(diffs.length === 0 ? "MATCH ✔ (within rounding)" : `DIFF ✘: ${JSON.stringify(diffs)}`);
}

const mode = process.argv[2] ?? "all";
if (mode === "counts" || mode === "all") await counts();
if (mode === "spot" || mode === "all") {
  await spotCheckBatter(process.argv[3] ?? "bobby-witt-jr");
  await spotCheckPitcher(process.argv[4] ?? "tarik-skubal");
}
process.exit(0);
