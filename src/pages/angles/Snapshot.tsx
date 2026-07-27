// Angle source snapshot (design.md §angles S3) — a live mini-render of what was
// saved: 2–3 rows of heat cells, a hit-rate bar, or an AI answer excerpt.
// Muted at 85% opacity inside a bg-2 frame with a mono source footer.

import { Zap } from 'lucide-react'
import type { AngleSnapshot } from '@/pages/angles/store'
import HitRateBars from '@/pages/angles/HitRateBars'
import { formatDelta, heatBg, heatCell } from '@/lib/heat'

export default function Snapshot({
  snapshot,
  muted = true,
}: {
  snapshot: AngleSnapshot
  muted?: boolean
}) {
  return (
    <div
      className="overflow-hidden rounded-md border border-line bg-bg-2"
      style={{ opacity: muted ? 0.85 : 1 }}
    >
      <div className="p-3">
        {snapshot.kind === 'heat' && snapshot.heat && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className="data-mono pb-1.5 pr-2 text-left text-[9px] font-medium uppercase tracking-wider text-text-3">
                  Split
                </th>
                {snapshot.heat.headers.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="data-mono pb-1.5 text-center text-[9px] font-medium uppercase tracking-wider text-text-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.heat.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="data-mono pr-2 py-[3px] text-left text-[10px] font-semibold text-text-2">
                    {row.label}
                  </th>
                  {row.cells.map((cell, ci) => {
                    const polarity = row.invert ? -cell.deltaPct : cell.deltaPct
                    const { textClass } = heatCell(polarity)
                    return (
                      <td
                        key={ci}
                        className="p-[2px]"
                        title={`${formatDelta(cell.deltaPct)}% vs season`}
                      >
                        <span
                          className={`data-mono flex h-7 items-center justify-center rounded-[3px] text-[11px] font-medium ${textClass}`}
                          style={{ background: heatBg(polarity) }}
                        >
                          {cell.value}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {snapshot.kind === 'hitbar' && snapshot.hitbar && (
          <div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-1">
                {snapshot.hitbar.label}
              </span>
              <span className="data-mono shrink-0 text-[10px] text-text-3">{snapshot.hitbar.line}</span>
              {snapshot.hitbar.alert && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-sm border border-warning/40 bg-warning/10 px-1 py-0.5 text-[9px] font-semibold text-warning">
                  <Zap size={9} /> value
                </span>
              )}
            </div>
            <div className="mt-2">
              <HitRateBars rates={snapshot.hitbar.rates} compact />
            </div>
          </div>
        )}

        {snapshot.kind === 'text' && snapshot.text && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-text-2">{snapshot.text}</p>
        )}
      </div>
      <p className="data-mono border-t border-line px-3 py-1.5 text-[10px] text-text-3">
        from {snapshot.source}
      </p>
    </div>
  )
}
