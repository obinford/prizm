// Mappers for the Supabase Statcast warehouse (rtm-data-warehouse).
// sv_* tables are MLB-only; NHL keeps flowing from the MySQL ingestion.

import { pg, pgGet } from "./client";
import type { PropMarket } from "@contracts/types";

// ── sv_stat_cache ────────────────────────────────────────────────────────────

export interface SvStatRow {
  side: "batter" | "pitcher";
  split: string; // season | l30 | l60 | l90 | l120 | home | away | vsL | vsR
  mlbam_id: number;
  full_name: string;
  hand: string | null;
  team_id: number | null;
  g: number | null;
  tbf: number | null;
  pa: number | null;
  k_pct: number | null; // NOTE: percentages are 0-100 numerics in sv_stat_cache
  bb_pct: number | null;
  csw_pct: number | null;
  swstr_pct: number | null;
  whiff_pct: number | null;
  zone_pct: number | null;
  avg_ev: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  gb_pct: number | null;
  fb_pct: number | null;
  ld_pct: number | null;
  xba: number | null;
  xslg: number | null;
  xwoba: number | null;
  woba: number | null;
  babip: number | null;
  iso: number | null;
  slg: number | null;
  avg: number | null;
  hr_pct: number | null;
  bbe: number | null;
  built_at: string;
}

/** Additive Statcast metrics merged onto pitcher/batter windows + season.
 * Percent fields are 0-100 (sv native scale); rate stats are 0-1. */
export interface SavantMetrics {
  xwoba: number | null;
  xba: number | null;
  xslg: number | null;
  barrelPct: number | null; // 0-100
  hardHitPct: number | null; // 0-100
  whiffPct: number | null; // 0-100
  cswPct: number | null; // 0-100
  avgEv: number | null; // mph
  woba: number | null;
  babip: number | null;
}

export type SavantSplitKey = "season" | "l30" | "l60" | "l90" | "l120" | "vsL" | "vsR" | "home" | "away";

/** Split line for the split chips (vsL/vsR/home/away) — sv-sourced. */
export interface SavantSplitLine extends SavantMetrics {
  pa: number | null;
  kPct: number | null; // 0-100
  bbPct: number | null; // 0-100
}

