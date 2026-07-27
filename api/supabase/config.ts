// Supabase (rtm-data-warehouse) server-side configuration.
// Read from process.env only — no fallbacks, nothing committed. Set
// SUPABASE_URL and SUPABASE_ANON_KEY in the environment (see .env.example).
// NEVER expose these values to the client bundle — this module is server-only.
//
// Validation is lazy (on first use, via the getters below) so routes that
// never touch the warehouse — auth, angles, follows — keep working in a local
// environment without Supabase credentials; only sv_* reads fail loudly.

function readEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error("SUPABASE_URL is required (see .env.example)");
  }
  if (!key) {
    throw new Error("SUPABASE_ANON_KEY is required (see .env.example)");
  }
  return { url, key };
}

export const supabaseConfig = {
  get url(): string {
    return readEnv().url;
  },
  // publishable (anon) key — server-side use only
  get key(): string {
    return readEnv().key;
  },
};
