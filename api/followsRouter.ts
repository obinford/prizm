import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { follows, players } from "@db/schema";
import type { FollowDto } from "@contracts/types";

export const followsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ follow: follows, player: players })
      .from(follows)
      .innerJoin(players, eq(follows.playerId, players.id))
      .where(eq(follows.userId, ctx.user.id))
      .orderBy(desc(follows.createdAt));
    const out: FollowDto[] = rows.map((r) => ({
      playerId: r.player.slug,
      sport: r.player.sport,
      name: r.player.name,
      team: r.player.team,
      role: r.player.role,
      createdAt: r.follow.createdAt.getTime(),
    }));
    return out;
  }),

  add: authedQuery
    .input(z.object({ sport: z.enum(["mlb", "nhl"]), playerId: z.string().min(1).max(140) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [player] = await db
        .select()
        .from(players)
        .where(and(eq(players.sport, input.sport), eq(players.slug, input.playerId)))
        .limit(1);
      if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      await db
        .insert(follows)
        .values({ userId: ctx.user.id, playerId: player.id })
        .onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
      const dto: FollowDto = {
        playerId: player.slug,
        sport: player.sport,
        name: player.name,
        team: player.team,
        role: player.role,
        createdAt: Date.now(),
      };
      return dto;
    }),

  remove: authedQuery
    .input(z.object({ sport: z.enum(["mlb", "nhl"]), playerId: z.string().min(1).max(140) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [player] = await db
        .select()
        .from(players)
        .where(and(eq(players.sport, input.sport), eq(players.slug, input.playerId)))
        .limit(1);
      if (!player) return { success: true };
      await db
        .delete(follows)
        .where(and(eq(follows.userId, ctx.user.id), eq(follows.playerId, player.id)));
      return { success: true };
    }),
});
