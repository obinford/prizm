// Shared loaders: assemble contract shapes (contracts/prizm.ts) from DB rows.

import { getDb } from "./queries/connection";
import { players, seasonStats, windowStats, type Player } from "@db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type {
  Batter, BatterWindow, Goalie, GoalieWindow, MlbWindowKey, NhlWindowKey,
  Pitcher, PitcherWindow, SavantSplits, SavantWindowFields, Skater, SkaterWindow,
} from "@contracts/types";
import { MLB_WINDOW_KEYS, NHL_WINDOW_KEYS } from "@contracts/types";
import { getStatIndex, statFor, toSplitLine, type StatIndex, type SvStatRow } from "./supabase/savant";

const EMPTY_PITCHER_WINDOW: PitcherWindow = { bf: 0, era: 0, whip: 0, kPct: 0, bbPct: 0, xwoba: 0 };
const EMPTY_BATTER_WINDOW: BatterWindow = { pa: 0, avg: 0, obp: 0, slg: 0, iso: 0, xbh: 0, tb: 0 };
const EMPTY_GOALIE_WINDOW: GoalieWindow = { toi: 0, svPct: 0, gsax: null, xgAgainst: null };
const EMPTY_SKATER_WINDOW: SkaterWindow = { toi: 0, sog: 0, goals: 0, points: 0 };

/** Load players + season + windows for a sport/role set, assembled into the
 * frontend modules' exact shapes. */
export async function loadPlayers(role: "pitcher" | "batter" | "goalie" | "skater") {
  const db = getDb();
  const rows = await db
    .select()
    .from(players)
    .where(and(eq(players.role, role), eq(players.active, true)));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [seasons, windows] = await Promise.all([
    db.select().from(seasonStats).where(inArray(seasonStats.playerId, ids)),
    db.select().from(windowStats).where(inArray(windowStats.playerId, ids)),
  ]);
  const seasonByPid = new Map(seasons.map((s) => [s.playerId, JSON.parse(s.statsJson)]));
  const windowsByPid = new Map<number, Map<string, any>>();
  for (const w of windows) {
    if (!windowsByPid.has(w.playerId)) windowsByPid.set(w.playerId, new Map());
    windowsByPid.get(w.playerId)!.set(w.window, JSON.parse(w.statsJson));
  }
  const out = rows.map((r) => assemble(r, seasonByPid.get(r.id) ?? {}, windowsByPid.get(r.id)));
  if (role === "pitcher" || role === "batter") {
    await mergeSavant(rows, out);
  }
  return out;
}

// ── Supabase Statcast merge (MLB only) ───────────────────────────────────────
// Links MySQL players.extId (= MLBAM id) to sv_stat_cache.mlbam_id. Where sv
// coverage exists the real Statcast xwOBA REPLACES the estimated `xwoba`;
// additive sv fields (xwobaReal, xba, xslg, barrelPct, hardHitPct, whiffPct,
// cswPct, avgEv, woba, babip) and vsL/vsR/home/away split chips are attached.
// On any warehouse failure the MySQL-assembled players are returned untouched.

const SV_SPLIT_FOR_WINDOW: Record<MlbWindowKey, "l30" | "l60" | "l90" | "l120"> = {
  L30: "l30",
  L60: "l60",
  L90: "l90",
  L120: "l120",
};

function svWindowFields(r: SvStatRow): SavantWindowFields {
  return {
    xwobaReal: r.xwoba,
    xba: r.xba,
    xslg: r.xslg,
    barrelPct: r.barrel_pct,
    hardHitPct: r.hard_hit_pct,
    whiffPct: r.whiff_pct,
    cswPct: r.csw_pct,
    avgEv: r.avg_ev,
    woba: r.woba,
    babip: r.babip,
  };
}

function svSplits(idx: StatIndex, mlbamId: number): SavantSplits | undefined {
  const splits: SavantSplits = {};
  for (const key of ["vsL", "vsR", "home", "away"] as const) {
    const row = statFor(idx, mlbamId, key);
    if (row) splits[key] = toSplitLine(row);
  }
  return Object.keys(splits).length ? splits : undefined;
}

export function mergeSavantWithIndex(rows: Pick<Player, "extId">[], assembled: any[], idx: StatIndex) {
  for (let i = 0; i < rows.length; i++) {
    const mlbamId = rows[i].extId;
    const p = assembled[i];
    if (!p || (p.kind !== "pitcher" && p.kind !== "batter")) continue;
    const season = statFor(idx, mlbamId, "season");
    if (season) {
      if (season.xwoba != null) p.xwoba = season.xwoba; // sv xwOBA authoritative
      Object.assign(p, svWindowFields(season));
      const splits = svSplits(idx, mlbamId);
      if (splits) p.splits = splits;
    }
    for (const w of MLB_WINDOW_KEYS) {
      const sv = statFor(idx, mlbamId, SV_SPLIT_FOR_WINDOW[w]);
      if (!sv) continue;
      const win = p.windows?.[w];
      if (!win) continue;
      if (p.kind === "pitcher" && sv.xwoba != null) win.xwoba = sv.xwoba;
      if (p.kind === "batter" && sv.xwoba != null) win.xwoba = sv.xwoba;
      Object.assign(win, svWindowFields(sv));
    }
  }
}

