// Email + password authentication (FIX 12).
//
// Hashing: argon2id (node-argon2, memory-hardened, per spec — chosen over
// bcrypt). The plaintext password exists only inside these handlers for the
// duration of the call. NEVER log the password, never log the hash.

import argon2 from "argon2";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { users } from "@db/schema";
import { getDb } from "../queries/connection";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "../lib/cookies";
import { signSessionToken } from "./session";
import { consumeSetupToken } from "./tokens";

const MIN_PASSWORD_LEN = 10;
const GENERIC_LOGIN_FAILURE = { error: "Invalid email or password." } as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false; // malformed hash — treat as mismatch, never throw details
  }
}

function issueSession(c: Context, user: { id: number; email: string }, token: string) {
  const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
  setCookie(c, Session.cookieName, token, {
    ...cookieOpts,
    maxAge: Session.maxAgeMs / 1000,
  });
}

async function touchSignIn(userId: number) {
  await getDb()
    .update(users)
    .set({ lastSignInAt: new Date() })
    .where(eq(users.id, userId));
}

/** POST /api/auth/login — { email, password } */
export async function handleLogin(c: Context) {
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return c.json(GENERIC_LOGIN_FAILURE, 401);

  const user = (
    await getDb().select().from(users).where(eq(users.email, email)).limit(1)
  ).at(0);
  // Uniform failure: unknown email, unset password, and wrong password are
  // indistinguishable. (A mustSetPassword account simply has no hash yet.)
  if (!user?.passwordHash) return c.json(GENERIC_LOGIN_FAILURE, 401);
  if (!(await verifyPassword(user.passwordHash, password))) {
    return c.json(GENERIC_LOGIN_FAILURE, 401);
  }

  await touchSignIn(user.id);
  const token = await signSessionToken({ userId: user.id, email: user.email });
  issueSession(c, user, token);
  return c.json({ ok: true });
}

/** POST /api/auth/set-password — { token, password } */
export async function handleSetPassword(c: Context) {
  let body: { token?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  const token = body.token ?? "";
  const password = body.password ?? "";
  if (password.length < MIN_PASSWORD_LEN) {
    return c.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      400,
    );
  }

  const userId = await consumeSetupToken(token);
  if (userId == null) {
    // Dead token: unknown, already used, or expired. A fresh one comes from
    // a server restart or `npm run setup-url`.
    return c.json(
      { error: "This setup link has expired or was already used." },
      410,
    );
  }

  const hash = await hashPassword(password);
  await getDb()
    .update(users)
    .set({ passwordHash: hash, mustSetPassword: false, lastSignInAt: new Date() })
    .where(eq(users.id, userId));

  const user = (
    await getDb().select().from(users).where(eq(users.id, userId)).limit(1)
  ).at(0);
  if (!user) return c.json({ error: "Account not found." }, 500);

  const jwt = await signSessionToken({ userId: user.id, email: user.email });
  issueSession(c, user, jwt);
  return c.json({ ok: true });
}
