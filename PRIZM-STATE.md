# Prizm — Living Project State

**Updated:** 2026-07-27 · **Repo:** `github.com/obinford/prizm` · **Branch:** `task-b-profiler-cleanup` @ `ac260b0` (pushed)

This file is the memory. Claude sessions do not persist — hand this to any new session (Claude or Kimi) and it can continue without reconstructing context. Update it at the end of each working session.

---

## 1. The goal

Bring Prizm's **MLB** surface to sibling-level parity with Handigraphs across seven tabs: Gamecenter · Edgecenter · Starters · Team Stats · Bullpen · Batters · Weather. DFS excluded. NHL parked. NFL is a later vertical (2026 season, Week 1 = 9 Sept 2026).

Full tab-by-tab, column-by-column delta and the 11-step build order live in `2026-07-27-prizm-handigraphs-alignment.md`.

**Product thesis to protect:** competitors ship *descriptive* tools (hit rates, splits — what already happened). Prizm ships a *priced edge*: model probability vs a de-vigged market price, with sample size and uncertainty shown, and a public closing-line-value record.

---

## 2. Branch state

```
902263c  prizm v3.1 (original)
3b6b370  Phase 0: build repair, fonts, env-only Supabase, initial migration
b13dbe9  Task B: profiler fabrication deletions (Kimi)
fb69b7e  Steps 0+1: seven-tab dashboard, ColumnDef model, slate stepper, Phase 1 fixes
ac260b0  fix: surface API errors instead of spinning forever  ← HEAD, pushed
```

`main` does **not** contain any of this. Merge when the runtime check passes.

Verification at HEAD: `npx tsc -b` exit 0 · `npx vite build` ✓ (~5s) · index bundle ~1,513 kB.

---

## 3. Done

**Phase 0 — build repair.** Six missing modules created; eight orphaned profiler components wired; fonts self-hosted; Supabase key removed from source; initial Drizzle migration; dead deps removed; landing sections with missing assets removed.

**Phase 1 — data integrity (MLB).** Every fabrication in the MLB surface is gone:
- `splitFactor()` deleted — was multiplying every stat by a hash-derived ±6% under a split filter, including real Statcast xwOBA. Replaced with `splitStat()` / `splitWindowStat()` reading real `sv_stat_cache` split rows.
- EdgeCenter: hardcoded "3–2" track record, five literal ✓/✗ results, "Generated 9:00 AM ET", and canned per-market prose all removed. `edgeNote()` now states only row values. Added `impliedProb()` / `rawEdgePp()` — raw-implied only until Phase 3.2 de-vigged it (see below).
- GameCenter: `vsHistory()` (hash-generated batter-vs-pitcher lines) and seven `AUTHORED_READS` essays deleted.
- Hit Rates: `propsRouter` now returns `recentValues` (real per-game values it already computed and discarded); the hit/miss strip is real. Line-history sparkline deleted — no series exists in `sv_odds`.
- Bullpen: LEV%, fatigue pitch counts, L7/L14/L30 windows and four invented relievers removed. Kept real ERA/WHIP/K%, surfaced real BB% and reliever count. Fixed `ARI`/`AZ` join bug.
- `api/loaders.ts` was dropping 12 ingested Statcast fields; now maps `swStrPct, zonePct, gbPct, fbPct, ldPct, iso, slg, avg, hrPct, bbe, games`. Two of them were being *fabricated* elsewhere while sitting unused.
- Profiler deletions (Kimi, Task B): `derive.ts` 599 → 304 lines. Removed fabricated game logs, trend series, similar profiles, form delta, goalie/skater header extras, unsupported split cards, slug-derived age/contract, static news.

**Steps 0+1 — structure.**
- One MLB dashboard, **seven tabs** in Handigraphs order. `/gamecenter`, `/edgecenter`, `/hit-rates` are now `<Navigate>` redirects into tabs (deep links preserved via `?tab=` / `?view=`).
- Hit Rates is a `TABLE | HIT RATES` view toggle on Starters and Batters.
- `src/lib/columns.ts` — `ColumnDef` model. **`source` and `definition` are required, non-optional fields**, so TypeScript will not compile a column that fails to declare where its number came from and what it means. `tsc` passing *is* the coverage proof.
- `src/components/DataTable.tsx` — one table: grouped headers, sticky identity, sort with nulls-last, heat with per-column polarity inversion, em-dash for missing, header tooltips, mobile cards.
- `src/lib/columns/mlbPitchers.ts` — 26 pitcher columns + window factory + 6 market presets (K/BB/H/ER/HR/Contact).
- Today/Tomorrow stepper wired via `src/lib/slateDay.ts` (was three inert elements).
- Team Stats and Weather render honest "Not built" placeholders naming their blockers and what's already ingested.

**Bug fix.** `LiveDataProvider` checked loading *before* errors, so one stuck query hid failures in the other six and the designed error state could never render — any API blip meant an infinite spinner. Error check now runs first, plus a 12s watchdog and per-procedure failure detail.

