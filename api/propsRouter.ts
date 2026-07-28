import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { gameLogs, players, props, type Player, type PropRow } from "@db/schema";
import type { HitWindow, PropLine, PropMarket, Sport } from "@contracts/types";
import {
  SV_PROP_MAP,
  getLatestOdds,
  getSavantSlate,
  impliedProb,
  type RealPropOdds,
} from "./supabase/savant";

const MARKETS = [
  "XBH", "Total Bases", "Strikeouts", "Hits", "SOG", "Saves", "Goals", "Points",
  // additive sv_odds markets (MLB)
  "Hits Allowed", "Outs", "Home Runs", "Singles", "Doubles", "RBIs", "Runs",
  "Walks", "Stolen Bases", "Hits + Runs + RBIs",
] as const;

// Exported for the FIX 8 unit test (api/propsRouter.test.ts).
export function toPropLine(row: PropRow, player: { slug: string; name: string; team: string }): PropLine {
  const l5 = Number(row.l5);
  const l10 = Number(row.l10);
  const l20 = Number(row.l20);
  return {
    id: `prop-${row.id}`,
    sport: row.sport,
    playerId: player.slug,
    player: player.name,
    team: player.team,
    opponent: row.opponent,
    market: row.market as PropMarket,
    line: Number(row.line),
    overPrice: row.priceOver,
    underPrice: row.priceUnder,
    hitRates: { L5: l5, L10: l10, L20: l20 },
    // FIX 8: no edgeScore / priceAlert on the flat path. These rows carry an
    // invented -115 price; a "price alert" or "edge score" computed against it
    // is fabrication in the exact surface a user acts from. hasRealOdds()
    // already gates the de-vig math — these two fields are the ones that sort
    // and badge, so they must be null, not a number.
    priceAlert: null,
    edgeScore: null,
    // No recentValues on the derived/flat path — this row's hit rates come from
    // pre-aggregated ingest output, not per-game logs. The drawer renders an
    // explicit "no game log" state rather than inventing one.
    gameId: row.gameId,
    oddsSource: "flat",
  };
}

/** Existing MySQL-derived props. NHL: only on an explicit sport:"nhl" ask
 * (parked vertical — no odds feed, preseason slate, prior-season logs).
 * MLB: fallback only when sv_odds has no coverage. Prices flat -115. */
async function mysqlProps(sport: Sport): Promise<PropLine[]> {
  const db = getDb();
  const rows = await db
    .select({ prop: props, player: players })
    .from(props)
    .innerJoin(players, eq(props.playerId, players.id))
    .where(eq(props.sport, sport))
    .orderBy(desc(props.updatedAt));
  return rows.map((r) =>
    toPropLine(r.prop, { slug: r.player.slug, name: r.player.name, team: r.player.team }),
  );
}

// ── MLB props from sv_odds (real lines + prices) ─────────────────────────────
// sv_odds (one row per player/prop per game_date) supplies the real line and
// best-book/consensus prices. L5/L10/L20 hit rates are computed from the MySQL
// game logs (statsapi stat lines) vs the REAL sv line, joined extId=mlbam_id.

const MLB_PROP_CACHE_TTL_MS = 5 * 60 * 1000;
let mlbPropCache: { at: number; lines: PropLine[] } | null = null;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildMlbProp(
  odd: RealPropOdds,
  player: Player,
  slateByTeam: Map<string, { opponent: string; gameId: string }>,
  logs: any[],
): PropLine | null {
  const mapping = SV_PROP_MAP[odd.propType];
  if (!mapping) return null; // un-mappable prop type — skipped honestly
  // value per game log (most recent first); drop games where stat is absent
  const values: number[] = [];
  for (const l of logs) {
    const v = mapping.stat(JSON.parse(l.statsJson).stat ?? {});
    if (v != null) values.push(v);
    if (values.length >= 20) break;
  }
  if (values.length < 5) return null; // not enough real game logs
  const rate = (n: number) => {
    const slice = values.slice(0, n);
    return slice.length ? slice.filter((v) => v > odd.line).length / slice.length : 0;
  };
  const l5 = rate(5);
  const l10 = rate(10);
  const l20 = rate(20);
  const blended = l5 * 0.5 + l10 * 0.3 + l20 * 0.2;
  // price alert: hit-rate implied probability vs consensus price implied prob
  const overImplied = impliedProb(odd.consOver ?? odd.overOdds);
  const priceAlert = overImplied != null && blended - overImplied >= 0.075;
  const edgeScore = Math.round(
    Math.min(99, Math.max(8, blended * 100 + (priceAlert ? 8 : 0) - 4)),
  );
  const slate = slateByTeam.get(odd.team) ?? { opponent: "", gameId: "" };
  return {
    id: `prop-sv-${odd.playerMlbam}-${slugify(odd.propType)}`,
    sport: "mlb",
    playerId: player.slug,
    player: player.name,
    team: player.team,
    opponent: slate.opponent,
    market: mapping.market,
    line: odd.line,
    overPrice: odd.overOdds ?? odd.consOver ?? -115,
    underPrice: odd.underOdds ?? odd.consUnder ?? -115,
    hitRates: { L5: l5, L10: l10, L20: l20 },
    // The per-game values behind those rates. Previously computed and thrown
    // away, which forced the drawer to fabricate a hit/miss strip.
    recentValues: values.slice(0, 20),
    priceAlert,
    edgeScore,
    gameId: slate.gameId,
    oddsDate: odd.gameDate, // sv_odds game_date — drives the stale-board warning (FIX 10)
    svPropType: odd.propType,
    overBook: odd.overBook,
    underBook: odd.underBook,
    consOver: odd.consOver,
    consUnder: odd.consUnder,
    books: odd.books,
    pulledAt: odd.pulledAt,
    oddsSource: "sv_odds",
  };
}

