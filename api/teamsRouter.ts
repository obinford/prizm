// Team Stats aggregation — sv_stat_cache batter lines rolled up to a team.
//
// The verified SQL (GROUP BY team_id with PA/BBE-weighted means) cannot run at
// runtime: Prizm's path to Supabase is the hand-rolled PostgREST client in
// api/supabase/client.ts, which has no group by and no aggregates. So the rows
// are fetched once through getStatIndex() — already cached 5 minutes by the pg
// client — and aggregated here in TypeScript. Do not add a Postgres driver for
// this; one extra round trip is the wrong trade against a second connection
// path.

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getStatIndex, TEAM_ID_TO_ABBR, type SvStatRow } from "./supabase/savant";
import type { MlbTeamStats } from "@contracts/types";

/**
 * Minimum plate appearances for a batter to count toward his team's line.
 * A product decision, not a technical one — it keeps cup-of-coffee bats from
 * dragging a team average. Surfaced in the UI provenance line so it is not a
 * hidden assumption.
 */
export const TEAM_QUALIFIER_PA = 25;

/** sv_stat_cache splits are plate-appearance windows, not game windows. */
const SPLITS = ["season", "l30", "l60", "l90", "l120", "home", "away", "vsL", "vsR"] as const;
export type TeamSplit = (typeof SPLITS)[number];

/** Weighted mean, null when no row carried both a value and a weight. */
function wmean(
  rows: SvStatRow[],
  val: (r: SvStatRow) => number | null,
  wt: (r: SvStatRow) => number | null,
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const v = val(r);
    const w = wt(r);
    if (v == null || w == null || w <= 0) continue;
    num += v * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

function aggregate(rows: SvStatRow[], abbr: string): MlbTeamStats {
  // The two weighting rules that matter: rate stats accrue per plate
  // appearance; batted-ball rates are denominated in batted-ball events, so
  // they are weighted by bbe. PA-weighting a Barrel% overweights high-walk,
  // low-contact hitters — plausible-looking and wrong.
  const pa = (r: SvStatRow) => r.pa;
  const bbe = (r: SvStatRow) => r.bbe;
  const teamPa = rows.reduce((s, r) => s + (r.pa ?? 0), 0);
  const teamBbe = rows.reduce((s, r) => s + (r.bbe ?? 0), 0);

  const gbPct = wmean(rows, (r) => r.gb_pct, bbe);
  const fbPct = wmean(rows, (r) => r.fb_pct, bbe);

  return {
    abbr,
    batters: rows.length,
    teamPa,
    teamBbe,
    // PA-weighted — these accrue per plate appearance
    woba: wmean(rows, (r) => r.woba, pa),
    xwoba: wmean(rows, (r) => r.xwoba, pa),
    babip: wmean(rows, (r) => r.babip, pa),
    iso: wmean(rows, (r) => r.iso, pa),
    slg: wmean(rows, (r) => r.slg, pa),
    avg: wmean(rows, (r) => r.avg, pa),
    xba: wmean(rows, (r) => r.xba, pa),
    xslg: wmean(rows, (r) => r.xslg, pa),
    kPct: wmean(rows, (r) => r.k_pct, pa),
    bbPct: wmean(rows, (r) => r.bb_pct, pa),
    swStrPct: wmean(rows, (r) => r.swstr_pct, pa),
    cswPct: wmean(rows, (r) => r.csw_pct, pa),
    whiffPct: wmean(rows, (r) => r.whiff_pct, pa),
    zonePct: wmean(rows, (r) => r.zone_pct, pa),
    hrPct: wmean(rows, (r) => r.hr_pct, pa),
    // BBE-weighted — these accrue per batted-ball event, NOT per plate appearance
    hardHitPct: wmean(rows, (r) => r.hard_hit_pct, bbe),
    barrelPct: wmean(rows, (r) => r.barrel_pct, bbe),
    avgEv: wmean(rows, (r) => r.avg_ev, bbe),
    gbPct,
    fbPct,
    ldPct: wmean(rows, (r) => r.ld_pct, bbe),
    // Derived
    gbFb: gbPct != null && fbPct != null && fbPct > 0 ? gbPct / fbPct : null,
  };
}

export const teamsRouter = createRouter({
  stats: publicQuery
    .input(z.object({ split: z.enum(SPLITS).default("season") }).optional())
    .query(async ({ input }) => {
      const split = input?.split ?? "season";
      const idx = await getStatIndex();
      const byTeam = new Map<number, SvStatRow[]>();

      for (const r of idx.values()) {
        if (r.side !== "batter") continue;
        if (r.split !== split) continue;
        if (r.team_id == null) continue;
        if ((r.pa ?? 0) < TEAM_QUALIFIER_PA) continue;
        const list = byTeam.get(r.team_id);
        if (list) list.push(r);
        else byTeam.set(r.team_id, [r]);
      }

      const teams: MlbTeamStats[] = [];
      let builtAt: string | null = null;
      for (const [teamId, rows] of byTeam) {
        const abbr = TEAM_ID_TO_ABBR[teamId];
        // An unmapped team_id is a data problem, not a row to guess at.
        if (!abbr) continue;
        teams.push(aggregate(rows, abbr));
        for (const r of rows) {
          if (r.built_at && (builtAt == null || r.built_at > builtAt)) builtAt = r.built_at;
        }
      }

      return { split, qualifierPa: TEAM_QUALIFIER_PA, builtAt, teams };
    }),
});
