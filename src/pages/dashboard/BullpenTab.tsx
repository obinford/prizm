// Bullpen tab (dashboard.md §S8): one row per team — season bullpen line
// (ERA/WHIP/K%/leverage usage), L7/L14/L30-day ERA heat windows, fatigue chip
// from 3-day pitch counts, and a drawer with the top-4 reliever slots.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gem, X } from 'lucide-react'
import { deltaPct, deltaTextClass, formatDelta, heatCell } from '@/lib/heat'
import type { BullpenRow } from './utils'
import { BULLPEN_WINDOWS, fmtEra, fmtPct, fmtWhip, getBullpenRows, getRelievers } from './utils'
import LegendStrip from './Legend'

const FATIGUE_STYLES: Record<BullpenRow['fatigue'], { dot: string; text: string }> = {
  Fresh: { dot: 'bg-success', text: 'text-success' },
  Normal: { dot: 'bg-warning', text: 'text-warning' },
  Heavy: { dot: 'bg-danger', text: 'text-danger' },
}

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
    const all = getBullpenRows().sort((a, b) => a.era - b.era)
    if (!q) return all
    return all.filter(
      (r) =>
        r.team.abbr.toLowerCase().includes(q) ||
        r.team.name.toLowerCase().includes(q) ||
        r.team.city.toLowerCase().includes(q),
    )
  }, [query])

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => i), [])

  return (
    <div className="prizm-card overflow-hidden">
      {/* S4 legend */}
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
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-bg-2">
                  <th
                    scope="col"
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[190px] border-b border-line bg-bg-2 px-4 py-2 text-left overline-caption text-text-3"
                  >
                    Team
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="border-b border-l border-line px-2 py-2 text-center overline-caption text-sp-indigo"
                    style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
                  >
                    Season
                  </th>
                  {BULLPEN_WINDOWS.map((w) => (
                    <th
                      key={w.key}
                      scope="col"
                      rowSpan={2}
                      className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-2"
                    >
                      {w.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    rowSpan={2}
                    className="border-b border-l border-line px-3 py-2 text-center overline-caption text-text-3"
                  >
                    Fatigue
                  </th>
                </tr>
                <tr className="bg-bg-2">
                  {['ERA', 'WHIP', 'K%', 'LEV%'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                      style={{ backgroundColor: 'rgba(99,102,241,0.05)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={filterSig}>
                {rows.map((row, rowIdx) => (
                  <motion.tr
                    key={row.team.abbr}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: rowIdx * 0.02 }}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer transition-colors hover:bg-bg-3"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line bg-bg-1 px-4 py-3 text-left font-normal"
                    >
                      <span className="block text-sm font-semibold text-text-1">{row.team.abbr}</span>
                      <span className="data-mono block text-[11px] text-text-3">
                        {row.team.league} {row.team.division}
                      </span>
                    </th>

                    <td className="data-mono border-b border-l border-line bg-bg-1 px-3 py-3 text-center text-[13px] text-text-1">
                      {fmtEra(row.era)}
                    </td>
                    <td className="data-mono border-b border-l border-line bg-bg-2/60 px-3 py-3 text-center text-[13px] text-text-1">
                      {fmtWhip(row.whip)}
                    </td>
                    <td className="data-mono border-b border-l border-line bg-bg-1 px-3 py-3 text-center text-[13px] text-text-1">
                      {fmtPct(row.kPct)}
                    </td>
                    <td className="data-mono border-b border-l border-line bg-bg-2/60 px-3 py-3 text-center text-[13px] text-text-1">
                      {row.leverage}%
                    </td>

                    {BULLPEN_WINDOWS.map((w, wIdx) => {
                      const value = row.windows[w.key].era
                      let dPct = deltaPct(value, row.era)
                      dPct = -dPct // lower ERA = better
                      const { background, textClass } = heatCell(dPct)
                      return (
                        <td
                          key={w.key}
                          className="relative border-b border-l border-line px-3 py-2 text-center"
                          style={{ backgroundColor: background }}
                        >
                          <motion.span
                            key={filterSig}
                            initial={{ opacity: 0.55 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.3, delay: wIdx * 0.07 }}
                            className="pointer-events-none absolute inset-0 bg-bg-0"
                          />
                          <span className={`data-mono block text-[13px] font-bold ${textClass}`}>
                            {fmtEra(value)}
                          </span>
                          <span className={`data-mono block text-[10px] leading-tight ${deltaTextClass(dPct)}`}>
                            {formatDelta(row.era - value, 2)}
                          </span>
                        </td>
                      )
                    })}

                    <td className="border-b border-l border-line px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${FATIGUE_STYLES[row.fatigue].dot}`} />
                        <span className={`data-mono text-[11px] ${FATIGUE_STYLES[row.fatigue].text}`}>
                          {row.fatigue}
                        </span>
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view (<640px) */}
          <div className="space-y-3 p-4 sm:hidden">
            {rows.map((row, i) => (
              <motion.button
                key={row.team.abbr}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                onClick={() => setSelected(row)}
                className="w-full rounded-lg border border-line bg-bg-1 p-4 text-left"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-1">
                    {row.team.abbr} <span className="font-normal text-text-3">bullpen</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${FATIGUE_STYLES[row.fatigue].dot}`} />
                    <span className={`data-mono text-[11px] ${FATIGUE_STYLES[row.fatigue].text}`}>
                      {row.fatigue}
                    </span>
                  </span>
                </div>
                <p className="data-mono mb-3 text-[11px] text-text-3">
                  ERA {fmtEra(row.era)} · WHIP {fmtWhip(row.whip)} · K {fmtPct(row.kPct)} · LEV {row.leverage}%
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {BULLPEN_WINDOWS.map((w) => {
                    const value = row.windows[w.key].era
                    const dPct = -deltaPct(value, row.era)
                    const { background, textClass } = heatCell(dPct)
                    return (
                      <div key={w.key} className="rounded-md px-2 py-2" style={{ backgroundColor: background }}>
                        <span className="data-mono block text-[10px] uppercase tracking-wide text-text-3">
                          {w.key}
                        </span>
                        <span className={`data-mono text-[13px] font-bold ${textClass}`}>{fmtEra(value)}</span>
                        <span className={`data-mono ml-1 text-[10px] ${deltaTextClass(dPct)}`}>
                          {formatDelta(row.era - value, 2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {/* Team bullpen drawer — top 4 reliever slots */}
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
                  <span className="data-mono text-[13px] font-semibold text-text-1">{fmtEra(selected.era)}</span>
                </span>
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">WHIP</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">{fmtWhip(selected.whip)}</span>
                </span>
                <span className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className="overline-caption mr-1.5 text-text-3">K%</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">{fmtPct(selected.kPct)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${FATIGUE_STYLES[selected.fatigue].dot}`} />
                  <span className={`data-mono text-[11px] ${FATIGUE_STYLES[selected.fatigue].text}`}>
                    {selected.fatigue} · {selected.fatiguePitches}p / 3d
                  </span>
                </span>
              </div>

              <p className="overline-caption mb-2 text-text-3">Top relievers</p>
              <div className="space-y-2">
                {getRelievers(selected.team).map((r, i) => {
                  const dPct = -deltaPct(r.era, selected.era)
                  const { background, textClass } = heatCell(dPct)
                  return (
                    <motion.div
                      key={r.role}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                      className="flex items-center justify-between rounded-md border border-line bg-bg-2 px-3 py-2.5"
                    >
                      <span className="text-[13px] font-medium text-text-2">{r.role}</span>
                      <span
                        className="data-mono rounded-sm px-2 py-1 text-[12px] font-semibold"
                        style={{ backgroundColor: background }}
                      >
                        <span className={textClass}>
                          {fmtEra(r.era)} ERA · K {fmtPct(r.kPct)}
                        </span>
                        <span className={`ml-1.5 text-[10px] ${deltaTextClass(dPct)}`}>
                          {formatDelta(dPct, 1)}%
                        </span>
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
