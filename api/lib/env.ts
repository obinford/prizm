import "dotenv/config";

// Boot-time validation, every environment. Previously a missing variable
// silently became "" in development and surfaced much later as something
// unhelpful — e.g. an empty KIMI_AUTH_URL crashed inside `new URL()` with
// "Invalid URL" and no mention of which value was unset.
//
// The check collects ALL missing required variables and throws once with the
// full list, so a first run prints everything that is needed instead of one
// variable per restart.
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

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable${missing.length === 1 ? "" : "s"}:\n` +
      missing.map((name) => `  - ${name}`).join("\n") +
      `\n\nCopy .env.example to .env and fill in every value, then restart.`,
  );
}

function required(name: (typeof REQUIRED)[number]): string {
  // Guaranteed present — the boot check above threw otherwise.
  return process.env[name] as string;
}

export const env = {
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
};
