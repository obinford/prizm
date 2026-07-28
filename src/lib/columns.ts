// Column definition model — the single source of truth for every Prizm table.
//
// Before this, five hand-rolled table implementations (PitcherTable, SplitTable,
// BullpenTab, ResultsTable, GameLogs) each re-declared headers, formatting, sort
// behaviour, heat polarity and null handling. Adding a column meant editing a
// component; adding a sport meant writing another table.
//
// A ColumnDef carries everything a cell needs: how to read it, how to print it,
// whether lower is better, where the number came from, and what it means. The
// DataTable renders any list of ColumnDefs, so a new column is data and a new
// sport is a new column list.

import type { ReactNode } from 'react'

export type CellValue = number | string | null

export interface ColumnDef<Row> {
  /** Stable id — used for sort state, saved views and column presets. */
  key: string
  /** Literal header text. */
  label: string
  /** Optional group header rendered above (e.g. 'Season', 'L30 PA'). */
  group?: string

  /** Read the value off a row. Return null when there is no real source. */
  value: (row: Row) => CellValue
  /** Format a numeric value for display. Ignored for string values. */
  format?: (v: number) => string

  /**
   * Baseline for heat colouring. When provided and `heat` is true, the cell is
   * tinted by the signed % delta of value vs baseline. Return null to skip.
   */
  baseline?: (row: Row) => number | null
  /** Lower is better (ERA, WHIP, xwOBA against) — flips heat polarity. */
  invert?: boolean
  heat?: boolean

  /** Provenance string, shown in the header tooltip. Required — no exceptions. */
  source: string
  /** Plain-language definition. Feeds the header tooltip and the glossary. */
  definition: string
  /** Betting markets this stat informs. Feeds the glossary. */
  markets?: string[]

  sortable?: boolean
  sticky?: boolean
  align?: 'left' | 'center' | 'right'
  minWidth?: number

  /** Escape hatch for identity cells that are not a single scalar. */
  render?: (row: Row) => ReactNode
  /** Tooltip shown on an em-dash cell, explaining why the value is missing. */
  missingHint?: string
  /**
   * Per-row missing reason — wins over missingHint when it returns a string.
   * For values whose absence means different things on different rows (e.g.
   * lineup not posted vs posted but not starting). Collapsing those states
   * into one hint is the lie this exists to avoid.
   */
  missingHintFor?: (row: Row) => string | undefined
}

/** A named column set — the market-keyed presets (K, BB, H, TB, ...). */
export interface ColumnPreset {
  key: string
  label: string
  /** Column keys to show, in order. Identity columns are always prepended. */
  columns: string[]
  description?: string
}

/** Ordered group labels for a column list, preserving first-seen order. */
export function columnGroups<Row>(cols: ColumnDef<Row>[]): (string | undefined)[] {
  const seen: (string | undefined)[] = []
  for (const c of cols) {
    if (seen.length === 0 || seen[seen.length - 1] !== c.group) seen.push(c.group)
  }
  return seen
}

/** Column span for each group header, in the same order as columnGroups(). */
export function groupSpans<Row>(cols: ColumnDef<Row>[]): { group?: string; span: number }[] {
  const out: { group?: string; span: number }[] = []
  for (const c of cols) {
    const last = out[out.length - 1]
    if (last && last.group === c.group) last.span += 1
    else out.push({ group: c.group, span: 1 })
  }
  return out
}

/** Resolve a preset to an ordered ColumnDef list. Unknown keys are dropped. */
export function applyPreset<Row>(
  cols: ColumnDef<Row>[],
  preset: ColumnPreset | undefined,
  alwaysShow: string[] = [],
): ColumnDef<Row>[] {
  if (!preset) return cols
  const wanted = new Set([...alwaysShow, ...preset.columns])
  const byKey = new Map(cols.map((c) => [c.key, c]))
  const ordered: ColumnDef<Row>[] = []
  for (const k of alwaysShow) {
    const c = byKey.get(k)
    if (c) ordered.push(c)
  }
  for (const k of preset.columns) {
    if (alwaysShow.includes(k)) continue
    const c = byKey.get(k)
    if (c) ordered.push(c)
  }
  // Preserve any sticky identity columns the preset forgot.
  for (const c of cols) {
    if (c.sticky && !wanted.has(c.key)) ordered.unshift(c)
  }
  return ordered
}

// ---------------------------------------------------------------------------
// Shared formatters
// ---------------------------------------------------------------------------

export const fmt = {
  /** 3.42 */
  era: (v: number) => v.toFixed(2),
  /** 1.08 */
  whip: (v: number) => v.toFixed(2),
  /** 24.1% — for 0-1 scale rates */
  pct1: (v: number) => `${(v * 100).toFixed(1)}%`,
  /** 24.1% — for values already on a 0-100 scale (sv native) */
  svPct: (v: number) => `${v.toFixed(1)}%`,
  /** .312 — baseball rate convention */
  rate: (v: number) => v.toFixed(3).replace(/^0/, ''),
  /** 1 decimal */
  dec1: (v: number) => v.toFixed(1),
  /** 2 decimals */
  dec2: (v: number) => v.toFixed(2),
  /** whole number */
  int: (v: number) => String(Math.round(v)),
  /** 91.2 mph style — bare number, unit lives in the header */
  ev: (v: number) => v.toFixed(1),
}
