// FIX 12 auth primitives. Pure round-trips only — no database, no network.
// The end-to-end flow (token print → set-password → login) is verified live
// against the dev server, not here.

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth/password";
import { hashSetupToken, isTokenLive, tokenHashEquals } from "./auth/tokens";

describe("password hashing (argon2id)", () => {
  it("hashes with argon2id and verifies the right password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("never embeds the plaintext in the hash", async () => {
    const hash = await hashPassword("a-very-secret-value");
    expect(hash).not.toContain("a-very-secret-value");
  });

  it("treats a malformed hash as a mismatch, not a crash", async () => {
    expect(await verifyPassword("not-a-real-hash", "anything")).toBe(false);
  });
});

describe("setup tokens", () => {
  it("stores only the sha256 of the plaintext", () => {
    const h = hashSetupToken("plaintext-token");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain("plaintext");
  });

  it("compares hashes in constant time semantics", () => {
    const a = hashSetupToken("token-a");
    const b = hashSetupToken("token-b");
    expect(tokenHashEquals(a, a)).toBe(true);
    expect(tokenHashEquals(a, b)).toBe(false);
    expect(tokenHashEquals(a, "short")).toBe(false);
  });

  it("liveness: unconsumed + unexpired is live; used or expired is dead", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(isTokenLive({ consumedAt: null, expiresAt: future })).toBe(true);
    expect(isTokenLive({ consumedAt: new Date(), expiresAt: future })).toBe(false);
    expect(isTokenLive({ consumedAt: null, expiresAt: past })).toBe(false);
  });
});
