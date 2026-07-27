// Supabase (rtm-data-warehouse) server-side configuration.
// Read from process.env first; fall back to the provisioned publishable key so
// the server works without touching the checked-in .env. NEVER expose these
// values to the client bundle — this module is server-only.

export const supabaseConfig = {
  url:
    process.env.SUPABASE_URL?.replace(/\/$/, "") ??
    "https://bwzorxgiozrlaewrkeur.supabase.co",
  // publishable (anon) key — server-side use only
  key:
    process.env.SUPABASE_ANON_KEY ??
    "sb_publishable_xy_2CUVMSzjmyq9WLoQ_rw_D4dNa9Em",
};
