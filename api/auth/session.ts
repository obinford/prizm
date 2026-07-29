// Session JWTs (FIX 12). APP_SECRET is now purely a signing key — any strong
// random value satisfies it; no external OAuth provider is involved.

import * as jose from "jose";
import { env } from "../lib/env";
import type { SessionPayload } from "./types";

const JWT_ALG = "HS256";

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    console.warn("[session] No token provided for verification.");
    return null;
  }
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const { userId, email } = payload;
    if (typeof userId !== "number" || typeof email !== "string" || !email) {
      console.warn("[session] JWT payload missing required fields.");
      return null;
    }
    return { userId, email };
  } catch (error) {
    console.warn("[session] JWT verification failed:", error);
    return null;
  }
}
