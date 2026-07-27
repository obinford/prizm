import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { playersRouter } from "./playersRouter";
import { slateRouter } from "./slateRouter";
import { propsRouter } from "./propsRouter";
import { anglesRouter } from "./anglesRouter";
import { followsRouter } from "./followsRouter";
import { ingestRouter } from "./ingestRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  players: playersRouter,
  slate: slateRouter,
  props: propsRouter,
  angles: anglesRouter,
  follows: followsRouter,
  ingest: ingestRouter,
});

export type AppRouter = typeof appRouter;
