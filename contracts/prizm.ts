// Shared Prizm API contracts — these shapes mirror the frontend data modules
// (src/data/mlbPlayers.ts, nhlPlayers.ts, slate.ts, props.ts, pages/angles/store.ts)
// EXACTLY so the frontend can swap seed getters for tRPC calls 1:1.

export type Sport = "mlb" | "nhl";

// ── MLB ─────────────────────────────────────────────────────────────────────

export type MlbWindowKey = "L30" | "L60" | "L90" | "L120";
export const MLB_WINDOW_KEYS: MlbWindowKey[] = ["L30", "L60", "L90", "L120"];

// ── Supabase Statcast warehouse (sv_*) additive fields ──────────────────────
// All *Savant* fields below are sourced from sv_stat_cache (real Statcast).
// Percent fields (barrelPct/hardHitPct/whiffPct/cswPct/kPct/bbPct) are 0-100
// numerics (sv native scale); rate stats (xwoba/xba/xslg/woba/babip) are 0-1;
// avgEv is mph. Fields are optional: players with no sv coverage keep the
// MySQL-derived values only (estimated xwoba remains as fallback).

export interface SavantWindowFields {
  xwobaReal?: number | null; // real Statcast xwOBA (sv-sourced; `xwoba` mirrors it when covered)
  xba?: number | null;
  xslg?: number | null;
  barrelPct?: number | null; // 0-100
  hardHitPct?: number | null; // 0-100
  whiffPct?: number | null; // 0-100
  cswPct?: number | null; // 0-100
  avgEv?: number | null; // mph
  woba?: number | null;
  babip?: number | null;
  // Present in sv_stat_cache and previously dropped by the loader mapper, which
  // forced several screens to invent substitutes (profiler/derive.ts:180-181
  // synthesised GB% and SwStr% while both sat unused in the warehouse).
  swStrPct?: number | null; // 0-100
  zonePct?: number | null; // 0-100
  gbPct?: number | null; // 0-100
  fbPct?: number | null; // 0-100
  ldPct?: number | null; // 0-100
  iso?: number | null;
  slg?: number | null;
  avg?: number | null;
  hrPct?: number | null; // 0-100
  bbe?: number | null; // batted-ball events — sample size for the contact rates
  games?: number | null;
}

/** Split-chip line (vsL/vsR/home/away) from sv_stat_cache split rows. */
export interface SavantSplitLine extends SavantWindowFields {
  pa?: number | null;
  kPct?: number | null; // 0-100
  bbPct?: number | null; // 0-100
}

export interface SavantSplits {
  vsL?: SavantSplitLine;
  vsR?: SavantSplitLine;
  home?: SavantSplitLine;
  away?: SavantSplitLine;
}

export interface PitcherWindow extends SavantWindowFields {
  bf: number; // batters faced in window
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  xwoba: number; // real Statcast xwOBA where sv coverage exists; otherwise ESTIMATE from OPS-against
}

export interface Pitcher extends SavantWindowFields {
  id: string;
  sport: "mlb";
  kind: "pitcher";
  name: string;
  team: string;
  throws: "L" | "R";
  role: "SP" | "RP";
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  xwoba: number; // real Statcast xwOBA where sv coverage exists; else estimate
  windows: Record<MlbWindowKey, PitcherWindow>;
  /** sv-sourced split chips (vsL/vsR/home/away) — additive. */
  splits?: SavantSplits;
}

export interface BatterWindow extends SavantWindowFields {
  pa: number;
  avg: number;
  obp: number;
  slg: number;
  iso: number;
  xbh: number; // extra-base hits per game in window
  tb: number; // total bases per game in window
  xwoba?: number; // sv-sourced only (batter windows have no estimated xwoba)
}

export interface Batter extends SavantWindowFields {
  id: string;
  sport: "mlb";
  kind: "batter";
  name: string;
  team: string;
  pos: string;
  bats: "L" | "R" | "S";
  avg: number;
  obp: number;
  slg: number;
  iso: number;
  xbh: number;
  tb: number;
  windows: Record<MlbWindowKey, BatterWindow>;
  /** sv-sourced split chips (vsL/vsR/home/away) — additive. */
  splits?: SavantSplits;
}

export type MlbPlayer = Pitcher | Batter;

// ── NHL ─────────────────────────────────────────────────────────────────────

export type NhlWindowKey = "MIN60" | "MIN120" | "MIN180" | "MIN240";
export const NHL_WINDOW_KEYS: NhlWindowKey[] = ["MIN60", "MIN120", "MIN180", "MIN240"];

export interface GoalieWindow {
  toi: number; // minutes
  svPct: number;
  gsax: number | null; // null: no public xG feed — omitted honestly
  xgAgainst: number | null;
}