async function mergeSavant(rows: Player[], assembled: any[]) {
  try {
    const idx = await getStatIndex();
    mergeSavantWithIndex(rows, assembled, idx);
  } catch (err) {
    console.warn("[savant] stat_cache merge skipped:", (err as Error).message);
  }
}

function assemble(row: Player, season: any, winMap?: Map<string, any>) {
  const get = (k: string) => winMap?.get(k);
  if (row.role === "pitcher") {
    const windows = Object.fromEntries(
      MLB_WINDOW_KEYS.map((k) => [k, { ...EMPTY_PITCHER_WINDOW, ...(get(k) ?? {}) }]),
    ) as Record<MlbWindowKey, PitcherWindow>;
    const p: Pitcher = {
      id: row.slug,
      sport: "mlb",
      kind: "pitcher",
      name: row.name,
      team: row.team,
      throws: (row.hand === "L" ? "L" : "R") as "L" | "R",
      role: season.role === "RP" ? "RP" : "SP",
      era: season.era ?? 0,
      whip: season.whip ?? 0,
      kPct: season.kPct ?? 0,
      bbPct: season.bbPct ?? 0,
      xwoba: season.xwoba ?? 0,
      windows,
    };
    return p;
  }
  if (row.role === "batter") {
    const windows = Object.fromEntries(
      MLB_WINDOW_KEYS.map((k) => [k, { ...EMPTY_BATTER_WINDOW, ...(get(k) ?? {}) }]),
    ) as Record<MlbWindowKey, BatterWindow>;
    const b: Batter = {
      id: row.slug,
      sport: "mlb",
      kind: "batter",
      name: row.name,
      team: row.team,
      pos: row.pos,
      bats: (["L", "R", "S"].includes(row.hand) ? row.hand : "R") as "L" | "R" | "S",
      avg: season.avg ?? 0,
      obp: season.obp ?? 0,
      slg: season.slg ?? 0,
      iso: season.iso ?? 0,
      xbh: season.xbh ?? 0,
      tb: season.tb ?? 0,
      windows,
    };
    return b;
  }
  if (row.role === "goalie") {
    const windows = Object.fromEntries(
      NHL_WINDOW_KEYS.map((k) => [k, { ...EMPTY_GOALIE_WINDOW, ...(get(k) ?? {}) }]),
    ) as Record<NhlWindowKey, GoalieWindow>;
    const g: Goalie = {
      id: row.slug,
      sport: "nhl",
      kind: "goalie",
      name: row.name,
      team: row.team,
      catches: (row.hand === "R" ? "R" : "L") as "L" | "R",
      svPct: season.svPct ?? 0,
      gsax: season.gsax ?? null,
      xgAgainst: season.xgAgainst ?? null,
      windows,
    };
    return g;
  }
  const windows = Object.fromEntries(
    NHL_WINDOW_KEYS.map((k) => [k, { ...EMPTY_SKATER_WINDOW, ...(get(k) ?? {}) }]),
  ) as Record<NhlWindowKey, SkaterWindow>;
  const s: Skater = {
    id: row.slug,
    sport: "nhl",
    kind: "skater",
    name: row.name,
    team: row.team,
    pos: (["C", "LW", "RW", "D"].includes(row.pos) ? row.pos : "C") as "C" | "LW" | "RW" | "D",
    shoots: (row.hand === "R" ? "R" : "L") as "L" | "R",
    sog: season.sog ?? 0,
    goals: season.goals ?? 0,
    points: season.points ?? 0,
    windows,
  };
  return s;
}

export async function loadPlayerBySlug(sport: "mlb" | "nhl", slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(players)
    .where(and(eq(players.sport, sport), eq(players.slug, slug)))
    .limit(1);
  if (!row) return undefined;
  const [season] = await db.select().from(seasonStats).where(eq(seasonStats.playerId, row.id)).limit(1);
  const winRows = await db.select().from(windowStats).where(eq(windowStats.playerId, row.id));
  const winMap = new Map(winRows.map((w) => [w.window, JSON.parse(w.statsJson)]));
  const assembled = assemble(row, season ? JSON.parse(season.statsJson) : {}, winMap);
  if (row.role === "pitcher" || row.role === "batter") {
    await mergeSavant([row], [assembled]);
  }
  return assembled;
}
