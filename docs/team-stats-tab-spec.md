# Team Stats tab — verified build spec (Step 3)

Status: **aggregation verified against the live warehouse 2026-07-27.** All 30 teams return, 13–21 qualified batters each, 3,634–4,277 team PA. No new ingest required.

---

## 1. The query (run and verified)

```sql
select
  team_id,
  count(*)                                            as batters,
  sum(pa)                                             as team_pa,
  -- PA-weighted: rate stats accrue per plate appearance
  round(sum(woba  * pa) / nullif(sum(pa),0),  3)      as woba,
  round(sum(xwoba * pa) / nullif(sum(pa),0),  3)      as xwoba,
  round(sum(babip * pa) / nullif(sum(pa),0),  3)      as babip,
  round(sum(iso   * pa) / nullif(sum(pa),0),  3)      as iso,
  round(sum(slg   * pa) / nullif(sum(pa),0),  3)      as slg,
  round(sum(avg   * pa) / nullif(sum(pa),0),  3)      as avg,
  round(sum(k_pct  * pa) / nullif(sum(pa),0), 1)      as k_pct,
  round(sum(bb_pct * pa) / nullif(sum(pa),0), 1)      as bb_pct,
  round(sum(swstr_pct * pa) / nullif(sum(pa),0), 1)   as swstr_pct,
  round(sum(zone_pct  * pa) / nullif(sum(pa),0), 1)   as zone_pct,
  -- BBE-weighted: batted-ball rates accrue per batted-ball event, NOT per PA
  round(sum(hard_hit_pct * bbe) / nullif(sum(bbe),0), 1) as hardhit_pct,
  round(sum(barrel_pct   * bbe) / nullif(sum(bbe),0), 1) as barrel_pct,
  round(sum(gb_pct       * bbe) / nullif(sum(bbe),0), 1) as gb_pct,
  round(sum(fb_pct       * bbe) / nullif(sum(bbe),0), 1) as fb_pct,
  round(sum(ld_pct       * bbe) / nullif(sum(bbe),0), 1) as ld_pct,
  round(sum(hr_pct       * pa)  / nullif(sum(pa),0),  1) as hr_pct
from sv_stat_cache
where side  = 'batter'
  and split = 'season'
  and team_id is not null
  and pa >= 25            -- qualifier: drops cup-of-coffee bats from the team line
group by team_id;
```

**Two weighting notes that matter.** Rate stats are weighted by `pa`; batted-ball rates (HardHit%, Barrel%, GB/FB/LD) are weighted by `bbe`, because those percentages are denominated in batted-ball events, not plate appearances. Weighting them by PA overweights high-walk, low-contact hitters and shifts a team's Barrel% by a visible amount. Second, the `pa >= 25` qualifier is a **product decision, not a technical one** — it keeps a 9-PA September call-up from dragging a team line. Surface the threshold in the UI so it isn't a hidden assumption.

Verified sample (top of the wOBA sort): CHC .343 / LAD .343 / WSH .342 / PIT .342 / MIL .339 / TB .331. K% 19.2–24.1, HardHit% 34.5–40.8. Real MLB-shaped values.

`team_id → abbr` mapping already exists: `TEAM_ID_TO_ABBR` in `api/supabase/savant.ts:251`. Note it uses MLBAM style (`AZ`, `KC`, `SD`, `SF`, `TB`, `WSH`, `CWS`) while `src/data/mlbTeams.ts` uses classic style — the same `ARI`/`AZ` class of mismatch that broke the bullpen join. **Map through `TEAM_ID_TO_ABBR`, do not string-match team abbreviations.**

---

## 2. Columns: available vs not

Handigraphs ships 20. Fifteen are buildable from the query above with no new data.

| Handigraphs column | Status | Source |
|---|---|---|
| Team | ✅ | `TEAM_ID_TO_ABBR[team_id]` |
| wOBA | ✅ | PA-weighted |
| BABIP | ✅ | PA-weighted |
| ISO | ✅ | PA-weighted |
| K% | ✅ | PA-weighted |
| BB% | ✅ | PA-weighted |
| HardHit% | ✅ | BBE-weighted |
| Barrel% | ✅ | BBE-weighted |
| FB% | ✅ | BBE-weighted |
| LD% | ✅ | BBE-weighted |
| GB% | ✅ | BBE-weighted |
| SwStr% | ✅ | PA-weighted |
| GB/FB | ✅ | derived: `gb_pct / fb_pct` |
| OPS | ⚠️ | needs OBP — not in `sv_stat_cache`. Derive from MySQL `season_stats`, or omit |
| wRC+ | ❌ | park- and league-adjusted; needs a second source |
| Contact% | ❌ | not in `sv_stat_cache` |
| O-Swing% | ❌ | not in `sv_stat_cache` (`zone_pct` **is** available and is a reasonable adjacent column) |
| SB · SBA · SB% | ❌ | MLB Stats API ingest, not the warehouse |

