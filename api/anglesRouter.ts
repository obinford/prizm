import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { angles, type AngleRow } from "@db/schema";
import type { AngleDto, AngleSnapshot } from "@contracts/types";

const snapshotSchema = z.object({
  kind: z.enum(["heat", "hitbar", "text"]),
  source: z.string().max(120),
  heat: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(
        z.object({
          label: z.string(),
          invert: z.boolean().optional(),
          cells: z.array(z.object({ value: z.string(), deltaPct: z.number() })),
        }),
      ),
    })
    .optional(),
  hitbar: z
    .object({
      label: z.string(),
      line: z.string(),
      rates: z.object({ L5: z.number(), L10: z.number(), L20: z.number() }),
      alert: z.boolean().optional(),
    })
    .optional(),
  text: z.string().optional(),
});

const angleInput = z.object({
  title: z.string().min(1).max(200),
  sport: z.enum(["mlb", "nhl"]).default("mlb"),
  type: z.enum(["table", "ai", "edge", "note"]).default("note"),
  note: z.string().max(5000).default(""),
  tags: z.array(z.string().max(40)).max(20).default([]),
  shared: z.boolean().default(false),
  snapshot: snapshotSchema,
});

// Defaults-free patch schema — zod .partial() on a defaulted field still applies
// the default when the key is absent, which would wipe omitted fields on update.
const anglePatch = z.object({
  title: z.string().min(1).max(200).optional(),
  sport: z.enum(["mlb", "nhl"]).optional(),
  type: z.enum(["table", "ai", "edge", "note"]).optional(),
  note: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  shared: z.boolean().optional(),
  snapshot: snapshotSchema.optional(),
});

function toDto(row: AngleRow): AngleDto {
  return {
    id: String(row.id),
    title: row.title,
    sport: row.sport,
    type: (row.type as AngleDto["type"]) ?? "note",
    note: row.note,
    tags: row.tagsJson ? JSON.parse(row.tagsJson) : [],
    shared: row.shared,
    createdAt: row.createdAt.getTime(),
    snapshot: JSON.parse(row.snapshotJson) as AngleSnapshot,
  };
}

export const anglesRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(angles)
      .where(eq(angles.userId, ctx.user.id))
      .orderBy(desc(angles.createdAt));
    return rows.map(toDto);
  }),

  create: authedQuery.input(angleInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [{ id }] = await db
      .insert(angles)
      .values({
        userId: ctx.user.id,
        title: input.title,
        sport: input.sport,
        type: input.type,
        note: input.note,
        tagsJson: JSON.stringify(input.tags),
        snapshotJson: JSON.stringify(input.snapshot),
        shared: input.shared,
      })
      .$returningId();
    const [row] = await db.select().from(angles).where(eq(angles.id, id)).limit(1);
    return toDto(row);
  }),

  update: authedQuery
    .input(z.object({ id: z.coerce.number().int().positive(), patch: anglePatch }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(angles)
        .where(and(eq(angles.id, input.id), eq(angles.userId, ctx.user.id)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Angle not found" });
      const p = input.patch;
      await db
        .update(angles)
        .set({
          ...(p.title !== undefined ? { title: p.title } : {}),
          ...(p.sport !== undefined ? { sport: p.sport } : {}),
          ...(p.type !== undefined ? { type: p.type } : {}),
          ...(p.note !== undefined ? { note: p.note } : {}),
          ...(p.tags !== undefined ? { tagsJson: JSON.stringify(p.tags) } : {}),
          ...(p.snapshot !== undefined ? { snapshotJson: JSON.stringify(p.snapshot) } : {}),
          ...(p.shared !== undefined ? { shared: p.shared } : {}),
          updatedAt: new Date(),
        })
        .where(eq(angles.id, row.id));
      const [updated] = await db.select().from(angles).where(eq(angles.id, row.id)).limit(1);
      return toDto(updated);
    }),

  delete: authedQuery
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .delete(angles)
        .where(and(eq(angles.id, input.id), eq(angles.userId, ctx.user.id)));
      return { success: true };
    }),

  duplicate: authedQuery
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(angles)
        .where(and(eq(angles.id, input.id), eq(angles.userId, ctx.user.id)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Angle not found" });
      const [{ id }] = await db
        .insert(angles)
        .values({
          userId: ctx.user.id,
          title: `${row.title} (copy)`,
          sport: row.sport,
          type: row.type,
          note: row.note,
          tagsJson: row.tagsJson,
          snapshotJson: row.snapshotJson,
          shared: false,
        })
        .$returningId();
      const [copy] = await db.select().from(angles).where(eq(angles.id, id)).limit(1);
      return toDto(copy);
    }),
});
