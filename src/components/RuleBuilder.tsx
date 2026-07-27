// RuleBuilder — arbitrary predicates over any ColumnDef list.
//
// One builder serves Starters, Batters, Bullpen and Team Stats because rules
// resolve through ColumnDef.value(row), never through row internals. Collapsed
// it is a `+ Add rule` button and the chip row; expanded it edits one row per
// rule with a live match count and a raw-range hint under the value input.
//
// The range hint is the mitigation for the 0-100 vs 0-1 scale inconsistency
// (see filterRules.ts): the user sees the column's real numeric domain instead
// of guessing whether K% wants 25 or 0.25.

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ColumnDef } from '@/lib/columns'
import type { FilterRule, RuleOperator } from '@/lib/filterRules'
import { applyRules, describeRule, NULL_OPS, OP_LABELS } from '@/lib/filterRules'

let ruleCounter = 0
/** Id pattern mirrors src/pages/angles/store.ts — no dependency. */
function nextRuleId(): string {
  ruleCounter += 1
  return `rule-${Date.now().toString(36)}-${ruleCounter}`
}

const ALL_OPS = Object.keys(OP_LABELS) as RuleOperator[]

export interface RuleBuilderProps<Row> {
  columns: ColumnDef<Row>[]
  rules: FilterRule[]
  onChange: (rules: FilterRule[]) => void
  /** Rows before rules, for the live match count and range hints. */
  sampleRows: Row[]
}

/** Raw numeric min/max of a column across the sample rows, for the hint. */
function columnRange<Row>(col: ColumnDef<Row>, rows: Row[]): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const r of rows) {
    const v = col.value(r)
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return min <= max ? { min, max } : null
}

export default function RuleBuilder<Row>({
  columns,
  rules,
  onChange,
  sampleRows,
}: RuleBuilderProps<Row>) {
  const [open, setOpen] = useState(false)

  // Column select options, grouped by ColumnDef.group in first-seen order.
  const groups = useMemo(() => {
    const out: { group: string | undefined; cols: ColumnDef<Row>[] }[] = []
    for (const c of columns) {
      if (c.key === 'actions') continue
      const last = out[out.length - 1]
      if (last && last.group === c.group) last.cols.push(c)
      else out.push({ group: c.group, cols: [c] })
    }
    return out
  }, [columns])

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])

  // Live match count — recomputed on every keystroke through `rules`.
  const matchCount = useMemo(
    () => applyRules(rules, columns, sampleRows).length,
    [rules, columns, sampleRows],
  )

  const update = (id: string, patch: Partial<FilterRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id))

  const addRule = () => {
    const first = groups[0]?.cols[0]
    if (!first) return
    onChange([...rules, { id: nextRuleId(), columnKey: first.key, op: 'gte' }])
    setOpen(true)
  }

  const chipRow = rules.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
      {rules.map((r) => {
        const dormant = !byKey.has(r.columnKey)
        const text = describeRule(r, columns)
        return (
          <span
            key={r.id}
            title={
              dormant
                ? `${text} — this column is not shown under the current view, so this rule is inactive.`
                : undefined
            }
            className={`data-mono inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] ${
              dormant
                ? 'border border-dashed border-line text-text-3 opacity-60'
                : 'border border-line bg-bg-2 text-text-1'
            }`}
          >
            {text}
            {dormant && <span className="text-[10px] uppercase tracking-wide">inactive</span>}
            <button
              type="button"
              aria-label={`Remove rule ${text}`}
              onClick={() => remove(r.id)}
              className="rounded-sm p-0.5 transition-colors hover:text-sp-magenta"
            >
              <X size={11} />
            </button>
          </span>
        )
      })}
      <span className="data-mono ml-1 text-[11px] text-text-3">
        {matchCount} of {sampleRows.length} rows match
      </span>
    </div>
  )

  return (
    <div className="space-y-2">
      {chipRow}

      {!open && (
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
        >
          <Plus size={13} /> Add rule
        </button>
      )}

      {open && (
        <div className="space-y-2">
          {rules.map((r) => {
            const col = byKey.get(r.columnKey)
            const range = col ? columnRange(col, sampleRows) : null
            const numericOp = !NULL_OPS.includes(r.op) && r.op !== 'contains'
            return (
              <div key={r.id} className="flex flex-wrap items-start gap-2">
                <select
                  value={r.columnKey}
                  onChange={(e) => update(r.id, { columnKey: e.target.value })}
                  aria-label="Rule column"
                  className="data-mono h-9 max-w-44 rounded-sm border border-line bg-bg-2 px-2 text-[12px] text-text-1 focus:border-sp-indigo focus:outline-none"
                >
                  {groups.map((g, i) =>
                    g.group ? (
                      <optgroup key={g.group} label={g.group}>
                        {g.cols.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      g.cols.map((c) => (
                        <option key={`${i}-${c.key}`} value={c.key}>
                          {c.label}
                        </option>
                      ))
                    ),
                  )}
                </select>

                <select
                  value={r.op}
                  onChange={(e) => update(r.id, { op: e.target.value as RuleOperator })}
                  aria-label="Rule operator"
                  className="data-mono h-9 rounded-sm border border-line bg-bg-2 px-2 text-[12px] text-text-1 focus:border-sp-indigo focus:outline-none"
                >
                  {ALL_OPS.map((op) => (
                    <option key={op} value={op}>
                      {OP_LABELS[op]}
                    </option>
                  ))}
                </select>

                {r.op === 'contains' && (
                  <input
                    type="text"
                    value={String(r.value ?? '')}
                    onChange={(e) => update(r.id, { value: e.target.value })}
                    placeholder="contains…"
                    aria-label="Rule value"
                    className="data-mono h-9 w-32 rounded-sm border border-line bg-bg-2 px-2 text-[12px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none"
                  />
                )}

                {numericOp && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={r.value ?? ''}
                        onChange={(e) =>
                          update(r.id, {
                            value: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="value"
                        aria-label="Rule value"
                        className="data-mono h-9 w-24 rounded-sm border border-line bg-bg-2 px-2 text-[12px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none"
                      />
                      {r.op === 'between' && (
                        <>
                          <span className="text-[11px] text-text-3">and</span>
                          <input
                            type="number"
                            value={r.value2 ?? ''}
                            onChange={(e) =>
                              update(r.id, {
                                value2: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            placeholder="value"
                            aria-label="Rule upper bound"
                            className="data-mono h-9 w-24 rounded-sm border border-line bg-bg-2 px-2 text-[12px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none"
                          />
                        </>
                      )}
                    </div>
                    {range && col && (
                      <span className="data-mono text-[10px] text-text-3">
                        range {range.min} – {range.max}
                        {col.format &&
                          col.format(range.min) !== String(range.min) &&
                          ` (${col.format(range.min)} – ${col.format(range.max)})`}
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  aria-label="Remove rule"
                  onClick={() => remove(r.id)}
                  className="rounded-sm p-2 text-text-3 transition-colors hover:text-sp-magenta"
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addRule}
              className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
            >
              <Plus size={13} /> Add rule
            </button>
            {rules.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[12px] text-text-3 transition-colors hover:text-text-1"
              >
                Clear all rules
              </button>
            )}
            {rules.length === 0 && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] text-text-3 transition-colors hover:text-text-1"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
