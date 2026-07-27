import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { loadPlayerBySlug, loadPlayers } from "./loaders";
import type { Batter, Goalie, Pitcher, Skater } from "@contracts/types";

export const playersRouter = createRouter({
  pitchers: publicQuery
    .input(
      z
        .object({
          team: z.string().max(8).optional(),
          throws: z.enum(["L", "R"]).optional(),
          maxEra: z.number().optional(),
          minKPct: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const all = (await loadPlayers("pitcher")) as Pitcher[];
      const f = input ?? {};
      return all.filter(
        (p) =>
          (!f.team || p.team === f.team) &&
          (!f.throws || p.throws === f.throws) &&
          (f.maxEra === undefined || p.era <= f.maxEra) &&
          (f.minKPct === undefined || p.kPct >= f.minKPct),
      );
    }),

  batters: publicQuery
    .input(
      z
        .object({
          team: z.string().max(8).optional(),
          pos: z.string().max(16).optional(),
          bats: z.enum(["L", "R", "S"]).optional(),
          minAvg: z.number().optional(),
          minIso: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const all = (await loadPlayers("batter")) as Batter[];
      const f = input ?? {};
      return all.filter(
        (b) =>
          (!f.team || b.team === f.team) &&
          (!f.pos || b.pos === f.pos) &&
          (!f.bats || b.bats === f.bats) &&
          (f.minAvg === undefined || b.avg >= f.minAvg) &&
          (f.minIso === undefined || b.iso >= f.minIso),
      );
    }),

  goalies: publicQuery
    .input(
      z
        .object({
          team: z.string().max(8).optional(),
          minSvPct: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const all = (await loadPlayers("goalie")) as Goalie[];
      const f = input ?? {};
      return all.filter(
        (g) => (!f.team || g.team === f.team) && (f.minSvPct === undefined || g.svPct >= f.minSvPct),
      );
    }),

  skaters: publicQuery
    .input(
      z
        .object({
          team: z.string().max(8).optional(),
          pos: z.enum(["C", "LW", "RW", "D"]).optional(),
          minSog: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const all = (await loadPlayers("skater")) as Skater[];
      const f = input ?? {};
      return all.filter(
        (s) =>
          (!f.team || s.team === f.team) &&
          (!f.pos || s.pos === f.pos) &&
          (f.minSog === undefined || s.sog >= f.minSog),
      );
    }),

  /** Player detail by slug id. */
  player: publicQuery
    .input(z.object({ sport: z.enum(["mlb", "nhl"]), id: z.string().min(1).max(140) }))
    .query(({ input }) => loadPlayerBySlug(input.sport, input.id)),

  search: publicQuery
    .input(z.object({ sport: z.enum(["mlb", "nhl"]), q: z.string().max(120) }))
    .query(async ({ input }) => {
      const q = input.q.trim().toLowerCase();
      if (!q) return [];
      const roles =
        input.sport === "mlb" ? (["pitcher", "batter"] as const) : (["goalie", "skater"] as const);
      const lists = await Promise.all(roles.map((r) => loadPlayers(r)));
      return lists
        .flat()
        .filter(
          (p: any) => p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q,
        );
    }),
});
