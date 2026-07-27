// Bullpen tab (dashboard.md §S8) — one row per team through the shared
// DataTable, showing the real ingested team bullpen line only: ERA, WHIP, K%,
// BB% and the reliever count behind it.
//
// Removed in Phase 1 (see src/pages/dashboard/utils.ts for the full list):
// LEV% usage, the 3-day fatigue pitch count and its chip, the L7/L14/L30 ERA
// heat windows, and the four "top reliever" slots. None had a data source —
// they were derived from a single hash seed and rendered as fact. Date-bucketed
// bullpen windows and real reliever splits are buildable from game_logs and are
// Phase 2 work.
//
// The hand-rolled table is gone too (Step 2.2): columns now live in
// src/lib/columns/mlbBullpen.ts and sorting/nulls-last/em-dash behaviour is
// DataTable's. The drawer stays local — it is bullpen-specific.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import DataTable from '@/components/DataTable'
import { fmt } from '@/lib/columns'
import type { BullpenRow } from '@/lib/columns/mlbBullpen'
import { BULLPEN_COLUMNS } from '@/lib/columns/mlbBullpen'
import { getBullpenRows } from './utils'
import LegendStrip from './Legend'

export interface BullpenTabProps {
  loading: boolean
  query: string
  filterSig: string
  onResetFilters: () => void
}

export default function BullpenTab({ loading, query, filterSig, onResetFilters }: BullpenTabProps) {
  const [selected, setSelected] = useState<BullpenRow | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = getBullpenRows()
    if (!q) return all
    return all.filter(
      (r) =>
        r.team.abbr.toLowerCase().includes(q) ||
        r.team.name.toLowerCase().includes(q) ||
        r.team.city.toLowerCase().includes(q),
    )
  }, [query])

  const covered = rows.filter((r) => r.era != null).length

  const provenance = `Team reliever aggregates from MLB Stats API game logs · ${covered}/${rows.length} teams covered${
    covered < rows.length ? ' · uncovered teams show —' : ''
  }`

  return (
    <div className="space-y-3">
      <div className="prizm-card px-5 py-3">
        <LegendStrip />
      </div>

      <DataTable<BullpenRow>
        columns={BULLPEN_COLUMNS}
        rows={rows}
        rowKey={(r) => r.team.abbr}
        loading={loading}
        filterSig={filterSig}
        onRowClick={(r) => setSelected(r)}
        onResetFilters={onResetFilters}
        emptyLabel="No teams match these filters"
        provenance={provenance}
        defaultSortKey="era"
        defaultSortDir={1}
        mobileTitle={(r) => `${r.team.city} ${r.team.name}`}
        mobileSummary={(r) =>
          `ERA ${r.era != null ? fmt.era(r.era) : '—'} · WHIP ${
            r.whip != null ? fmt.whip(r.whip) : '—'
          } · K ${r.kPct != null ? fmt.pct1(r.kPct) : '—'} · BB ${
            r.bbPct != null ? fmt.pct1(r.bbPct) : '—'
          }${r.relievers != null ? ` · ${r.relievers} arms` : ''}`
        }
      />

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
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">ERA</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">
                    {selected.era != null ? fmt.era(selected.era) : '—'}
                  </span>
                </span>
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">WHIP</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">
                    {selected.whip != null ? fmt.whip(selected.whip) : '—'}
                  </span>
                </span>
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">K%</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">
                    {selected.kPct != null ? fmt.pct1(selected.kPct) : '—'}
                  </span>
                </span>
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">BB%</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">
                    {selected.bbPct != null ? fmt.pct1(selected.bbPct) : '—'}
                  </span>
                </span>
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
