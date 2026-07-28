// Rule engine + CSV export contract tests.
//
// These two modules are pure functions with semantics that are easy to get
// subtly wrong and impossible to eyeball in the UI: what a missing value does
// to a predicate, what a reversed `between` means, what happens to a rule whose
// column a preset has hidden, and whether an exported file is actually parseable
// as CSV. Step 4 shipped with `vitest 6/6` green, but all six were the
// pre-existing live-bridge tests — none of this was covered.

import { describe, expect, it } from 'vitest'
import type { ColumnDef } from './columns'
import { applyRule, applyRules, describeRule, type FilterRule } from './filterRules'
import { csvProvenanceLine, toCsv, withProvenance } from './exportCsv'

interface Row {
  name: string
  k: number | null
}

const nameCol: ColumnDef<Row> = {
  key: 'name',
  label: 'Player',
  value: (r) => r.name,
  source: 'test',
  definition: 'test',
}

const kCol: ColumnDef<Row> = {
  key: 'k',
  label: 'K%',
  value: (r) => r.k,
  format: (v) => `${v.toFixed(1)}%`,
  source: 'test',
  definition: 'test',
}

// A column the tab renders but no rule references — proves filtering is keyed
// on the rule, not on the column list length.
const eraCol: ColumnDef<Row> = {
  key: 'era',
  label: 'ERA',
  value: () => 3.5,
  source: 'test',
  definition: 'test',
}

const rows: Row[] = [
  { name: 'Skubal', k: 31.2 },
  { name: 'Skenes', k: 27.4 },
  { name: 'Wheeler', k: 24.1 },
  { name: 'No Data', k: null },
]

const rule = (r: Partial<FilterRule>): FilterRule => ({
  id: 'r1',
  columnKey: 'k',
  op: 'gt',
  ...r,
}) as FilterRule

describe('applyRule — missing values', () => {
  const missing = { name: 'No Data', k: null }

  it('fails every positive numeric predicate', () => {
    for (const op of ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between'] as const) {
      expect(applyRule(rule({ op, value: 25, value2: 30 }), kCol, missing)).toBe(false)
    }
  })

  it('is reachable only through isNull', () => {
    expect(applyRule(rule({ op: 'isNull' }), kCol, missing)).toBe(true)
    expect(applyRule(rule({ op: 'notNull' }), kCol, missing)).toBe(false)
  })

  it('does not treat a real value as missing', () => {
    expect(applyRule(rule({ op: 'isNull' }), kCol, rows[0])).toBe(false)
    expect(applyRule(rule({ op: 'notNull' }), kCol, rows[0])).toBe(true)
  })

  // The trap: `neq 25` reads as "anything but 25", which would tempt an
  // implementation to include the em-dash row. It must not — an unknown value
  // is not evidence of inequality.
  it('excludes missing from neq', () => {
    expect(applyRule(rule({ op: 'neq', value: 25 }), kCol, missing)).toBe(false)
  })
})

describe('applyRule — numeric operators', () => {
  it('compares against the raw value, not the formatted one', () => {
    // kCol formats 31.2 as "31.2%" — a rule of 31 must still match.
    expect(applyRule(rule({ op: 'gt', value: 31 }), kCol, rows[0])).toBe(true)
  })

  it('handles boundaries exactly', () => {
    expect(applyRule(rule({ op: 'gte', value: 31.2 }), kCol, rows[0])).toBe(true)
    expect(applyRule(rule({ op: 'gt', value: 31.2 }), kCol, rows[0])).toBe(false)
    expect(applyRule(rule({ op: 'lte', value: 31.2 }), kCol, rows[0])).toBe(true)
  })

  it('normalises reversed between bounds', () => {
    const forward = rule({ op: 'between', value: 25, value2: 30 })
    const reversed = rule({ op: 'between', value: 30, value2: 25 })
    expect(applyRule(forward, kCol, rows[1])).toBe(true)
    expect(applyRule(reversed, kCol, rows[1])).toBe(true)
    expect(applyRule(reversed, kCol, rows[0])).toBe(false)
  })

  it('lets an incomplete rule filter nothing rather than everything', () => {
    expect(applyRule(rule({ op: 'gt', value: undefined }), kCol, rows[0])).toBe(true)
    expect(applyRule(rule({ op: 'between', value: 25, value2: undefined }), kCol, rows[0])).toBe(true)
  })
})

