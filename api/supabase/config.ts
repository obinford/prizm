// Supabase (rtm-data-warehouse) server-side configuration.
// Read from process.env only — no fallbacks, nothing committed. See .env.example.
// NEVER expose these values to the client bundle — this module is server-only.
//
// FIX 16 (2026-07-29): the app authenticates to the warehouse with the
// SECRET key (SUPABASE_SERVICE_KEY, sb_secret_...) whenever one is present —
// the publishable anon key is in public git history, so warehouse read
// access moves behind the server-only secret and anon grants get revoked
// (six matviews + six SECURITY DEFINER functions, per the advisor output).
// SUPABASE_ANON_KEY remains as the local-dev fallback until the secret key
// is distributed; production sets SUPABASE_SERVICE_KEY only.
//
// Validation is lazy (on first use, via the getters below) so routes that
// never touch the warehouse — auth, angles, follows — keep working in a local
// environment without Supabase credentials; only sv_* reads fail loudly.

function readEnv(): { url: string; key: string; keyKind: "service" | "anon" } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const service = process.env.SUPABASE_SERVICE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error("SUPABASE_URL is required (see .env.example)");
  }
  if (!service && !anon) {
    throw new Error(
      "SUPABASE_SERVICE_KEY (preferred) or SUPABASE_ANON_KEY is required (see .env.example)",
    );
  }
  return service
    ? { url, key: service, keyKind: "service" }
    : { url, key: anon as string, keyKind: "anon" };
}

export const supabaseConfig = {
  get url(): string {
    return readEnv().url;
  },
  // secret key when present (FIX 16), anon publishable key otherwise —
  // either way server-side only
  get key(): string {
    return readEnv().key;
  },
  /** Which credential the warehouse is being read with (provenance). */
  get keyKind(): "service" | "anon" {
    return readEnv().keyKind;
  },
};
