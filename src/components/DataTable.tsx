// DataTable — the single table component for every Prizm surface.
//
// Renders any ColumnDef[] against any row list. Handles grouped headers, sticky
// identity columns, sorting with nulls-last, heat colouring with per-column
// polarity inversion, em-dash rendering for missing data, header tooltips
// carrying the stat definition and its source, and a mobile card fallback.
//
// Replaces the per-screen table implementations. A new column is a ColumnDef;
// a new sport is a new ColumnDef list.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, Download, Gem } from 'lucide-react'
import type { ColumnDef } from '@/lib/columns'
import { groupSpans } from '@/lib/columns'
import { deltaPct, deltaTextClass, formatDelta, heatCell } from '@/lib/heat'
import { csvProvenanceLine, downloadCsv, toCsv, withProvenance } from '@/lib/exportCsv'
import { slateDate } from '@/lib/slateDay'

const DASH = '—'

export interface DataTableProps<Row> {
  columns: ColumnDef<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  loading?: boolean
  /** Changes whenever filters change — drives the re-tint sweep. */
  filterSig?: string
  onRowClick?: (row: Row) => void
  /** Rendered when rows is empty and not loading. */
  emptyLabel?: string
  onResetFilters?: () => void
  /** Provenance line rendered above the table. */
  provenance?: string
  /** Default sort column key. */
  defaultSortKey?: string
  defaultSortDir?: 1 | -1
  /** Compact one-line summary for the mobile card. */
  mobileSummary?: (row: Row) => string
  mobileTitle?: (row: Row) => string
  /** Enables the Export CSV button. Filename gets the slate date appended. */
  exportName?: string
  /** Active-rule summary appended to the CSV provenance comment line. */
  exportFilters?: string
}

interface SortState {
  key: string | null
  dir: 1 | -1
}

function cellNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export default function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  filterSig = '',
  onRowClick,
  emptyLabel = 'No rows match these filters',
  onResetFilters,
  provenance,
  defaultSortKey,
  defaultSortDir = -1,
  mobileSummary,
  mobileTitle,
  exportName,
  exportFilters,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState>({
    key: defaultSortKey ?? null,
    dir: defaultSortDir,
  })

  const groups = useMemo(() => groupSpans(columns), [columns])
  const hasGroups = groups.some((g) => g.group != null)

  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const arr = [...rows]
    // Nulls always sort last regardless of direction — an em-dash must never
    // outrank a real number.
    arr.sort((a, b) => {
      const av = col.value(a)
      const bv = col.value(b)
      const an = cellNumber(av)
      const bn = cellNumber(bv)
      if (an == null && bn == null) {
        const as = typeof av === 'string' ? av : ''
        const bs = typeof bv === 'string' ? bv : ''
        if (!as && !bs) return 0
        if (!as) return 1
        if (!bs) return -1
        return as.localeCompare(bs) * sort.dir
      }
      if (an == null) return 1
      if (bn == null) return -1
      return (an - bn) * sort.dir
    })
    return arr
  }, [rows, columns, sort])

  const clickSort = (col: ColumnDef<Row>) => {
    if (!col.sortable) return
    setSort((prev) => {
      if (prev.key === col.key) return { key: col.key, dir: prev.dir === 1 ? -1 : 1 }
      // Inverted stats (lower is better) default to ascending.
      return { key: col.key, dir: col.invert ? 1 : -1 }
    })
  }

  // Export the exact array being rendered — sorted, ruled and searched.
  // Exporting the unsorted source is the bug this exists to avoid.
  const onExport = () => {
    if (!exportName) return
    const d = slateDate()
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    // Provenance goes LAST — a leading "# ..." row is read as data by every
    // CSV parser, which would push the real header to row 2 and break the
    // export as a data handoff.
    const note = csvProvenanceLine([
      `Prizm export · ${exportName} · ${ymd}`,
      provenance,
      exportFilters ? `filters: ${exportFilters}` : undefined,
    ])
    downloadCsv(`${exportName}-${ymd}.csv`, withProvenance(toCsv(columns, sorted), note))
  }

  const headerTitle = (col: ColumnDef<Row>) =>
    [col.definition, col.markets?.length ? `Markets: ${col.markets.join(', ')}` : '', `Source: ${col.source}`]
      .filter(Boolean)
      .join('\n\n')

  const skeleton = useMemo(() => Array.from({ length: 6 }, (_, i) => i), [])

  if (loading) {
    return (
      <div className="prizm-card overflow-hidden p-5" aria-label="Loading">
        {skeleton.map((i) => (
          <div key={i} className="mb-3 h-12 animate-pulse rounded-md bg-bg-2" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="prizm-card flex flex-col items-center gap-4 px-6 py-16 text-center">
        <Gem size={36} strokeWidth={1.5} className="text-text-3" />
        <p className="text-sm text-text-2">{emptyLabel}</p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            Reset filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="prizm-card overflow-hidden">
      {(provenance || exportName) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2">
          {provenance ? (
            <p className="data-mono text-[11px] text-text-3">{provenance}</p>
          ) : (
            <span />
          )}
          {exportName && (
            <button
              type="button"
              onClick={onExport}
              className="data-mono flex shrink-0 items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
        </div>
      )}

      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            {hasGroups && (
              <tr className="bg-bg-2">
                {groups.map((g, i) => (
                  <th
                    key={`${g.group ?? 'none'}-${i}`}
                    scope={g.span > 1 ? 'colgroup' : 'col'}
                    colSpan={g.span}
                    className={`border-b border-line px-2 py-2 text-center overline-caption ${
                      g.group ? 'border-l text-sp-indigo' : 'text-text-3'
                    }`}
                    style={g.group ? { backgroundColor: 'rgba(99,102,241,0.08)' } : undefined}
                  >
                    {g.group ?? ''}
                  </th>
                ))}
              </tr>
            )}
            <tr className="bg-bg-2">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  title={headerTitle(col)}
                  style={{
                    minWidth: col.minWidth,
                    backgroundColor: col.group ? 'rgba(99,102,241,0.05)' : undefined,
                  }}
                  className={`border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-text-3 ${
                    col.sticky
                      ? 'sticky left-0 z-10 bg-bg-2 text-left overline-caption'
                      : 'data-mono border-l text-center'
                  }`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => clickSort(col)}
                      className="transition-colors hover:text-text-1"
                    >
                      {col.label}{' '}
                      {sort.key === col.key && (
                        <ArrowDown
                          size={11}
                          className={`inline transition-transform duration-200 ${
                            sort.dir === 1 ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={filterSig}>
            {sorted.map((row, rowIdx) => (
              <motion.tr
                key={rowKey(row)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(rowIdx, 12) * 0.02 }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`group transition-colors hover:bg-bg-2/60 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => {
                  const raw = col.value(row)
                  const num = cellNumber(raw)

                  // Identity / custom cell
                  if (col.render) {
                    return col.sticky ? (
                      <th
                        key={col.key}
                        scope="row"
                        className="sticky left-0 z-10 border-b border-line bg-bg-1 px-4 py-3 text-left font-normal group-hover:bg-bg-3"
                      >
                        {col.render(row)}
                      </th>
                    ) : (
                      <td
                        key={col.key}
                        className="border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-1"
                      >
                        {col.render(row)}
                      </td>
                    )
                  }

                  // Missing -> em-dash, never a substitute value
                  if (raw == null || (typeof raw === 'number' && !Number.isFinite(raw))) {
                    return (
                      <td
                        key={col.key}
                        title={col.missingHint ?? `No ${col.label} available. Source: ${col.source}`}
                        className="data-mono border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-3"
                      >
                        {DASH}
                      </td>
                    )
                  }

                  const text =
                    num != null ? (col.format ? col.format(num) : String(num)) : String(raw)

                  // Heat cell
                  const base = col.heat && col.baseline ? col.baseline(row) : null
                  if (col.heat && base != null && num != null) {
                    let d = deltaPct(num, base)
                    if (col.invert) d = -d
                    const { background, textClass } = heatCell(d)
                    return (
                      <td
                        key={col.key}
                        className="relative border-b border-l border-line px-3 py-2 text-center"
                        style={{ backgroundColor: background }}
                      >
                        <motion.span
                          key={filterSig}
                          initial={{ opacity: 0.55 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(colIdx, 8) * 0.05 }}
                          className="pointer-events-none absolute inset-0 bg-bg-0"
                        />
                        <span className={`data-mono relative text-[13px] font-medium ${textClass}`}>
                          {text}
                        </span>
                        <span
                          className={`data-mono relative block text-[10px] ${deltaTextClass(d)}`}
                        >
                          {formatDelta(d, 1)}%
                        </span>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={col.key}
                      className={`data-mono border-b border-l border-line px-3 py-3 text-[13px] text-text-1 ${
                        col.align === 'left' ? 'text-left' : 'text-center'
                      }`}
                    >
                      {text}
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 sm:hidden">
        {sorted.map((row) => (
          <motion.button
            key={rowKey(row)}
            type="button"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full rounded-md border border-line bg-bg-2 p-4 text-left"
          >
            <span className="block text-sm font-semibold text-text-1">
              {mobileTitle ? mobileTitle(row) : rowKey(row)}
            </span>
            {mobileSummary && (
              <span className="data-mono mt-1 block text-[11px] text-text-3">
                {mobileSummary(row)}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