async function mlbPropsFromSavant(): Promise<PropLine[]> {
  if (mlbPropCache && Date.now() - mlbPropCache.at < MLB_PROP_CACHE_TTL_MS) {
    return mlbPropCache.lines;
  }
  const odds = await getLatestOdds();
  if (odds.length === 0) return [];
  const db = getDb();

  const mlbamIds = [...new Set(odds.map((o) => o.playerMlbam))];
  const mlbPlayers = (
    await db.select().from(players).where(inArray(players.extId, mlbamIds))
  ).filter((p) => p.sport === "mlb"); // extId space overlaps NHL; keep MLB only
  const byExtId = new Map(mlbPlayers.map((p) => [p.extId, p]));

  // today's sv slate → team → opponent/gameId
  const { games } = await getSavantSlate();
  const slateByTeam = new Map<string, { opponent: string; gameId: string }>();
  for (const g of games) {
    const gid = `mlb-${g.away_abbr.toLowerCase()}-${g.home_abbr.toLowerCase()}`;
    if (!slateByTeam.has(g.away_abbr)) slateByTeam.set(g.away_abbr, { opponent: `@ ${g.home_abbr}`, gameId: gid });
    if (!slateByTeam.has(g.home_abbr)) slateByTeam.set(g.home_abbr, { opponent: `vs ${g.away_abbr}`, gameId: gid });
  }

  // bulk-load game logs for matched players (most recent first; 20 kept/player)
  const pids = mlbPlayers.map((p) => p.id);
  const logRows = pids.length
    ? await db
        .select()
        .from(gameLogs)
        .where(inArray(gameLogs.playerId, pids))
        .orderBy(desc(gameLogs.gameDate))
    : [];
  const logsByPid = new Map<number, any[]>();
  for (const l of logRows) {
    const arr = logsByPid.get(l.playerId);
    if (arr) {
      if (arr.length < 20) arr.push(l);
    } else {
      logsByPid.set(l.playerId, [l]);
    }
  }

  const out: PropLine[] = [];
  for (const odd of odds) {
    const player = byExtId.get(odd.playerMlbam);
    if (!player) continue; // odds player not in our MLB player pool — skipped
    const logs = logsByPid.get(player.id) ?? [];
    const line = buildMlbProp(odd, player, slateByTeam, logs);
    if (line) out.push(line);
  }
  mlbPropCache = { at: Date.now(), lines: out };
  return out;
}

async function queryProps(filters: {
  sport?: "mlb" | "nhl";
  market?: PropMarket;
  team?: string;
  alertsOnly?: boolean;
  minEdge?: number;
  window?: HitWindow;
  minRate?: number;
  gameId?: string;
  playerSlug?: string;
}): Promise<PropLine[]> {
  const wantMlb = !filters.sport || filters.sport === "mlb";
  // FIX 8: NHL is a parked vertical and stays OFF the prop board by default.
  // Its rows are wrong in three ways at once — invented flat -115 prices
  // (sv_odds has zero NHL rows), a preseason slate two months out, and hit
  // rates from last season's game logs. Only an explicit sport:"nhl" ask
  // returns them; the UI never asks.
  const wantNhl = filters.sport === "nhl";
  let out: PropLine[] = [];

  if (wantMlb) {
    let mlb: PropLine[] = [];
    try {
      mlb = await mlbPropsFromSavant();
    } catch (err) {
      console.warn("[savant] sv_odds props unavailable, using MySQL fallback:", (err as Error).message);
    }
    if (mlb.length === 0) mlb = await mysqlProps("mlb"); // fallback: derived lines, flat -115
    out.push(...mlb);
  }
  if (wantNhl) {
    out.push(...(await mysqlProps("nhl"))); // explicit ask only — see FIX 8 note above
  }

  const w: HitWindow = filters.window ?? "L10";
  out = out.filter(
    (p) =>
      (!filters.market || p.market === filters.market) &&
      (!filters.team || p.team === filters.team) &&
      (!filters.gameId || p.gameId === filters.gameId) &&
      (!filters.playerSlug || p.playerId === filters.playerSlug) &&
      (!filters.alertsOnly || p.priceAlert) &&
      (filters.minEdge === undefined || (p.edgeScore ?? 0) >= filters.minEdge) &&
      (filters.minRate === undefined || p.hitRates[w] >= filters.minRate),
  );
  return out.sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0));
}

export const propsRouter = createRouter({
  /** Hit Rates scanner feed. */
  hitRates: publicQuery
    .input(
      z
        .object({
          sport: z.enum(["mlb", "nhl"]).optional(),
          market: z.enum(MARKETS).optional(),
          window: z.enum(["L5", "L10", "L20"]).optional(),
          minRate: z.number().min(0).max(1).optional(),
          alertsOnly: z.boolean().optional(),
        })
        .optional(),
    )
    .query(({ input }) => queryProps(input ?? {})),

  list: publicQuery
    .input(
      z
        .object({
          sport: z.enum(["mlb", "nhl"]).optional(),
          market: z.enum(MARKETS).optional(),
          team: z.string().max(8).optional(),
          alertsOnly: z.boolean().optional(),
          minEdge: z.number().optional(),
        })
        .optional(),
    )
    .query(({ input }) => queryProps(input ?? {})),

  byPlayer: publicQuery
    .input(z.object({ playerId: z.string().min(1).max(140) }))
    .query(({ input }) => queryProps({ playerSlug: input.playerId })),

  byGame: publicQuery
    .input(z.object({ gameId: z.string().min(3).max(48) }))
    .query(({ input }) => queryProps({ gameId: input.gameId })),

  alerts: publicQuery.query(() => queryProps({ alertsOnly: true })),
});