Prizm-only additions worth shipping: **xwOBA** (verified live 2026-07-27: Handigraphs carries xwOBA on Starters and Batters but **not** on Team Stats — it shows wOBA only at team level. Showing both at team level exposes clubs over- or under-performing their contact quality), **SLG**, **AVG**, **HR%**, **Zone%**, and **`team_pa` / `batters` as a visible sample-size and qualifier readout**.

Ship the 13 confirmed plus GB/FB and the Prizm additions. Render the four unavailable columns as em-dashes with a tooltip naming the missing source, or omit them — do not approximate.

---

## 2b. Controls (verified live 2026-07-27) — CORRECTION

The Team Stats tab carries the **same market-keyed column presets as Starters**:
`K · BB · H · TB · SB · HR · ER · 2B`. Each swaps the visible column set — with `SB`
active the table renders only 7 columns (Team, ISO, HardHit%, Barrel%, SB, SBA, SB%)
and wOBA/wRC+ are absent from the DOM entirely. An earlier draft of this spec
documented presets on Starters only; they are on Team Stats too, and should be
assumed present on every stat tab until checked.

Also on this tab and not previously recorded:
- Splits: `SEASON · LAST 6 · LAST 12 · LAST 21 · VS RHP · VS LHP · HOME · AWAY · 2025`
- A `Table | Card` view toggle
- `Filter by game`, `EXPORT`, `FILTER`, `Stats & Colors`

Implication for Prizm: build the preset chips as part of this tab, not as a later
Step 4 item. A 20-column team table without presets is the same usability problem
as a 43-column pitcher table without them.

## 3. Rolling windows

Handigraphs offers `SEASON · LAST 6 · LAST 12 · LAST 21` games and `VS RHP · VS LHP · HOME · AWAY`.

`sv_stat_cache` splits are `season, l30, l60, l90, l120, home, away, vsL, vsR` — **plate-appearance windows, not game windows.** So:

- **Ship now:** SEASON, L30, L60, L90, L120 PA (swap the same aggregation's `split` filter), plus HOME, AWAY, VS RHP (`vsR`), VS LHP (`vsL`). Batter split coverage is 596–602 of 608, so these are near-complete.
- **Cannot ship:** L6 / L12 / L21 **game** windows. No date-bucketed team aggregation exists. Building it needs a rollup over `game_logs` by date — that is real work, not a config change.

The PA windows are arguably the better unit and are already Prizm's house convention. Use them and say so in the help modal rather than faking game windows.

---

## 4. Implementation shape

1. **Router:** add `teamStats` to the slate or a new `teams` router, hitting the query above via the existing `pgGet` client. Cache 5 min — it already does.
2. **Contract:** `MlbTeamStats { abbr, batters, teamPa, woba, xwoba, babip, iso, slg, avg, kPct, bbPct, swStrPct, zonePct, hardHitPct, barrelPct, gbPct, fbPct, ldPct, hrPct }`, all `number | null`.
3. **Columns:** `src/lib/columns/mlbTeams.ts`, mirroring `mlbPitchers.ts`. Every column needs `source` and `definition` — the type enforces it.
4. **Tab:** replace the `TabPlaceholder` in `Dashboard.tsx` (`tab === 'teams'`) with a `DataTable`. Heat baseline = the league mean for that column, since a team has no "own season baseline" to compare a window against.
5. **Provenance line:** `Baseball Savant → sv_stat_cache · N/30 teams · min 25 PA · updated {built_at}`.

**Scale trap:** sv percent fields are 0–100 as served. Use `fmt.svPct`, not `fmt.pct1`. Getting this wrong renders `2160%` instead of `21.6%`.

---

## 5. Why this tab is the cheapest one left

No new ingest, no new provider, no new credentials. It is one query against a table that is already populated, already paginated by the existing client, and rebuilt daily at 09:01 UTC. It closes a whole Handigraphs tab that Prizm does not have at all — and unlike Weather (needs a weather provider) or Gamecenter odds (needs a game-odds feed), nothing is blocking it.