describe('applyRule — text columns', () => {
  it('matches contains case-insensitively', () => {
    expect(applyRule(rule({ columnKey: 'name', op: 'contains', value: 'sku' }), nameCol, rows[0])).toBe(true)
    expect(applyRule(rule({ columnKey: 'name', op: 'contains', value: 'zzz' }), nameCol, rows[0])).toBe(false)
  })

  it('treats an empty needle as no filter', () => {
    expect(applyRule(rule({ columnKey: 'name', op: 'contains', value: '' }), nameCol, rows[0])).toBe(true)
  })

  it('refuses numeric operators on a text column instead of coercing', () => {
    expect(applyRule(rule({ columnKey: 'name', op: 'gt', value: 5 }), nameCol, rows[0])).toBe(false)
  })
})

describe('applyRules', () => {
  const columns = [nameCol, kCol, eraCol]

  it('ANDs every rule', () => {
    const out = applyRules(
      [rule({ id: 'a', op: 'gte', value: 25 }), rule({ id: 'b', op: 'lt', value: 30 })],
      columns,
      rows,
    )
    expect(out.map((r) => r.name)).toEqual(['Skenes'])
  })

  it('returns every row when there are no rules', () => {
    expect(applyRules([], columns, rows)).toHaveLength(4)
  })

  // The regression that matters: a preset narrows the column list, so a rule
  // on a hidden column must go dormant — not silently apply, and not wipe the
  // table by matching nothing.
  it('skips a rule whose column is not currently rendered', () => {
    const narrowed = [nameCol] // K% hidden by a preset
    const out = applyRules([rule({ op: 'gt', value: 99 })], narrowed, rows)
    expect(out).toHaveLength(4)
  })

  it('still applies the rules whose columns survive the preset', () => {
    const out = applyRules(
      [rule({ id: 'a', op: 'gt', value: 99 }), rule({ id: 'b', columnKey: 'name', op: 'contains', value: 'Sk' })],
      [nameCol],
      rows,
    )
    expect(out.map((r) => r.name)).toEqual(['Skubal', 'Skenes'])
  })
})

describe('describeRule', () => {
  it('uses the column label, not the key', () => {
    expect(describeRule(rule({ op: 'gte', value: 25 }), [kCol])).toBe('K% ≥ 25')
    expect(describeRule(rule({ op: 'between', value: 25, value2: 30 }), [kCol])).toBe('K% between 25 and 30')
    expect(describeRule(rule({ op: 'isNull' }), [kCol])).toBe('K% is missing')
  })
})

describe('toCsv', () => {
  const columns: ColumnDef<Row>[] = [
    nameCol,
    kCol,
    { key: 'actions', label: '', value: () => null, source: '—', definition: 'row action' },
  ]

  it('drops the actions column', () => {
    expect(toCsv(columns, rows).split('\n')[0]).toBe('Player,K%')
  })

  it('writes raw values, not formatted ones', () => {
    expect(toCsv(columns, [rows[0]])).toContain('Skubal,31.2')
  })

  it('writes an empty field for a missing value, never a dash or a zero', () => {
    const line = toCsv(columns, [{ name: 'No Data', k: null }]).split('\n')[1]
    expect(line).toBe('No Data,')
  })

  it('quotes and escapes fields containing commas or quotes', () => {
    const tricky: Row[] = [{ name: 'Smith, Jr. "Sam"', k: 1 }]
    expect(toCsv(columns, tricky).split('\n')[1]).toBe('"Smith, Jr. ""Sam""",1')
  })

  it('preserves the row order it was given (the sorted array)', () => {
    const sorted = [...rows].sort((a, b) => (b.k ?? -Infinity) - (a.k ?? -Infinity))
    const names = toCsv(columns, sorted).split('\n').slice(1).map((l) => l.split(',')[0])
    expect(names).toEqual(['Skubal', 'Skenes', 'Wheeler', 'No Data'])
  })
})

describe('withProvenance', () => {
  const columns = [nameCol, kCol]
  const note = csvProvenanceLine(['Prizm export · starters · 2026-07-27', 'sv_stat_cache'])

  // The Step 4 defect: a leading "# ..." line is read as data by every CSV
  // parser, so the real header lands on row 2 and the file is unusable.
  it('keeps the header on the first line', () => {
    const out = withProvenance(toCsv(columns, rows), note)
    expect(out.split('\n')[0]).toBe('Player,K%')
  })

  it('puts the provenance last', () => {
    const out = withProvenance(toCsv(columns, rows), note)
    const lines = out.split('\n')
    expect(lines[lines.length - 1]).toBe(note)
    expect(lines[lines.length - 1].startsWith('# ')).toBe(true)
  })

  it('leaves exactly one row per data row between header and provenance', () => {
    const lines = withProvenance(toCsv(columns, rows), note).split('\n')
    expect(lines).toHaveLength(1 + rows.length + 1)
  })
})
