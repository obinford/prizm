# Prizm — See Every Side of the Bet

MLB + NHL prop-research analytics platform. Real Statcast/MLB-API rolling splits, real multi-book odds, hit-rate scanner, AI research tools.

## Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Hono + tRPC 11 + Drizzle ORM
- **Data**: Supabase Statcast warehouse (sv_*) + MLB/NHL official public APIs + MySQL
- **Auth**: Kimi OAuth

## Structure
- `src/` — React frontend (marketing + app)
- `api/` — Hono/tRPC backend (routers, ingestion, supabase client)
- `contracts/` — shared frontend/backend types
- `db/` — Drizzle schema + migrations

## Data sources
- MLB Stats API (statsapi.mlb.com) — rosters, game logs, schedule
- Baseball Savant warehouse — xwOBA/xBA/xSLG, barrel%, hard-hit%, whiff% (season + L30/60/90/120 + vsL/vsR/home/away splits)
- NHL API (api-web.nhle.com) — goalies/skaters, game logs
- Multi-book prop odds (34 books incl. Pinnacle, consensus lines, refreshed daily)
