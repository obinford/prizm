import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { ingestionRuns } from "@db/schema";
import type { IngestSource, IngestionRunDto } from "@contracts/types";
import { runIngestion } from "./ingest/run";
import { getSavantFreshness } from "./supabase/savant";

function toDto(r: typeof ingestionRuns.$inferSelect): IngestionRunDto {
  return {
    id: r.id,
    source: r.source,
    status: r.status,
    rows: r.rows,
    message: r.message,
    startedAt: r.startedAt.getTime(),
    finishedAt: r.finishedAt ? r.finishedAt.getTime() : null,
  };
}

// Track in-process runs so double-clicks don't stampede the upstream APIs.
const running = new Set<string>();

export const ingestRouter = createRouter({
  /** Latest ingestion run per source. */
  lastRuns: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(100);
    const latest = new Map<string, IngestionRunDto>();
    for (const r of rows) if (!latest.has(r.source)) latest.set(r.source, toDto(r));
    // 'savant' pseudo-source: freshness of the Supabase Statcast warehouse
    // (sv_stat_cache.built_at + sv_odds.pulled_at), so the freshness chip
    // reflects the MLB warehouse even though it isn't a MySQL ingestion run.
    try {
      const f = await getSavantFreshness();
      const ts = Math.max(
        f.statBuiltAt ? Date.parse(f.statBuiltAt) : 0,
        f.oddsPulledAt ? Date.parse(f.oddsPulledAt) : 0,
      );
      if (ts > 0) {
        latest.set("savant", {
          id: 0,
          source: "savant",
          status: "ok",
          rows: 0,
          message: `sv_stat_cache built_at=${f.statBuiltAt ?? "?"}; sv_odds pulled_at=${f.oddsPulledAt ?? "?"}`,
          startedAt: ts,
          finishedAt: ts,
        });
      }
    } catch (err) {
      console.warn("[savant] freshness probe failed:", (err as Error).message);
    }
    return Object.fromEntries(latest);
  }),

  history: publicQuery
    .input(z.object({ source: z.enum(["mlb", "nhl", "slate", "props"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = input?.source
        ? await db
            .select()
            .from(ingestionRuns)
            .where(sql`${ingestionRuns.source} = ${input.source}`)
            .orderBy(desc(ingestionRuns.id))
            .limit(20)
        : await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(20);
      return rows.map(toDto);
    }),

  /** Trigger an ingestion run (admin). Runs async; poll lastRuns for status. */
  run: adminQuery
    .input(z.object({ source: z.enum(["mlb", "nhl", "slate", "props", "all"]) }))
    .mutation(async ({ input }) => {
      const source: IngestSource | "all" = input.source;
      if (running.has(source)) return { started: false, reason: "already running" };
      running.add(source);
      void runIngestion(source)
        .catch((err) => console.error(`[ingest:${source}]`, err))
        .finally(() => running.delete(source));
      return { started: true };
    }),
});