---

## 4. Verified facts (queried, not assumed)

Warehouse `bwzorxgiozrlaewrkeur`, rebuilt 2026-07-27 09:01 UTC:

| Fact | Value |
|---|---|
| Pitchers with vsL splits | 756 / 759 = **99.6%** |
| Pitchers with vsR | 759 / 759 = 100% |
| Batters with vsL / vsR | 596 / 602 of 608 |
| **Today's probable starters with vsL** | **23 / 23 = 100%**, avg **174 TBF** |
| Split keys | `season, l30, l60, l90, l120, home, away, vsL, vsR` — exact, case-sensitive, one row per player |
| vsL rows with non-null k_pct / bb_pct / xwoba | 756 / 756 |
| Reference MLBAM ids | Skubal 669373 · Skenes 694973 · Alcantara 645261 · Wheeler 554430 · deGrom 594798 |

`sv_stat_cache` has **no** ERA/WHIP/FIP at any split — those columns legitimately dash out under a split filter.

---

## 5. Open — in priority order

**5.1 Runtime check (Kimi).** BLOCKED on `DATABASE_URL`. `.env` has SUPABASE_URL ✓, SUPABASE_ANON_KEY ✓, KIMI_AUTH_URL = PLACEHOLDER, DATABASE_URL empty.

Everything upstream is eliminated: data exists, split keys correct, pagination works, no int/string coercion issue, `.env` reaches `process.env`, tonight's starters 23/23 covered. **One unknown remains** — whether `players.extId` in MySQL holds MLBAM ids.

Oracle: `select name, extId from players where name like '%Skubal%' or name like '%Skenes%' or name like '%Wheeler%' or name like '%deGrom%';` → expect 669373 / 694973 / 554430 / 594798. Five-for-five = join sound. Sequential ints or nulls = that's the bug.

Then: **zero em-dashes expected** under vs-LHB today. Any dash is a bug. Also capture the bullpen coverage number `N/30` — still unknown, lives in MySQL.

**5.2 Finish Step 1 — migrate `PitcherTable` to `DataTable` (Claude).** The model and columns exist; nothing consumes them. This is the gate on Step 2.

**5.3 Profiler REWIRE (Kimi).** Now unblocked by patch 4. In `derive.ts`: batter K%/BB%/xwOBA from `player.xwobaReal` + sv split rows; pitcher GB%/SwStr% from `gbPct`/`swStrPct`; vs-LHP/RHP + Home/Away split cards from real sv splits. Delete `mulberry32`/`hashString` once nothing references them. Leave `StatcastStrip.tsx` alone — it is already correct.

**5.4 Real game logs.** A tRPC procedure serving per-player rows from `game_logs` (real rows exist; `propsRouter.ts:86-90` already queries them). Replaces the deleted fabricated logs.

**5.5 Provenance chips** on every table — source + last-updated. `FreshnessChip` in AppShell is the pattern.

**Then Step 2** (column expansion — pure config once 5.2 lands), Step 3 (Team Stats — cheapest whole tab, mostly aggregation over data already held), Step 4 (market presets, filter rule builder, sorting everywhere, CSV, filter-by-game), Step 5 (server-persist views/filters — copy `src/pages/angles/store.ts`).

---

## 6. Standing decisions

- **No fabricated data.** Missing → em-dash + tooltip. Reference: `api/ingest/nhl.ts:54-55`.
- **No fake AI.** No fictional model names.
- **Copy features, never assets.** Generic data-grid patterns are fine; competitor copy, glossary wording and visual identity are not. All prose written fresh.
- **Never start a foreground server.** Background with a timeout, then kill. `tsc -b` and `vite build` are the required checks.
- **Three places Prizm is ahead — do not regress:** the heat implementation actually renders (Handigraphs' does not on its flagship tables); colour is baseline-relative, not league-relative; the edge is de-vigged (multiplicative) and carries its Wilson CI and sample size.

## 7. Known issues not yet fixed

- `src/data/mlbPlayers.ts` **hand-mirrors** `contracts/prizm.ts` instead of importing it. They drift silently — patch 4 extended the contract and the client saw nothing until the mirror was extended by hand. Unify.
- `SlateGame.total` is declared and written by no loader → `O/U` renders empty. Needs a game-odds feed (also blocks Gamecenter's moneyline/runline/total block).
- No game odds anywhere. `sv_odds` is player props only.
- No batting order and no opponent-handedness column — Handigraphs' columns 4 and 6. Needs a lineup feed.
- **Supabase: 31 tables grant `SELECT` to `anon`**, including `sv_stat_cache`, `sv_odds`, `bp_projections`, `dg_preds_archive`, `rtm_track_record`. The publishable key is in permanent history on a public repo. Rotating alone does not close this — the fix is a `sb_secret_` key server-side plus dropping anon read on proprietary tables. Blocked on knowing what else reads that warehouse.
- `step-0-1-structural-foundation.patch` untracked via `git rm --cached`; `*.patch` gitignored.
