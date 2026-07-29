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
// Required: DATABASE_URL; SUPABASE_URL plus AT LEAST ONE warehouse key
// (SUPABASE_SERVICE_KEY preferred since FIX 16, SUPABASE_ANON_KEY as the
// local-dev fallback — every sv_* route reads the warehouse, so booting
// without a key just defers a guaranteed failure to the first query); and
// APP_SECRET, which since FIX 12 is purely the session-JWT signing key —
// any strong random value satisfies it, and the Kimi OAuth set is gone
// entirely.
// Optional: BALLPARKPAL_API_KEY and ODDS_API_KEY (their surfaces degrade
// honestly without them) never block boot.
const REQUIRED = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "APP_SECRET",
] as const;

export function assertRequiredEnv(): void {
  const missing: string[] = REQUIRED.filter((name) => !process.env[name]);
  if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY) {
    missing.push("SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY");
  }
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
  // FIX 19: The Odds API key is OPTIONAL — game odds degrade to dashes
  // without it (no invented prices, same rule as flat -115 props). It is
  // deliberately NOT in REQUIRED: a missing key must never block boot or
  // fail a unit test. "" means "game odds unavailable".
  get oddsApiKey(): string {
    return process.env.ODDS_API_KEY ?? "";
  },
};