export interface Goalie {
  id: string;
  sport: "nhl";
  kind: "goalie";
  name: string;
  team: string;
  catches: "L" | "R";
  svPct: number;
  gsax: number | null;
  xgAgainst: number | null;
  windows: Record<NhlWindowKey, GoalieWindow>;
}

export interface SkaterWindow {
  toi: number;
  sog: number; // shots per game
  goals: number; // per game
  points: number; // per game
}

export interface Skater {
  id: string;
  sport: "nhl";
  kind: "skater";
  name: string;
  team: string;
  pos: "C" | "LW" | "RW" | "D";
  shoots: "L" | "R";
  sog: number;
  goals: number;
  points: number;
  windows: Record<NhlWindowKey, SkaterWindow>;
}

export type NhlPlayer = Goalie | Skater;
export type AnyPlayer = MlbPlayer | NhlPlayer;

// ── Slate ───────────────────────────────────────────────────────────────────

export interface SlateGame {
  id: string;
  sport: Sport;
  away: string;
  home: string;
  startTime: string; // e.g. '7:05 PM ET'
  venue: string;
  awayProbable?: string;
  homeProbable?: string;
  awayProbableId?: string;
  homeProbableId?: string;
  // ── additive: sv_slate fields (MLB only) ──
  awayProbableHand?: "L" | "R" | null;
  homeProbableHand?: "L" | "R" | null;
  gamePk?: number; // MLBAM gamePk from sv_slate
  total?: number;
  note?: string;
}

// ── Props ───────────────────────────────────────────────────────────────────

export type PropMarket =
  | "XBH"
  | "Total Bases"
  | "Strikeouts"
  | "Hits"
  | "SOG"
  | "Saves"
  | "Goals"
  | "Points"
  // ── additive: sv_odds prop types mapped to game-log stats (MLB) ──
  | "Hits Allowed"
  | "Outs"
  | "Home Runs"
  | "Singles"
  | "Doubles"
  | "RBIs"
  | "Runs"
  | "Walks"
  | "Stolen Bases"
  | "Hits + Runs + RBIs";

export type HitWindow = "L5" | "L10" | "L20";
export const HIT_WINDOWS: HitWindow[] = ["L5", "L10", "L20"];

export interface PropLine {
  id: string;
  sport: Sport;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  market: PropMarket;
  line: number;
  overPrice: number; // real odds (American) for MLB from sv_odds; flat -115 only where no odds feed (NHL)
  underPrice: number;
  hitRates: Record<HitWindow, number>;
  priceAlert?: boolean;
  edgeScore?: number;
  gameId: string;
  // ── additive: real-odds fields (sv_odds, MLB only) ──
  svPropType?: string; // raw sv_odds prop_type, e.g. 'strikeouts thrown'
  overBook?: string | null; // best over book
  underBook?: string | null; // best under book
  consOver?: number | null; // consensus over price (American)
  consUnder?: number | null; // consensus under price (American)
  books?: number | null; // number of books in consensus
  pulledAt?: string; // sv_odds pulled_at (ISO)
  oddsSource?: "sv_odds" | "flat";
  /**
   * Real per-game values for this stat, most recent first (max 20), straight
   * from game_logs. Present only when the row was built from real logs.
   * Consumers compare each value against `line` to render a genuine hit/miss
   * history — never generate one.
   */
  recentValues?: number[];
}

// ── Angles (canonical frontend Angle shape) ──────────────────────────────────

export type AngleType = "table" | "ai" | "edge" | "note";

export interface HeatCellData {
  value: string;
  deltaPct: number;
}
export interface HeatRowData {
  label: string;
  invert?: boolean;
  cells: HeatCellData[];
}
export interface HitbarData {
  label: string;
  line: string;
  rates: { L5: number; L10: number; L20: number };
  alert?: boolean;
}
export interface AngleSnapshot {
  kind: "heat" | "hitbar" | "text";
  source: string;
  heat?: { headers: string[]; rows: HeatRowData[] };
  hitbar?: HitbarData;
  text?: string;
}

export interface AngleDto {
  id: string;
  title: string;
  sport: Sport;
  type: AngleType;
  note: string;
  tags: string[];
  shared: boolean;
  createdAt: number; // epoch ms
  snapshot: AngleSnapshot;
}

// ── Follows ─────────────────────────────────────────────────────────────────

export interface FollowDto {
  playerId: string; // slug
  sport: Sport;
  name: string;
  team: string;
  role: string;
  createdAt: number;
}

// ── Ingestion ───────────────────────────────────────────────────────────────

export type IngestSource = "mlb" | "nhl" | "slate" | "props";

export interface IngestionRunDto {
  id: number;
  source: string;
  status: string;
  rows: number;
  message: string | null;
  startedAt: number;
  finishedAt: number | null;
}

// ── Team stats (bullpen etc.) ────────────────────────────────────────────────

export interface BullpenStats {
  team: string;
  relievers: number;
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
}