function toMetrics(r: SvStatRow): SavantMetrics {
  return {
    xwoba: r.xwoba,
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

export function toSplitLine(r: SvStatRow): SavantSplitLine {
  return { ...toMetrics(r), pa: r.side === "pitcher" ? r.tbf : r.pa, kPct: r.k_pct, bbPct: r.bb_pct };
}

export type StatIndex = Map<string, SvStatRow>; // key: `${mlbamId}:${split}`

/** Full sv_stat_cache index (both sides), cached 5 min by the pg client. */
export async function getStatIndex(): Promise<StatIndex> {
  const rows = await pg<SvStatRow>("sv_stat_cache").select("*").all();
  const idx: StatIndex = new Map();
  for (const r of rows) idx.set(`${r.mlbam_id}:${r.split}`, r);
  return idx;
}

export function statFor(idx: StatIndex, mlbamId: number, split: SavantSplitKey): SvStatRow | undefined {
  return idx.get(`${mlbamId}:${split}`);
}

// ── sv_odds ──────────────────────────────────────────────────────────────────

export interface SvOddsRow {
  game_date: string;
  player_name: string;
  norm_name: string | null;
  team: string | null;
  prop_type: string;
  line: number;
  over_odds: number | null; // American odds
  under_odds: number | null;
  over_book: string | null;
  under_book: string | null;
  cons_over: number | null;
  cons_under: number | null;
  books: number | null;
  mlbam_id: number | null;
  pulled_at: string;
}

/** Real prop odds mapped for the props router (sv_odds → PropLine additives). */
export interface RealPropOdds {
  playerMlbam: number;
  playerName: string;
  team: string;
  propType: string; // raw sv prop_type, e.g. 'strikeouts thrown'
  gameDate: string;
  line: number;
  overOdds: number | null;
  underOdds: number | null;
  overBook: string | null;
  underBook: string | null;
  consOver: number | null;
  consUnder: number | null;
  books: number | null;
  pulledAt: string;
}

function toRealPropOdds(r: SvOddsRow): RealPropOdds | null {
  if (r.mlbam_id == null || !r.team) return null;
  return {
    playerMlbam: r.mlbam_id,
    playerName: r.player_name,
    team: r.team,
    propType: r.prop_type,
    gameDate: r.game_date,
    line: Number(r.line),
    overOdds: r.over_odds,
    underOdds: r.under_odds,
    overBook: r.over_book,
    underBook: r.under_book,
    consOver: r.cons_over,
    consUnder: r.cons_under,
    books: r.books,
    pulledAt: r.pulled_at,
  };
}

/** sv_odds rows for the most recent game_date with coverage. */
export async function getLatestOdds(): Promise<RealPropOdds[]> {
  const latest = await pgGet<{ game_date: string }[]>("sv_odds?select=game_date&order=game_date.desc&limit=1");
  if (!latest.length) return [];
  const date = latest[0].game_date;
  const rows = await pg<SvOddsRow>("sv_odds").select("*").eq("game_date", date).all();
  return rows.map(toRealPropOdds).filter((r): r is RealPropOdds => r !== null);
}

// ── sv prop types → Prizm markets + game-log accessors ───────────────────────
// Game logs store raw statsapi `stat` lines (see api/ingest/mlb.ts):
//   batting:  atBats, hits, doubles, triples, homeRuns, rbi, runs,
//             baseOnBalls, stolenBases, totalBases, ...
//   pitching: strikeOuts, hits, outs, inningsPitched, ...

export interface SvPropMapping {
  market: PropMarket;
  /** Value of the mapped stat for one game-log `stat` line; null = skip game. */
  stat: (s: any) => number | null;
}

const singles = (s: any) =>
  (s.hits ?? 0) - (s.doubles ?? 0) - (s.triples ?? 0) - (s.homeRuns ?? 0);

export const SV_PROP_MAP: Record<string, SvPropMapping> = {
  "strikeouts thrown": { market: "Strikeouts", stat: (s) => s.strikeOuts ?? null },
  "hits allowed": { market: "Hits Allowed", stat: (s) => s.hits ?? null },
  outs: {
    market: "Outs",
    stat: (s) =>
      s.outs ??
      (typeof s.inningsPitched === "string"
        ? (() => {
            const [w, f] = s.inningsPitched.split(".");
            return Number(w) * 3 + Number(f ?? 0);
          })()
        : null),
  },
  "total bases": { market: "Total Bases", stat: (s) => s.totalBases ?? null },
  hits: { market: "Hits", stat: (s) => s.hits ?? null },
  singles: { market: "Singles", stat: (s) => (s.hits == null ? null : singles(s)) },
  doubles: { market: "Doubles", stat: (s) => s.doubles ?? null },
  "home runs": { market: "Home Runs", stat: (s) => s.homeRuns ?? null },
  rbis: { market: "RBIs", stat: (s) => s.rbi ?? null },
  runsBatter: { market: "Runs", stat: (s) => s.runs ?? null },
  "Hits + Runs + RBIs": {
    market: "Hits + Runs + RBIs",
    stat: (s) => (s.hits == null ? null : (s.hits ?? 0) + (s.runs ?? 0) + (s.rbi ?? 0)),
  },
  walksBatter: { market: "Walks", stat: (s) => s.baseOnBalls ?? null },
  "stolen bases": { market: "Stolen Bases", stat: (s) => s.stolenBases ?? null },
};

/** American odds → implied probability. */
export function impliedProb(american: number | null): number | null {
  if (american == null || american === 0) return null;
  return american < 0 ? -american / (-american + 100) : 100 / (american + 100);
}

// ── sv_slate ─────────────────────────────────────────────────────────────────

export interface SvSlateRow {
  game_pk: number;
  game_date: string;
  start_utc: string;
  venue: string | null;
  away_abbr: string;
  home_abbr: string;
  away_name: string;
  home_name: string;
  away_sp_id: number | null;
  away_sp_name: string | null;
  away_sp_hand: string | null;
  home_sp_id: number | null;
  home_sp_name: string | null;
  home_sp_hand: string | null;
}

/** MLB slate from sv_slate: today's ET date, else the most recent date with games. */
export async function getSavantSlate(): Promise<{ date: string; games: SvSlateRow[] }> {
  const todayEt = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  let rows = await pg<SvSlateRow>("sv_slate").select("*").eq("game_date", todayEt).order("start_utc").all();
  let date = todayEt;
  if (rows.length === 0) {
    const latest = await pgGet<{ game_date: string }[]>("sv_slate?select=game_date&order=game_date.desc&limit=1");
    if (!latest.length) return { date: todayEt, games: [] };
    date = latest[0].game_date;
    rows = await pg<SvSlateRow>("sv_slate").select("*").eq("game_date", date).order("start_utc").all();
  }
  return { date, games: rows };
}

/** statsapi team_id ↔ abbreviation (stable MLBAM ids; matches MySQL teams). */
export const TEAM_ID_TO_ABBR: Record<number, string> = {
  108: "LAA", 109: "AZ", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN",
  114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC", 119: "LAD",
  120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};

// ── warehouse freshness (ingest.lastRuns 'savant' pseudo-row) ────────────────

export interface SavantFreshness {
  statBuiltAt: string | null;
  oddsPulledAt: string | null;
}

export async function getSavantFreshness(): Promise<SavantFreshness> {
  const [stat, odds] = await Promise.all([
    pgGet<{ built_at: string }[]>("sv_stat_cache?select=built_at&order=built_at.desc&limit=1"),
    pgGet<{ pulled_at: string }[]>("sv_odds?select=pulled_at&order=pulled_at.desc&limit=1"),
  ]);
  return {
    statBuiltAt: stat[0]?.built_at ?? null,
    oddsPulledAt: odds[0]?.pulled_at ?? null,
  };
}
