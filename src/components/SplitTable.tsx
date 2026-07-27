import { Fragment, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gem, X } from 'lucide-react'
import { deltaPct, formatDelta, heatCell, deltaTextClass } from '@/lib/heat'

/**
 * The Split Table (design.md §7.7) — Prizm's signature heat-table.
 * Generic & prop-driven: any player rows × any stat columns × any windows.
 */

export interface SplitPlayer {
  id: string
  name: string
  team: string
  pos: string
  /** stat key → season baseline value */
  season: Record<string, number>
  /** window key → stat key → value */
  windows: Record<string, Record<string, number>>
  /** window key → sample size (PA, BF, MIN…) */
  samples?: Record<string, number>
  /** sample unit label, e.g. 'PA' or 'MIN' */
  sampleUnit?: string
}

export interface SplitColumn {
  key: string
  label: string
  format?: (v: number) => string
  /** true when a lower value is better (ERA, WHIP, BB%, xwOBA) — flips heat polarity */
  invert?: boolean
  /** decimals for the delta chip (default 1) */
  deltaDecimals?: number
}

export interface SplitWindow {
  key: string
  label: string
}

export interface SplitTableProps {
  players: SplitPlayer[]
  windows: SplitWindow[]
  columns: SplitColumn[]
  loading?: boolean
  title?: string
  showLegend?: boolean
  emptyMessage?: string
  onResetFilters?: () => void
  /** extra content rendered inside the row drawer (per player) */
  renderDrawerExtra?: (player: SplitPlayer) => React.ReactNode
}

function defaultFormat(v: number): string {
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
}

interface HoverCell {
  playerId: string
  windowKey: string
  statKey: string
}

