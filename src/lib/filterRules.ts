// Numeric and text predicates over any ColumnDef, for any table.
//
// Rules resolve through ColumnDef.value(row) — never through row internals.
// That is what lets one rule builder serve Starters, Batters, Bullpen and
// Team Stats without knowing any of their row shapes.

import type { ColumnDef } from '@/lib/columns'

export type RuleOperator =
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'between'
  | 'isNull' | 'notNull'
  | 'contains'

export interface FilterRule {
  id: string
  columnKey: string
  op: RuleOperator
  /** Numeric operand, or the needle for `contains`. */
  value?: number | string
  /** Upper bound for `between` only. */
  value2?: number
}

export const NUMERIC_OPS: RuleOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between']
export const NULL_OPS: RuleOperator[] = ['isNull', 'notNull']
export const TEXT_OPS: RuleOperator[] = ['contains', 'eq', 'neq']

export const OP_LABELS: Record<RuleOperator, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠',
  between: 'between', isNull: 'is missing', notNull: 'has a value',
  contains: 'contains',
}

/**
 * Apply one rule to one row.
 *
 * SCALE WARNING: the operand is compared against the RAW value, not the
 * formatted one. sv percent fields are 0-100, so `kPct > 25` on a batter
 * column means 25%, but legacy MySQL kPct/bbPct are 0-1, where 25 is
 * unreachable. The rule editor must show the column's raw range as a hint —
 * see B.2. Do not silently rescale; that hides the inconsistency instead of
 * surfacing it.
 */
export function applyRule<Row>(rule: FilterRule, col: ColumnDef<Row>, row: Row): boolean {
  const raw = col.value(row)

  if (rule.op === 'isNull') return raw == null
  if (rule.op === 'notNull') return raw != null

  // A missing value fails every positive predicate. It is not zero and it is
  // not "unknown, so include it" — an em-dash row must not satisfy `> 25`.
  if (raw == null) return false

  if (rule.op === 'contains') {
    const needle = String(rule.value ?? '').trim().toLowerCase()
    return needle === '' || String(raw).toLowerCase().includes(needle)
  }

  if (typeof raw === 'string') {
    const operand = String(rule.value ?? '').trim().toLowerCase()
    const hay = raw.toLowerCase()
    if (rule.op === 'eq') return hay === operand
    if (rule.op === 'neq') return hay !== operand
    return false // numeric operators do not apply to a text column
  }

  const a = typeof rule.value === 'number' ? rule.value : Number(rule.value)
  if (!Number.isFinite(a)) return true // incomplete rule filters nothing

  switch (rule.op) {
    case 'gt': return raw > a
    case 'gte': return raw >= a
    case 'lt': return raw < a
    case 'lte': return raw <= a
    case 'eq': return raw === a
    case 'neq': return raw !== a
    case 'between': {
      const b = rule.value2
      if (b == null || !Number.isFinite(b)) return true
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      return raw >= lo && raw <= hi
    }
    default: return true
  }
}

/** All rules must pass — AND semantics. See the note in the brief on why. */
export function applyRules<Row>(
  rules: FilterRule[],
  columns: ColumnDef<Row>[],
  rows: Row[],
): Row[] {
  if (rules.length === 0) return rows
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const active = rules
    .map((r) => ({ rule: r, col: byKey.get(r.columnKey) }))
    .filter((x): x is { rule: FilterRule; col: ColumnDef<Row> } => x.col != null)
  if (active.length === 0) return rows
  return rows.filter((row) => active.every(({ rule, col }) => applyRule(rule, col, row)))
}

/** Human-readable summary for the chip row and the CSV header. */
export function describeRule<Row>(rule: FilterRule, columns: ColumnDef<Row>[]): string {
  const col = columns.find((c) => c.key === rule.columnKey)
  const label = col?.label ?? rule.columnKey
  if (rule.op === 'isNull') return `${label} is missing`
  if (rule.op === 'notNull') return `${label} has a value`
  if (rule.op === 'between') return `${label} between ${rule.value} and ${rule.value2}`
  return `${label} ${OP_LABELS[rule.op]} ${rule.value ?? ''}`.trim()
}
