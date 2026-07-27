// Bullpen tab (dashboard.md §S8): one row per team, showing the real ingested
// team bullpen line only — ERA, WHIP, K%, BB% and the reliever count behind it.
//
// Removed in Phase 1 (see src/pages/dashboard/utils.ts for the full list):
// LEV% usage, the 3-day fatigue pitch count and its chip, the L7/L14/L30 ERA
// heat windows, and the four "top reliever" slots. None had a data source —
// they were derived from a single hash seed and rendered as fact. Date-bucketed
// bullpen windows and real reliever splits are buildable from game_logs and are
// Phase 2 work.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gem, X } from 'lucide-react'
import type { BullpenRow } from './utils'
import { fmtEra, fmtPct, fmtWhip, getBullpenRows } from './utils'
import LegendStrip from './Legend'

const DASH = '—'

/** Format a nullable stat; null renders an em-dash, never a substitute value. */
function fmt(v: number | null, f: (n: number) => string): string {
  return v == null ? DASH : f(v)
}

type NumericCol = 'era' | 'whip' | 'kPct' | 'bbPct'

const COLS: { key: NumericCol; label: string; fmt: (n: number) => string }[] = [
  { key: 'era', label: 'ERA', fmt: fmtEra },
  { key: 'whip', label: 'WHIP', fmt: fmtWhip },
  { key: 'kPct', label: 'K%', fmt: fmtPct },
  { key: 'bbPct', label: 'BB%', fmt: fmtPct },
]

export interface BullpenTabProps {
  loading: boolean
  query: string
  filterSig: string
  onResetFilters: () => void
}

export default function BullpenTab({ loading, query, onResetFilters }: BullpenTabProps) {
  const [selected, setSelected] = useState<BullpenRow | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Teams with no ingested bullpen row sort last rather than sorting as 0.00.
    const all = getBullpenRows().sort((a, b) => {
      if (a.era == null && b.era == null) return 0
      if (a.era == null) return 1
      if (b.era == null) return -1
      return a.era - b.era
    })
    if (!q) return all
    return all.filter(
      (r) =>
        r.team.abbr.toLowerCase().includes(q) ||
        r.team.name.toLowerCase().includes(q) ||
        r.team.city.toLowerCase().includes(q),
    )
  }, [query])

  const covered = rows.filter((r) => r.era != null).length
  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => i), [])

  return (
    <div className="prizm-card overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <LegendStrip />
      </div>

      {loading && (
        <div className="p-5" aria-label="Loading">
          {skeletonRows.map((i) => (
            <div key={i} className="mb-3 h-12 animate-pulse rounded-md bg-bg-2" />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <Gem size={36} strokeWidth={1.5} className="text-text-3" />
          <p className="text-sm text-text-2">No teams match these filters</p>
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            Reset filters
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* Provenance — which rows are backed by ingested reliever logs */}
          <p className="data-mono border-b border-line px-5 py-2 text-[11px] text-text-3">
            Team reliever aggregates from MLB Stats API game logs · {covered}/{rows.length} teams
            covered{covered < rows.length ? ' · uncovered teams show —' : ''}
          </p>

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-bg-2">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[190px] border-b border-line bg-bg-2 px-4 py-2 text-left overline-caption text-text-3"
                  >
                    Team
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                      style={{ backgroundColor: 'rgba(99,102,241,0.05)' }}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="border-b border-l border-line px-3 py-2 text-center overline-caption text-text-3"
                    title="Distinct relievers behind the aggregate"
                  >
                    Arms
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.team.abbr}
                    className="group cursor-pointer transition-colors hover:bg-bg-2/60"
                    onClick={() => setSelected(row)}
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line bg-bg-1 px-4 py-3 text-left font-normal group-hover:bg-bg-3"
                    >
                      <span className="block text-sm font-semibold text-text-1">
                        {row.team.city} {row.team.name}
                      </span>
                      <span className="data-mono block text-[11px] text-text-3">
                        {row.team.abbr} · {row.team.league} {row.team.division}
                      </span>
                    </th>
                    {COLS.map((c) => (
                      <td
                        key={c.key}
                        className="data-mono border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-1"
                      >
                        {row[c.key] == null ? (
                          <span
                            className="text-text-3"
                            title="No ingested bullpen row for this team"
                          >
                            {DASH}
                          </span>
                        ) : (
                          c.fmt(row[c.key] as number)
                        )}
                      </td>
                    ))}
                    <td className="data-mono border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-3">
                      {row.relievers ?? DASH}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 sm:hidden">
            {rows.map((row) => (
              <motion.button
                key={row.team.abbr}
                type="button"
                onClick={() => setSelected(row)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full rounded-md border border-line bg-bg-2 p-4 text-left"
              >
                <span className="block text-sm font-semibold text-text-1">
                  {row.team.city} {row.team.name}
                </span>
                <span className="data-mono mt-1 block text-[11px] text-text-3">
                  ERA {fmt(row.era, fmtEra)} · WHIP {fmt(row.whip, fmtWhip)} · K{' '}
                  {fmt(row.kPct, fmtPct)} · BB {fmt(row.bbPct, fmtPct)}
                  {row.relievers != null ? ` · ${row.relievers} arms` : ''}
                </span>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {/* Team bullpen drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-bg-1 p-6"
              role="dialog"
              aria-label={`${selected.team.name} bullpen details`}
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl font-semibold text-text-1">
                    {selected.team.city} {selected.team.name}
                  </h3>
                  <p className="data-mono mt-0.5 text-[11px] text-text-3">
                    {selected.team.league} {selected.team.division} · bullpen
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                  aria-label="Close details"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {COLS.map((c) => (
                  <span key={c.key} className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                    <span className="overline-caption mr-1.5 text-text-3">{c.label}</span>
                    <span className="data-mono text-[13px] font-semibold text-text-1">
                      {fmt(selected[c.key], c.fmt)}
                    </span>
                  </span>
                ))}
                {selected.relievers != null && (
                  <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                    <span className="overline-caption mr-1.5 text-text-3">Arms</span>
                    <span className="data-mono text-[13px] font-semibold text-text-1">
                      {selected.relievers}
                    </span>
                  </span>
                )}
              </div>

              <p className="overline-caption mb-2 text-text-3">Reliever detail</p>
              <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] leading-relaxed text-text-3">
                Individual reliever lines are not available yet. The previous version of this panel
                showed four role slots (Closer / Setup / 7th / Long) whose ERA and K% were generated
                from a single seed — no reliever was named or sourced. Real per-arm splits require
                reliever-level aggregation from game logs.
              </p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
