import "dotenv/config";

// Environment access (FIX 11). Importing this module has NO side effects
// beyond dotenv loading: nothing here demands values at import time, so unit
// tests importing modules that transitively touch env run on a clean
// checkout with no .env present.
//
// Two access patterns:
//   1. assertRequiredEnv() — called ONCE from api/boot.ts before the server
//      listens. Fails loudly with the FULL missing list.
//   2. The lazy `env` accessor — getters evaluate process.env at access
//      time. If code reaches for a required value that is not there (e.g.
//      an ingest script skipping the boot check), the getter throws the same
//      full-list error at the point of use, never silently "".
//
// Required: DATABASE_URL; the Supabase pair (every data route — sv_odds,
// sv_stat_cache, sv_slate — reads the warehouse, so booting without it just
// defers a guaranteed failure to the first query); and APP_SECRET, which
// since FIX 12 is purely the session-JWT signing key — any strong random
// value satisfies it, and the Kimi OAuth set is gone entirely.
// Optional: BALLPARKPAL_API_KEY (the Weather tab degrades without it)
// never blocks boot.
const REQUIRED = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "APP_SECRET",
] as const;

export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}:\n` +
        missing.map((name) => `  - ${name}`).join("\n") +
        `\n\nCopy .env.example to .env and fill in every value, then restart.`,
    );
  }
}

function lazy(name: (typeof REQUIRED)[number]): string {
  if (!process.env[name]) assertRequiredEnv(); // throws the full list
  return process.env[name] as string;
}

export const env = {
  get appSecret(): string {
    return lazy("APP_SECRET");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get databaseUrl(): string {
    return lazy("DATABASE_URL");
  },
};
