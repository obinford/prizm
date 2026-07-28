import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { playersRouter } from "./playersRouter";
import { slateRouter } from "./slateRouter";
import { propsRouter } from "./propsRouter";
import { anglesRouter } from "./anglesRouter";
import { followsRouter } from "./followsRouter";
import { ingestRouter } from "./ingestRouter";
import { teamsRouter } from "./teamsRouter";
import { lineupsRouter } from "./lineupsRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  players: playersRouter,
  slate: slateRouter,
  props: propsRouter,
  angles: anglesRouter,
  follows: followsRouter,
  ingest: ingestRouter,
  teams: teamsRouter,
  lineups: lineupsRouter,
});

export type AppRouter = typeof appRouter;
