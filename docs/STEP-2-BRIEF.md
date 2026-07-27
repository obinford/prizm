# Prizm — Step 2 Build Brief

Self-contained. Paste the whole thing. Everything you need is here; ask only if something contradicts what's on disk.

---

## CONTEXT — what already exists

Branch `task-b-profiler-cleanup`, working tree has Step 1 applied (`PitcherTable.tsx` migrated, 221 lines, tsc green).

**The table engine is built and working. Do not rebuild it.**

| File | What it is |
|---|---|
| `src/lib/columns.ts` | The `ColumnDef` model + `fmt` formatters + preset helpers |
| `src/components/DataTable.tsx` | The one table component — grouped headers, sticky column, sort with nulls-last, heat with polarity inversion, em-dash for missing, header tooltips, skeleton, mobile cards |
| `src/lib/columns/mlbPitchers.ts` | 26 pitcher columns + `pitcherWindowColumns()` + 6 presets |
| `src/lib/columns/mlbBatters.ts` | 29 batter columns + `batterWindowColumns()` + 7 presets |
| `src/pages/dashboard/PitcherTable.tsx` | **The reference implementation.** Read it first — every task below follows its shape. |

### `ColumnDef` (from `src/lib/columns.ts`)

```ts
interface ColumnDef<Row> {
  key: string
  label: string
  group?: string                      // renders a group header band above
  value: (row: Row) => number | string | null
  format?: (v: number) => string
  baseline?: (row: Row) => number | null   // enables heat when heat: true
  invert?: boolean                    // lower is better -> flip heat polarity
  heat?: boolean
  source: string                      // REQUIRED — provenance, shows in tooltip
  definition: string                  // REQUIRED — plain language, shows in tooltip
  markets?: string[]
  sortable?: boolean
  sticky?: boolean
  align?: 'left' | 'center' | 'right'
  minWidth?: number
  render?: (row: Row) => ReactNode    // escape hatch for non-scalar cells
  missingHint?: string                // tooltip on an em-dash cell
}
```

`source` and `definition` are **non-optional**. TypeScript will not compile a column missing either. That is deliberate — a clean `tsc` is the proof that every column declares where its number came from.

### `DataTable` props

```ts
<DataTable<Row>
  columns={ColumnDef<Row>[]}
  rows={Row[]}
  rowKey={(r) => string}
  loading?={boolean}
  filterSig?={string}                 // bump to replay the re-tint sweep
  onRowClick?={(r) => void}
  emptyLabel?={string}
  onResetFilters?={() => void}
  provenance?={string}                // line rendered above the table
  defaultSortKey?={string}
  defaultSortDir?={1 | -1}
  mobileTitle?={(r) => string}
  mobileSummary?={(r) => string}
/>
```

### `BatterRow` (from `src/lib/columns/mlbBatters.ts`)

```ts
interface BatterRow {
  batter: Batter
  oppHand?: 'L' | 'R' | null   // opposing starter's hand
  opp?: string                 // opponent abbr
  homeAway?: 'Home' | 'Away'
}
```

`batterWindowColumns(window, windowLabel, stats?)` returns heat-coloured window columns. Default stats: `avg, obp, slg, iso, xbh, tb`.

`BATTER_PRESETS` keys: `h · tb · hr · 2b · k · bb · contact`.

---

## HARD RULES

```
1. NO FABRICATED DATA. Never render a number that did not come from a real
   source. If data does not exist, render an em-dash with a tooltip saying why.
   Reference: api/ingest/nhl.ts:54-55.

2. USE THE EXISTING DESIGN SYSTEM. tailwind.config.js and src/index.css define
   the tokens. No new colours, fonts, radii or easings.

3. NO NEW DEPENDENCIES without stating the reason and bundle cost.

4. NEVER START A FOREGROUND SERVER. Background with a timeout, use it, kill it.
   `npx tsc -b` and `npx vite build` are the required checks and both exit.

5. EVERY CHANGE MUST COMPILE. Run both, paste the real output.

6. WHEN YOU DELETE SOMETHING, SAY SO IN THE UI or in a code comment explaining
   what was removed and why.

7. DO NOT invent columns. Only the ones defined in the two column files. If you
   think one is missing, say so — do not add it with a made-up source string.
```