export default function SplitTable({
  players,
  windows,
  columns,
  loading = false,
  title,
  showLegend = true,
  emptyMessage = 'No players match these filters',
  onResetFilters,
  renderDrawerExtra,
}: SplitTableProps) {
  const [hover, setHover] = useState<HoverCell | null>(null)
  const [drawerPlayer, setDrawerPlayer] = useState<SplitPlayer | null>(null)

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => i), [])

  return (
    <div className="prizm-card overflow-hidden">
      {title && (
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-lg font-semibold text-text-1">{title}</h3>
        </div>
      )}

      {/* Legend bar */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <span className="text-xs text-text-3">Worse than baseline</span>
          <div
            className="h-1.5 w-44 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(59,130,246,0.64) 0%, rgba(59,130,246,0.18) 30%, rgba(148,163,184,0.10) 50%, rgba(239,68,68,0.18) 70%, rgba(239,68,68,0.64) 100%)',
            }}
            title="Color = your edge"
          />
          <span className="text-xs text-text-3">Better than baseline</span>
          <span className="ml-auto hidden text-[11px] text-text-3 sm:block">Color = your edge</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-5">
          {skeletonRows.map((i) => (
            <div key={i} className="mb-3 h-12 animate-pulse rounded-md bg-bg-2" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && players.length === 0 && (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <Gem size={36} strokeWidth={1.5} className="text-text-3" />
          <p className="text-sm text-text-2">{emptyMessage}</p>
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
      )}

      {/* Desktop / tablet table (mobile card view below 640px) */}
      {!loading && players.length > 0 && (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                {/* Group header row */}
                <tr className="bg-bg-2">
                  <th
                    scope="col"
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[190px] border-b border-line bg-bg-2 px-4 py-2 text-left overline-caption text-text-3"
                  >
                    Player
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={columns.length}
                    className="border-b border-l border-line px-2 py-2 text-center overline-caption text-sp-indigo"
                    style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
                  >
                    Season
                  </th>
                  {windows.map((w) => (
                    <th
                      key={w.key}
                      scope="colgroup"
                      colSpan={columns.length}
                      className="border-b border-l border-line px-2 py-2 text-center overline-caption text-text-2"
                    >
                      {w.label}
                    </th>
                  ))}
                </tr>
                {/* Stat header row */}
                <tr className="bg-bg-2">
                  {columns.map((c) => (
                    <th
                      key={`season-${c.key}`}
                      scope="col"
                      className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                      style={{ backgroundColor: 'rgba(99,102,241,0.05)' }}
                    >
                      {c.label}
                    </th>
                  ))}
                  {windows.map((w) =>
                    columns.map((c) => (
                      <th
                        key={`${w.key}-${c.key}`}
                        scope="col"
                        className="data-mono border-b border-l border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                      >
                        {c.label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {players.map((p, rowIdx) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: rowIdx * 0.03 }}
                    onClick={() => setDrawerPlayer(p)}
                    className="cursor-pointer transition-colors hover:bg-bg-3"
                  >
                    {/* Sticky player cell */}
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line bg-bg-1 px-4 py-3 text-left font-normal"
                    >
                      <span className="block text-sm font-medium text-text-1">{p.name}</span>
                      <span className="data-mono block text-[11px] text-text-3">
                        {p.team} · {p.pos}
                      </span>
                    </th>

                    {/* Season baseline cells */}
                    {columns.map((c, i) => {
                      const fmt = c.format ?? defaultFormat
                      return (
                        <td
                          key={`season-${c.key}`}
                          className={`data-mono border-b border-l border-line px-3 py-3 text-center text-[13px] text-text-1 ${
                            i % 2 === 0 ? 'bg-bg-1' : 'bg-bg-2/60'
                          }`}
                        >
                          {fmt(p.season[c.key])}
                        </td>
                      )
                    })}

                    {/* Window heat cells */}
                    {windows.map((w) =>
                      columns.map((c) => {
                        const fmt = c.format ?? defaultFormat
                        const season = p.season[c.key]
                        const value = p.windows[w.key]?.[c.key]
                        if (value === undefined || season === undefined) {
                          return (
                            <td
                              key={`${w.key}-${c.key}`}
                              className="border-b border-l border-line px-3 py-3 text-center text-text-3"
                            >
                              —
                            </td>
                          )
                        }
                        let dPct = deltaPct(value, season)
                        if (c.invert) dPct = -dPct
                        const { background, textClass } = heatCell(dPct)
                        const delta = value - season
                        const isHover =
                          hover?.playerId === p.id &&
                          hover.windowKey === w.key &&
                          hover.statKey === c.key
                        const sample = p.samples?.[w.key]
                        return (
                          <td
                            key={`${w.key}-${c.key}`}
                            className="relative border-b border-l border-line px-3 py-2 text-center"
                            style={{ backgroundColor: background }}
                            onMouseEnter={() =>
                              setHover({ playerId: p.id, windowKey: w.key, statKey: c.key })
                            }
                            onMouseLeave={() => setHover(null)}
                          >
                            <span className={`data-mono block text-[13px] font-medium ${textClass}`}>
                              {fmt(value)}
                            </span>
                            <span
                              className={`data-mono block text-[11px] leading-tight ${deltaTextClass(dPct)}`}
                            >
                              {formatDelta(c.invert ? -delta : delta, c.deltaDecimals ?? (Math.abs(delta) < 1 ? 2 : 1))}
                            </span>
                            {/* Tooltip */}
                            <AnimatePresence>
                              {isHover && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-52 -translate-x-1/2 rounded-md border border-line bg-bg-2 p-3 text-left shadow-raised"
                                >
                                  <p className="overline-caption mb-1.5 text-text-3">
                                    {c.label} · {w.label}
                                  </p>
                                  <p className="data-mono text-xs text-text-2">
                                    Season <span className="text-text-1">{fmt(season)}</span> → Window{' '}
                                    <span className="text-text-1">{fmt(value)}</span>
                                  </p>
                                  <p className={`data-mono mt-0.5 text-xs ${deltaTextClass(dPct)}`}>
                                    {formatDelta(dPct, 1)}% vs baseline
                                  </p>
                                  {sample !== undefined && (
                                    <p className="data-mono mt-1 text-[11px] text-text-3">
                                      n = {sample} {p.sampleUnit ?? ''}
                                    </p>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </td>
                        )
                      }),
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view (<640px) */}
          <div className="space-y-3 p-4 sm:hidden">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDrawerPlayer(p)}
                className="w-full rounded-lg border border-line bg-bg-1 p-4 text-left"
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-text-1">{p.name}</span>
                  <span className="data-mono text-[11px] text-text-3">
                    {p.team} · {p.pos}
                  </span>
                </div>
                <p className="data-mono mb-3 text-[11px] text-text-3">
                  Season:{' '}
                  {columns.map((c) => `${c.label} ${(c.format ?? defaultFormat)(p.season[c.key])}`).join(' · ')}
                </p>
                {columns.map((c) => (
                  <div key={c.key} className="mb-2">
                    <p className="overline-caption mb-1.5 text-text-3">{c.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {windows.map((w) => {
                        const season = p.season[c.key]
                        const value = p.windows[w.key]?.[c.key]
                        if (value === undefined) return null
                        let dPct = deltaPct(value, season)
                        if (c.invert) dPct = -dPct
                        const { background, textClass } = heatCell(dPct)
                        return (
                          <div
                            key={w.key}
                            className="rounded-md px-2.5 py-2"
                            style={{ backgroundColor: background }}
                          >
                            <span className="data-mono block text-[10px] uppercase tracking-wide text-text-3">
                              {w.label}
                            </span>
                            <span className={`data-mono text-[13px] font-medium ${textClass}`}>
                              {(c.format ?? defaultFormat)(value)}
                            </span>
                            <span className={`data-mono ml-1.5 text-[10px] ${deltaTextClass(dPct)}`}>
                              {formatDelta(dPct, 1)}%
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Row detail drawer */}
      <AnimatePresence>
        {drawerPlayer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setDrawerPlayer(null)}
            />
            <motion.aside
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-bg-1 p-6"
              role="dialog"
              aria-label={`${drawerPlayer.name} details`}
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-text-1">
                    {drawerPlayer.name}
                  </h3>
                  <p className="data-mono mt-1 text-xs text-text-3">
                    {drawerPlayer.team} · {drawerPlayer.pos}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerPlayer(null)}
                  className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                  aria-label="Close details"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Season baselines */}
              <p className="overline-caption mb-2 text-sp-indigo">Season baseline</p>
              <div className="mb-6 grid grid-cols-2 gap-2">
                {columns.map((c) => (
                  <div key={c.key} className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
                    <span className="overline-caption block text-text-3">{c.label}</span>
                    <span className="data-mono text-lg font-semibold text-text-1">
                      {(c.format ?? defaultFormat)(drawerPlayer.season[c.key])}
                    </span>
                  </div>
                ))}
              </div>

              {/* Windows */}
              {windows.map((w) => (
                <Fragment key={w.key}>
                  <p className="overline-caption mb-2 mt-5 text-text-3">
                    {w.label}
                    {drawerPlayer.samples?.[w.key] !== undefined && (
                      <span className="data-mono ml-2 normal-case tracking-normal">
                        n = {drawerPlayer.samples[w.key]} {drawerPlayer.sampleUnit ?? ''}
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {columns.map((c) => {
                      const season = drawerPlayer.season[c.key]
                      const value = drawerPlayer.windows[w.key]?.[c.key]
                      if (value === undefined) return null
                      let dPct = deltaPct(value, season)
                      if (c.invert) dPct = -dPct
                      const { background, textClass } = heatCell(dPct)
                      return (
                        <div key={c.key} className="rounded-md px-3 py-2.5" style={{ backgroundColor: background }}>
                          <span className="overline-caption block text-text-3">{c.label}</span>
                          <span className={`data-mono text-lg font-semibold ${textClass}`}>
                            {(c.format ?? defaultFormat)(value)}
                          </span>
                          <span className={`data-mono ml-2 text-xs ${deltaTextClass(dPct)}`}>
                            {formatDelta(dPct, 1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Fragment>
              ))}

              {renderDrawerExtra && (
                <div className="mt-6 border-t border-line pt-5">{renderDrawerExtra(drawerPlayer)}</div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
