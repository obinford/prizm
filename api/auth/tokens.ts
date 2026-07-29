// One-time account-setup tokens (FIX 12).
//
// The plaintext token exists in exactly two places: the console line printed
// once at creation, and the URL the owner opens. The database stores only its
// SHA-256 hash. Single use, 60-minute expiry; used or expired is dead, and a
// fresh one comes from a server restart or `npm run setup-url`.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { setupTokens, users } from "@db/schema";
import { getDb } from "../queries/connection";

export const SETUP_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, per spec

/** SHA-256 hex of a plaintext setup token — the only form that is stored. */
export function hashSetupToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Constant-time comparison of two token hashes (exported for tests). */
export function tokenHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Pure liveness rule (exported for tests): unused AND unexpired. */
export function isTokenLive(
  row: { consumedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return row.consumedAt == null && row.expiresAt.getTime() > now.getTime();
}

/**
 * Create a setup token for a user and return the PLAINTEXT. The caller must
 * print it once and never persist it — only the hash is stored.
 */
export async function createSetupToken(userId: number): Promise<string> {
  const plaintext = randomBytes(32).toString("hex");
  await getDb().insert(setupTokens).values({
    userId,
    tokenHash: hashSetupToken(plaintext),
    expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS),
  });
  return plaintext;
}

/**
 * Verify a plaintext token and consume it atomically. Returns the user id on
 * success, null for a dead (unknown / used / expired) token. Consumption is a
 * conditional UPDATE so a token presented twice can only succeed once.
 */
export async function consumeSetupToken(plaintext: string): Promise<number | null> {
  if (!plaintext || plaintext.length > 128) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(setupTokens)
    .where(eq(setupTokens.tokenHash, hashSetupToken(plaintext)))
    .limit(1);
  const row = rows.at(0);
  if (!row || !isTokenLive(row)) return null;
  const result = await db
    .update(setupTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(setupTokens.id, row.id), isNull(setupTokens.consumedAt)));
  const affected = (result as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
  return affected === 1 ? row.userId : null;
}

/** The account waiting on first-time password setup, if any. */
export async function findUserAwaitingSetup() {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.mustSetPassword, true))
    .limit(1);
  return rows.at(0) ?? null;
}