---

# TASK 2.1 — Migrate the Batters tab to DataTable

**This is the main task.** `src/pages/dashboard/LineupsTab.tsx` currently renders the shared `SplitTable` once per game, showing 5 stats × 4 windows with **no sorting on any column**. Handigraphs ships 50 columns, sorted, in one flat table.

### 2.1a — Flatten the structure

Today LineupsTab renders a collapsible section per game, each containing its own `SplitTable`. **Handigraphs does not do this** — its Batters tab is one flat table sorted by team, with a `Filter by game` dropdown.

Flatten it. One `DataTable`, all batters on the slate, with:
- a `Game` column (`{AWAY} @ {HOME}`) so the grouping information is not lost
- a `Filter by game` dropdown above the table that narrows rows

Keep the existing per-game pitcher chips (name + K% + hand) — move them into the `Filter by game` dropdown options or a compact strip above the table. Do not delete that information; it is the opposing-starter context.

### 2.1b — Build the row list

```ts
const rows: BatterRow[] = useMemo(() => {
  // For each game on the slate, for each batter on both teams:
  //   batter, opp (the other team's abbr), homeAway,
  //   oppHand = the opposing probable starter's `throws` value, or null
  // oppHand comes from the slate's probable pitcher for the OPPOSING team.
  // If no probable is named, oppHand must be null — the Opp L/R column will
  // dash out. Do not guess a hand.
}, [/* slate, query, filters */])
```

Preserve the existing filter behaviour in `LineupsTab.tsx`: `handedness` filters batters by the opposing starter's hand, `venue` filters home/away, and the search box matches batter name.

### 2.1c — Assemble columns

Follow `PitcherTable.tsx` exactly. The shape is:

```ts
const columns = useMemo<ColumnDef<BatterRow>[]>(() => {
  const identity: ColumnDef<BatterRow> = {
    key: 'player',
    label: 'Player',
    value: (r) => r.batter.name,
    source: 'MLB Stats API → players',
    definition: 'Batter.',
    sticky: true,
    minWidth: 190,
    render: (r) => (
      <>
        <span className="block text-sm font-semibold text-text-1">{r.batter.name}</span>
        <span className="data-mono block text-[11px] text-text-3">
          {r.batter.team} · {r.batter.pos} · {r.batter.bats}
        </span>
      </>
    ),
  }

  const presetKey = market ? MARKET_TO_PRESET[market] : undefined
  const preset = presetKey ? BATTER_PRESETS.find((p) => p.key === presetKey) : undefined
  const wanted = preset ? new Set([...ALWAYS_SHOW, ...preset.columns]) : null
  const stats = BATTER_COLUMNS.filter((c) => !wanted || wanted.has(c.key))

  const windowCols = windows.flatMap((w) =>
    batterWindowColumns(w, MLB_WINDOW_LABELS[w]),
  )

  return [identity, gameCol, ...stats, ...windowCols, actionsCol]
}, [market, windows, /* ... */])
```

`ALWAYS_SHOW` for batters: `['team', 'pos', 'bats', 'oppHand', 'game']`.

`MARKET_TO_PRESET` for batters — map the dashboard's `Market` chip values onto `BATTER_PRESETS`. The existing market options are `ks | hits | er | outs`; those are pitcher-shaped. **Add batter-appropriate market values to the `Market` filter in `Dashboard.tsx`** (`hits → h`, `tb → tb`, `hr → hr`, `doubles → 2b`, `ks → k`, `walks → bb`) and only show the batter set when the Batters tab is active.

### 2.1d — Keep the drawer and the angle action

`LineupsTab` currently opens a batter drawer via `SplitTable`'s built-in drawer. `DataTable` has no drawer — wire `onRowClick` to your own drawer component, reusing the existing drawer content (season baseline grid, per-window blocks, Statcast chips, opposing-starter block).

Add a `+ Angle` action column exactly as `PitcherTable.tsx` does (`AnglePopover` + `addToAngle` with `kind: 'mlb-batter'`).

### Acceptance for 2.1
- One flat sortable table, every column sortable
- ~29 batter columns available; preset narrows them
- `Opp L/R` renders `LHP`/`RHP` where a probable is named, em-dash otherwise
- Window cells heat-coloured against each batter's own season baseline
- Drawer opens on row click; `+ Angle` works
- `Filter by game` narrows rows
- `tsc -b` exit 0, `vite build` exit 0

---

# TASK 2.2 — Migrate the Bullpen tab to DataTable

`src/pages/dashboard/BullpenTab.tsx` is already simple (6 columns, hand-rolled). Convert it to `DataTable` so all five tables share one engine.

Create `src/lib/columns/mlbBullpen.ts` with a `BullpenRow = { team: MlbTeam, era, whip, kPct, bbPct, relievers }` shape and column defs for: Team (sticky, render city+name over abbr/league/division), ERA, WHIP, K%, BB%, Arms.

Sources: `MLB Stats API game logs → team_stats (reliever aggregates)`. Definitions in your own words.

Keep: the coverage provenance line (`Team reliever aggregates … N/30 teams covered`), nulls sorting last, the drawer with its honest "Individual reliever lines are not available yet" placeholder.

`invert: true` on ERA, WHIP and BB%. No heat (there is no per-team baseline to compare against yet).

### Acceptance for 2.2
- Bullpen renders through `DataTable`, all columns sortable
- Coverage line preserved
- Uncovered teams dash and sort last
- Both checks green

---

# TASK 2.3 — Column preset chips

Right now presets are driven indirectly by the `Market` dropdown. Handigraphs exposes them as a **visible chip row** above the table (their "My Views": K · BB · H · TB · SB · HR · ER · 2B).

Add a chip row above the table on Starters and Batters:

```tsx
<div className="flex items-center gap-2">
  <span className="overline-caption text-text-3">Views</span>
  {presets.map((p) => (
    <button
      key={p.key}
      onClick={() => setPreset(preset === p.key ? undefined : p.key)}
      aria-pressed={preset === p.key}
      title={p.description}
      className={/* active: bg-bg-3 text-text-1 ; else text-text-3 */}
    >
      {p.label}
    </button>
  ))}
</div>
```

Clicking an active chip clears it (back to all columns). Preset state is local for now — persisting it is Step 5, not this task.

Use `PITCHER_PRESETS` on Starters, `BATTER_PRESETS` on Batters. Pass the resolved preset into the column assembly instead of reading `market`. Leave the `Market` filter chip working as it does today; the two can coexist.

### Acceptance for 2.3
- Chip row renders on both tabs, correct preset list per tab
- Clicking narrows columns; clicking again restores all
- `title` shows the preset description on hover
- Both checks green

---

# TASK 2.4 — Retire SplitTable

Once 2.1 lands, `src/components/SplitTable.tsx` has one remaining consumer: the GameCenter "Recent splits matrix" (`src/pages/gamecenter/GameDetail.tsx`).

Migrate that to `DataTable` using `BATTER_COLUMNS` narrowed to `avg, slg, xbh` plus `batterWindowColumns` for all four windows, then **delete `SplitTable.tsx`**.

If migrating GameDetail turns out to be more than a small change, stop and report rather than forcing it — leaving `SplitTable` alive for one consumer is acceptable; a half-migrated GameDetail is not.

### Acceptance for 2.4
- `grep -rn "SplitTable" src/` returns nothing (or only the GameDetail consumer, if you stopped)
- GameCenter detail still renders its splits matrix
- Both checks green

---

## ORDER AND REPORTING

Do them in order: **2.1 → 2.2 → 2.3 → 2.4**. Commit after each with a clear message. Run `npx tsc -b` and `npx vite build` after each and paste real output.

When all four are done, report:
1. Final column count actually rendering on Starters and on Batters
2. Which columns dash out and why
3. Whether any column in the two column files is defined but unreachable from the UI
4. `wc -l` before and after for each migrated file
5. Anything you had to change in the column files, and why

**Do not** touch `src/lib/columns.ts` or `src/components/DataTable.tsx` unless something is genuinely broken in them — if so, report it rather than working around it. Those two files are the contract every table depends on.

**Do not** add columns with invented `source` strings. If a stat you want is not in `sv_stat_cache` or `season_stats`, it does not exist yet — say so.
